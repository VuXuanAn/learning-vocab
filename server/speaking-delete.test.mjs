import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const read=p=>readFileSync(new URL('../src/lib/'+p+'.ts',import.meta.url),'utf8')
const url=s=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s)).toString('base64')
const dbUrl=url(read('db').replace("'dexie'",JSON.stringify(import.meta.resolve('dexie'))))
const {VocabDatabase}=await import(dbUrl)
const {removeSpeakingRecording}=await import(url(read('speaking-delete').replace("'./db'",JSON.stringify(dbUrl))))
const row={id:'r',title:'Read',referenceText:'Hello',createdAt:new Date().toISOString(),durationSeconds:2,mimeType:'audio/webm',size:2,audio:new Blob(['hi'],{type:'audio/webm'}),driveFileId:'drive-id',metadataSynced:true}

test('local-only recording deletes without any external request',async()=>{
 const db=new VocabDatabase('delete-'+crypto.randomUUID())
 try{
  const local={...row,driveFileId:undefined,metadataSynced:false}
  await db.speakingRecordings.add(local)
  const unexpected=async()=>{throw new Error('Unexpected network call')}
  await removeSpeakingRecording(local,{check:unexpected,removeFile:unexpected,removeMetadata:unexpected},db)
  assert.equal(await db.speakingRecordings.count(),0)
 }finally{await db.delete()}
})

test('Drive file is deleted before metadata and local audio',async()=>{
 const db=new VocabDatabase('delete-'+crypto.randomUUID()),calls=[]
 try{
  await db.speakingRecordings.add(row)
  await removeSpeakingRecording(row,{check:async()=>{calls.push('check')},removeFile:async id=>{assert.equal(id,'drive-id');assert.ok(await db.speakingRecordings.get(row.id));calls.push('file')},removeMetadata:async()=>{assert.equal((await db.speakingRecordings.get(row.id)).deletion,'driveDeleted');calls.push('metadata')}},db)
  assert.deepEqual(calls,['check','file','metadata'])
  assert.equal(await db.speakingRecordings.get(row.id),undefined)
 }finally{await db.delete()}
})

test('preflight or Drive failure preserves local file and metadata for retry',async()=>{
 const db=new VocabDatabase('delete-'+crypto.randomUUID())
 try{
  await db.speakingRecordings.add(row)
  let files=0,metadata=0
  await assert.rejects(()=>removeSpeakingRecording(row,{check:async()=>{throw new Error('missing migration')},removeFile:async()=>{files++},removeMetadata:async()=>{metadata++}},db))
  assert.equal(files,0);assert.equal(metadata,0)
  await assert.rejects(()=>removeSpeakingRecording(row,{check:async()=>{},removeFile:async()=>{throw new Error('Drive denied')},removeMetadata:async()=>{metadata++}},db))
  assert.equal(metadata,0)
  assert.equal((await db.speakingRecordings.get(row.id)).deletion,'requested')
  assert.equal(await(await db.speakingRecordings.get(row.id)).audio.text(),'hi')
 }finally{await db.delete()}
})

test('metadata retry after a successful Drive deletion does not delete Drive twice',async()=>{
 const db=new VocabDatabase('delete-'+crypto.randomUUID())
 try{
  await db.speakingRecordings.add(row)
  let files=0
  await assert.rejects(()=>removeSpeakingRecording(row,{check:async()=>{},removeFile:async()=>{files++},removeMetadata:async()=>{throw new Error('network lost')}},db))
  assert.equal((await db.speakingRecordings.get(row.id)).deletion,'driveDeleted')
  db.close();await db.open()
  await removeSpeakingRecording(row,{check:async()=>{},removeFile:async()=>{files++},removeMetadata:async()=>{}},db)
  assert.equal(files,1)
  assert.equal(await db.speakingRecordings.count(),0)
 }finally{await db.delete()}
})
