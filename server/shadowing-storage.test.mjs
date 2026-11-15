import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const read=p=>readFileSync(new URL('../src/lib/'+p+'.ts',import.meta.url),'utf8')
const url=s=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s)).toString('base64')
const dbUrl=url(read('db').replace("'dexie'",JSON.stringify(import.meta.resolve('dexie'))))
const {VocabDatabase}=await import(dbUrl)
const {saveShadowingFolder,saveShadowingLesson,lessonForRecording,shadowingHtml,confirmShadowingMatches}=await import(url(read('shadowing-storage').replace("'./db'",JSON.stringify(dbUrl))))

test('shadowing folders create, rename and prevent duplicate names and owner changes',async()=>{
 const db=new VocabDatabase('shadowing-'+crypto.randomUUID())
 try{
  const folder=await saveShadowingFolder('a',' Work ',undefined,db)
  assert.equal(folder.name,'Work');assert.equal(folder.metadataSynced,false)
  await assert.rejects(()=>saveShadowingFolder('a','work',undefined,db),/tồn tại/)
  await assert.rejects(()=>saveShadowingFolder('b','Other',folder.id,db),/quyền/)
  const renamed=await saveShadowingFolder('a','Travel',folder.id,db)
  assert.equal(renamed.id,folder.id)
  assert.equal(await db.shadowingFolders.count(),1)
 }finally{await db.delete()}
})

test('one lesson groups multiple recordings and moving folders preserves those attempts',async()=>{
 const db=new VocabDatabase('shadowing-'+crypto.randomUUID())
 try{
  const a=await saveShadowingFolder('a','Work',undefined,db),b=await saveShadowingFolder('a','Travel',undefined,db)
  const lesson=await saveShadowingLesson({id:'lesson',ownerId:'a',folderId:a.id,title:' Hello ',referenceText:' Hello world. ',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},db)
  for(const id of ['take-1','take-2'])await db.speakingRecordings.add({id,lessonId:lesson.id,title:lesson.title,referenceText:lesson.referenceText,createdAt:new Date().toISOString(),durationSeconds:2,mimeType:'audio/webm',size:2,audio:new Blob(['hi'],{type:'audio/webm'})})
  await saveShadowingLesson({...lesson,folderId:b.id},db)
  assert.equal(await db.shadowingLessons.count(),1)
  assert.equal((await db.shadowingLessons.get('lesson')).folderId,b.id)
  assert.equal(await db.speakingRecordings.where('lessonId').equals('lesson').count(),2)
  assert.equal((await db.speakingRecordings.get('take-1')).referenceText,'Hello world.')
  assert.equal(lessonForRecording(await db.speakingRecordings.get('take-1'),await db.shadowingLessons.toArray(),'a').folderId,b.id)
 }finally{await db.delete()}
})

test('new lessons require an owned folder and legacy recordings remain addressable',async()=>{
 const db=new VocabDatabase('shadowing-'+crypto.randomUUID())
 try{
  const row={id:'lesson',ownerId:'a',folderId:'missing',title:'Read',referenceText:'Hello',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}
  await assert.rejects(()=>saveShadowingLesson(row,db))
  const folder=await saveShadowingFolder('b','Other owner',undefined,db)
  await assert.rejects(()=>saveShadowingLesson({...row,folderId:folder.id},db))
  assert.equal(await db.shadowingLessons.count(),0)
  const legacy=lessonForRecording({id:'old-recording',title:'Old',referenceText:'Hello',createdAt:row.createdAt},[],'a')
  assert.equal(legacy.id,'old-recording')
  assert.equal(legacy.folderId,'')
  assert.equal(legacy.referenceText,'Hello')
 }finally{await db.delete()}
})

test('editing lesson text clears detection and preserves original recording text; confirmations reject stale results',async()=>{
 const db=new VocabDatabase('shadowing-'+crypto.randomUUID())
 try{
  const folder=await saveShadowingFolder('a','Work',undefined,db)
  const lesson=await saveShadowingLesson({id:'lesson',ownerId:'a',folderId:folder.id,title:'Read',referenceText:'Hello world.',createdAt:'2026-01-01',updatedAt:'2026-01-01'},db)
  const html=shadowingHtml(lesson.referenceText)
  assert.equal(shadowingHtml('<script>& hello'),'<p>&lt;script&gt;&amp; hello</p>')
  await db.notes.put({id:'note',kind:'basic',front:'world',back:'Meaning',createdAt:0})
  await db.speakingRecordings.add({id:'take',lessonId:lesson.id,referenceText:lesson.referenceText})
  const detection={html,matches:[],createdAt:'2026-01-02'}
  const detected=await saveShadowingLesson({...lesson,detection},db)
  const moved=await saveShadowingLesson({...detected,title:'Renamed'},db)
  assert.deepEqual(moved.detection,detection)
  const confirmed=await confirmShadowingMatches(lesson.id,'a',detection,[{start:7,end:12,noteId:'note',word:'world'}],db)
  assert.equal(confirmed.detection.matches[0].confirmed,true)
  await assert.rejects(()=>confirmShadowingMatches(lesson.id,'a',detection,[],db),/thay đổi/)
  await assert.rejects(()=>confirmShadowingMatches(lesson.id,'b',confirmed.detection,[],db),/quyền/)
  const edited=await saveShadowingLesson({...confirmed,referenceText:'A new passage.'},db)
  assert.equal(edited.detection,undefined)
  assert.equal((await db.speakingRecordings.get('take')).referenceText,'Hello world.')
 }finally{await db.delete()}
})


test('cloud JSON key ordering does not invalidate an open shadowing confirmation',async()=>{
 const db=new VocabDatabase('shadowing-json-order-'+crypto.randomUUID())
 try{
  const folder=await saveShadowingFolder('a','Work',undefined,db)
  const lesson=await saveShadowingLesson({id:'lesson',ownerId:'a',folderId:folder.id,title:'Sunday',referenceText:'They come on Sundays.',createdAt:'2026-01-01',updatedAt:'2026-01-01'},db)
  await db.notes.put({id:'sunday',kind:'basic',front:'Sunday',back:'Chủ Nhật',createdAt:0})
  const detection={html:shadowingHtml(lesson.referenceText),matches:[{start:6,end:10,noteId:'irregular:come',word:'come',context:'They come on Sundays.'}],createdAt:'2026-01-02',suggestions:[{word:'Sundays'}]}
  const saved=await saveShadowingLesson({...lesson,detection},db)
  const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,value])=>[key,reorder(value)])):value
  const cloud=reorder(saved.detection)
  assert.notEqual(JSON.stringify(cloud),JSON.stringify(saved.detection))
  await db.shadowingLessons.update(lesson.id,{detection:cloud,metadataSynced:true})
  const confirmed=await confirmShadowingMatches(lesson.id,'a',saved.detection,[{start:14,end:21,noteId:'sunday',word:'Sunday'}],db)
  assert.equal(confirmed.detection.matches.length,2)
  assert.equal(confirmed.detection.matches[1].confirmed,true)
  assert.equal(confirmed.metadataSynced,false)
  await assert.rejects(()=>confirmShadowingMatches(lesson.id,'a',saved.detection,[],db),/thay đổi/)
 }finally{await db.delete()}
})
