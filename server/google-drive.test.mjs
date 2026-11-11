import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const read=p=>readFileSync(new URL('../src/lib/'+p+'.ts',import.meta.url),'utf8')
const url=s=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s)).toString('base64')
const speakingUrl=url(read('speaking'))
const {driveSignInOptions,validateAudio,recordingPayload}=await import(speakingUrl)
const {checkDrive,uploadRecording,downloadRecording,deleteDriveRecording,DriveError}=await import(url(read('google-drive').replace("'./speaking'",JSON.stringify(speakingUrl))))
const json=(data,options={})=>new Response(JSON.stringify(data),{...options,headers:{'Content-Type':'application/json',...options.headers}})
const record={id:'record-1',title:'Practice',referenceText:'Hello world.',createdAt:'2026-11-11T00:00:00Z',durationSeconds:10,mimeType:'audio/webm',size:5,audio:new Blob(['voice'],{type:'audio/webm'})}

test('Drive consent uses file-only scope and returns to Speaking',()=>{
 const config=driveSignInOptions('http://localhost:5173')
 assert.equal(config.options.redirectTo,'http://localhost:5173/speaking')
 assert.ok(config.options.scopes.includes('https://www.googleapis.com/auth/drive.file'))
 assert.equal(config.options.scopes.includes('drive.readonly'),false)
 assert.ok(config.options.queryParams.prompt.includes('consent'))
 assert.throws(()=>driveSignInOptions('file:///tmp'))
})

test('audio validation and metadata never include audio blobs or OAuth credentials',()=>{
 validateAudio(record.audio)
 assert.throws(()=>validateAudio(new Blob([],{type:'audio/webm'})))
 assert.throws(()=>validateAudio(new Blob(['html'],{type:'text/html'})))
 assert.throws(()=>recordingPayload(record,'owner'))
 const payload=recordingPayload({...record,driveFileId:'file-id'},'owner')
 assert.equal(payload.user_id,'owner')
 assert.equal(payload.drive_file_id,'file-id')
 assert.equal('audio' in payload,false)
 assert.equal('provider_token' in payload,false)
})

test('resumable upload sends private app-tagged metadata and binary audio',async()=>{
 const calls=[]
 const id=await uploadRecording('secret',record,async(uri,options)=>{
  const parsed=new URL(uri);calls.push({parsed,options})
  assert.equal(options.headers.Authorization,'Bearer secret')
  if(calls.length===1)return json({files:[]})
  if(calls.length===2)return json({files:[{id:'folder',name:'Speaking'}]})
  if(calls.length===3){
   const metadata=JSON.parse(options.body)
   assert.deepEqual(metadata.parents,['folder'])
   assert.equal(metadata.appProperties.recordingId,record.id)
   assert.equal('permissions' in metadata,false)
   return new Response('',{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=123'}})
  }
  assert.equal(options.method,'PUT')
  assert.equal(options.body,record.audio)
  return json({id:'voice-file'})
 })
 assert.equal(id,'voice-file')
 assert.equal(calls.length,4)
})

test('retry reuses an already uploaded recording instead of creating duplicates',async()=>{
 let calls=0
 const id=await uploadRecording('token',record,async()=>{calls++;return json({files:[{id:'existing',name:'Practice'}]})})
 assert.equal(id,'existing');assert.equal(calls,1)
})

test('expired or insufficient permissions request reconnection',async()=>{
 await assert.rejects(()=>checkDrive('expired',async()=>new Response('',{status:401})),error=>error instanceof DriveError&&error.reconnect)
 await assert.rejects(()=>checkDrive('',async()=>{throw new Error('No request expected')}),error=>error.reconnect)
})

test('upload refuses to send OAuth credentials to an unexpected upload host',async()=>{
 let calls=0
 await assert.rejects(()=>uploadRecording('secret',record,async()=>{
  calls++
  if(calls===1)return json({files:[]})
  if(calls===2)return json({files:[{id:'folder'}]})
  return new Response('',{headers:{Location:'https://untrusted.example/upload'}})
 }),/không hợp lệ/)
 assert.equal(calls,3)
})

test('private file playback uses authorized media download',async()=>{
 const audio=await downloadRecording('token','voice-file',async(uri,options)=>{
  assert.equal(new URL(uri).searchParams.get('alt'),'media')
  assert.equal(options.headers.Authorization,'Bearer token')
  return new Response(record.audio,{headers:{'Content-Type':'audio/webm'}})
 })
 assert.equal(await audio.text(),'voice')
})

test('adding the recordings table preserves vocabulary and stores account-isolated audio blobs',async()=>{
 await import('fake-indexeddb/auto')
 const {default:Dexie}=await import('dexie')
 const {VocabDatabase}=await import(url(read('db').replace("'dexie'",JSON.stringify(import.meta.resolve('dexie')))))
 const name='speaking-upgrade-'+crypto.randomUUID()
 const legacy=new Dexie(name)
 legacy.version(1).stores({notes:'id, kind, createdAt, folderId',templates:'id, name',folders:'id, nameKey, createdAt',reviews:'id, noteId, due, state',reviewLogs:'id, cardId, noteId',syncRows:'key, table, id'})
 legacy.version(2).stores({syncMeta:'id',syncBackups:'id, createdAt'})
 await legacy.table('notes').put({id:'existing',front:'keep vocabulary'})
 legacy.close()
 const a=new VocabDatabase(name)
 const b=new VocabDatabase(name+'-other-account')
 try{
  await a.open()
  assert.equal((await a.notes.get('existing')).front,'keep vocabulary')
  await a.speakingRecordings.add(record)
  assert.equal(await b.speakingRecordings.count(),0)
  a.close();await a.open()
  const restored=await a.speakingRecordings.get(record.id)
  assert.equal(await restored.audio.text(),'voice')
  assert.equal(restored.title,'Practice')
 }finally{await a.delete();await b.delete()}
})

test('Drive connection in Settings returns to Settings and rejects arbitrary redirects',()=>{
 assert.equal(driveSignInOptions('https://vocab.example.com','/settings').options.redirectTo,'https://vocab.example.com/settings')
 assert.throws(()=>driveSignInOptions('https://vocab.example.com','//untrusted.example'))
})

test('Drive distinguishes disabled API, missing scope, expired token and storage quota',async()=>{
 for(const [status,body,expected,reconnect] of [
  [403,{error:{details:[{reason:'SERVICE_DISABLED',metadata:{consumer:'projects/12345'}}]}},/API chưa được bật \(project 12345\)/,false],
  [403,{error:{errors:[{reason:'insufficientPermissions'}]}},/thiếu quyền drive.file/,true],
  [401,{error:{}},/đã hết hạn/,true],
  [403,{error:{errors:[{reason:'storageQuotaExceeded'}]}},/hết dung lượng/,false],
 ]){
  await assert.rejects(()=>checkDrive('token',async()=>json(body,{status})),error=>expected.test(error.message)&&error.reconnect===reconnect)
 }
})

test('Drive recording deletion uses authorized permanent DELETE and surfaces access errors',async()=>{
 await deleteDriveRecording('token','voice-file',async(uri,options)=>{
  assert.equal(new URL(uri).pathname,'/drive/v3/files/voice-file')
  assert.equal(options.method,'DELETE')
  assert.equal(options.headers.Authorization,'Bearer token')
  return new Response(null,{status:204})
 })
 await assert.rejects(()=>deleteDriveRecording('token','voice-file',async()=>new Response('',{status:403})))
})
