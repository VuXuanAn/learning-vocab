import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {PGlite} from '@electric-sql/pglite'
const read=p=>readFileSync('src/lib/'+p+'.ts','utf8')
const url=source=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64')
const dbUrl=url(read('db').replace("'dexie'",JSON.stringify(import.meta.resolve('dexie'))))
const {VocabDatabase}=await import(dbUrl)
const sourceUrl=url(read('reading-sources').replace("'zod'",JSON.stringify(import.meta.resolve('zod'))))
const {readingSources}=await import(sourceUrl)
const {saveReadingArticle,saveReadingFolder,saveReadingStudyNote,saveReadingTranslation,editReadingTranslation,confirmReadingMatches}=await import(url(read('reading-storage').replace("'./db'",JSON.stringify(dbUrl)).replace("'zod'",JSON.stringify(import.meta.resolve('zod'))).replace("'./reading-sources'",JSON.stringify(sourceUrl))))
test('Reading storage requires owned folder, preserves note and clears detected links only when content changes',async()=>{
 const db=new VocabDatabase('reading-test-'+crypto.randomUUID()),now=new Date().toISOString()
 try{
  const folder={id:crypto.randomUUID(),ownerId:'owner',name:'Science',createdAt:now,updatedAt:now}
  await saveReadingFolder(folder,db)
  await assert.rejects(()=>saveReadingFolder({...folder,id:crypto.randomUUID(),name:'science'},db))
  const article={id:crypto.randomUUID(),ownerId:'owner',folderId:folder.id,title:'Article',contentHtml:'<p>Hello</p>',note:'My note',createdAt:now,updatedAt:now}
  await assert.rejects(()=>saveReadingArticle({...article,ownerId:'other'},db))
  const saved=await saveReadingArticle(article,db)
  const detection={html:article.contentHtml,matches:[{start:1,end:6,noteId:'note',word:'Hello'}],createdAt:now}
  const detected=await saveReadingArticle({...saved,detection},db)
  const editedNote=await saveReadingArticle({...detected,note:'New note'},db)
  assert.deepEqual(editedNote.detection,detection)
  const editedContent=await saveReadingArticle({...editedNote,contentHtml:'<p>Changed</p>'},db)
  assert.equal(editedContent.detection,undefined);assert.equal(editedContent.note,'New note')
  const removed=await saveReadingArticle({...editedContent,deletedAt:now},db)
  assert.equal(removed.deletedAt,now);assert.equal(removed.metadataSynced,false)
 }finally{await db.delete()}
})

test('Reference detections persist in article JSON without creating vocabulary or review records',async()=>{
 const db=new VocabDatabase('reading-reference-'+crypto.randomUUID()),now=new Date().toISOString()
 try{
  const folder={id:crypto.randomUUID(),ownerId:'owner',name:'Reference',createdAt:now,updatedAt:now}
  await saveReadingFolder(folder,db)
  const article=await saveReadingArticle({id:crypto.randomUUID(),ownerId:'owner',folderId:folder.id,title:'Reference',contentHtml:'<p>begun</p>',note:'',createdAt:now,updatedAt:now},db)
  const detection={html:article.contentHtml,createdAt:now,matches:[{start:1,end:6,noteId:'irregular:begin',word:'begun'}]}
  await saveReadingArticle({...article,detection},db)
  assert.deepEqual((await db.readingArticles.get(article.id)).detection,detection)
  assert.equal(await db.notes.count(),0)
  assert.equal(await db.reviews.count(),0)
 }finally{await db.delete()}
})
test('Reading SQL migration can rerun and isolates accounts for reads, writes and folder ownership',async()=>{
 const db=new PGlite(),a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',folder='10000000-0000-0000-0000-000000000001',article='20000000-0000-0000-0000-000000000001'
 async function actor(id){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`)}
 try{
  await db.exec(`create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${a}'),('${b}');`)
  const migration=readFileSync('supabase/migrations/011_reading_library.sql','utf8');await db.exec(migration);await db.exec(migration)
  await actor(a)
  await db.exec(`insert into reading_folders(id,owner_id,data) values('${folder}','${a}','{}');insert into reading_articles(id,owner_id,folder_id,data) values('${article}','${a}','${folder}','{}')`)
  await db.exec(`update reading_articles set data='{"note":"Legacy grammar note","createdAt":"2026-11-11T00:00:00Z"}' where id='${article}'`)
  await db.exec('reset role')
  const studyMigration=readFileSync('supabase/migrations/012_reading_study_notes.sql','utf8');await db.exec(studyMigration);await db.exec(studyMigration)
  await actor(a)
  assert.equal((await db.query('select count(*)::int as n from reading_study_notes')).rows[0].n,1)
  assert.equal((await db.query('select data from reading_study_notes')).rows[0].data.content,'Legacy grammar note')
  await db.exec(`insert into reading_study_notes(id,owner_id,article_id,note_type,data) values(gen_random_uuid(),'${a}','${article}','grammar','{}')`)
  await actor(b)
  assert.equal((await db.query('select * from reading_study_notes')).rows.length,0)
  await assert.rejects(()=>db.exec(`insert into reading_study_notes(id,owner_id,article_id,note_type,data) values(gen_random_uuid(),'${b}','${article}','grammar','{}')`))
  await assert.rejects(()=>db.exec(`insert into reading_study_notes(id,owner_id,article_id,note_type,data) values(gen_random_uuid(),'${a}','${article}','grammar','{}')`))
  assert.equal((await db.query('select * from reading_articles')).rows.length,0)
  assert.equal((await db.query('select * from reading_folders')).rows.length,0)
  assert.equal((await db.query(`update reading_articles set data='{}' returning id`)).rows.length,0)
  await assert.rejects(()=>db.exec(`insert into reading_articles(id,owner_id,folder_id,data) values(gen_random_uuid(),'${a}','${folder}','{}')`))
  await assert.rejects(()=>db.exec(`insert into reading_articles(id,owner_id,folder_id,data) values(gen_random_uuid(),'${b}','${folder}','{}')`))
  await actor(a)
  await db.exec(`update reading_articles set deleted_at=now() where id='${article}'`)
  assert.ok((await db.query(`select deleted_at from reading_articles where id='${article}'`)).rows[0].deleted_at)
 }finally{await db.close()}
})

test('Study notes are separate typed records, validate ownership and cascade soft deletion with the article',async()=>{
 const db=new VocabDatabase('study-notes-'+crypto.randomUUID()),now=new Date().toISOString()
 try{
  const folder={id:crypto.randomUUID(),ownerId:'owner',name:'Reading',createdAt:now,updatedAt:now}
  await saveReadingFolder(folder,db)
  const article=await saveReadingArticle({id:crypto.randomUUID(),ownerId:'owner',folderId:folder.id,title:'Reading',contentHtml:'<p>If I were you…</p>',note:'',createdAt:now,updatedAt:now},db)
  const first={id:crypto.randomUUID(),ownerId:'owner',articleId:article.id,type:'grammar',title:'Second conditional',content:'If + past, would + verb',sourceQuote:'If I were you',createdAt:now,updatedAt:now}
  await saveReadingStudyNote(first,db)
  await saveReadingStudyNote({...first,id:crypto.randomUUID(),type:'sentence_structure',title:'Sentence pattern'},db)
  assert.equal(await db.readingStudyNotes.count(),2)
  assert.equal((await db.readingArticles.get(article.id)).note,'')
  assert.equal((await db.readingArticles.get(article.id)).updatedAt,article.updatedAt)
  await assert.rejects(()=>saveReadingStudyNote({...first,id:crypto.randomUUID(),ownerId:'outsider'},db))
  await assert.rejects(()=>saveReadingStudyNote({...first,id:crypto.randomUUID(),type:'invalid'},db))
  await saveReadingArticle({...article,deletedAt:now},db)
  assert.ok((await db.readingStudyNotes.toArray()).every(note=>note.deletedAt===now&&!note.metadataSynced))
  await assert.rejects(()=>saveReadingStudyNote({...first,id:crypto.randomUUID()},db))
 }finally{await db.delete()}
})
import Dexie from 'dexie'
test('Upgrading local Reading data preserves long legacy notes as separate records',async()=>{
 const name='legacy-study-'+crypto.randomUUID(),id=crypto.randomUUID(),now=new Date().toISOString()
 const legacy=new Dexie(name)
 legacy.version(5).stores({readingArticles:'id, ownerId, folderId, createdAt'})
 await legacy.table('readingArticles').put({id,ownerId:'owner',folderId:crypto.randomUUID(),title:'Legacy',contentHtml:'Text',note:'x'.repeat(30000),createdAt:now,updatedAt:now})
 legacy.close()
 const upgraded=new VocabDatabase(name)
 try{
  const note=await upgraded.readingStudyNotes.get(id)
  assert.equal(note.content.length,30000);assert.equal(note.type,'other');assert.equal(note.articleId,id);assert.equal(note.metadataSynced,false)
  upgraded.close();await upgraded.open()
  assert.equal(await upgraded.readingStudyNotes.count(),1)
 }finally{await upgraded.delete()}
})

test('Detection updates vocabulary backlinks atomically, preserves other sources and syncs through existing note fields',async()=>{
 const db=new VocabDatabase('reading-sources-'+crypto.randomUUID()),now=new Date().toISOString()
 try{
  const folder=await saveReadingFolder({id:crypto.randomUUID(),ownerId:'owner',name:'Reading',createdAt:now,updatedAt:now},db)
  const vocabFolder=crypto.randomUUID(),noteId=crypto.randomUUID()
  await db.folders.put({id:vocabFolder,name:'Vocab',nameKey:'vocab',createdAt:Date.now(),permission:'owner'})
  const note={id:noteId,kind:'basic',front:'success',back:'thành công',extra:'Keep this',tags:'test',createdAt:Date.now(),folderId:vocabFolder,values:{custom:'Preserved'}}
  await db.notes.put(note)
  const make=async title=>saveReadingArticle({id:crypto.randomUUID(),ownerId:'owner',folderId:folder.id,title,contentHtml:'success success',note:'',createdAt:now,updatedAt:now},db)
  const detect=async article=>saveReadingArticle({...article,detection:{html:article.contentHtml,createdAt:now,matches:[{start:0,end:7,noteId,word:'success',context:'A story about success'},{start:8,end:15,noteId,word:'success'}]}},db)
  let first=await detect(await make('First source')),second=await detect(await make('Second source'))
  await detect(first)
  let saved=await db.notes.get(noteId),sources=readingSources(saved)
  assert.equal(sources.length,2);assert.equal(sources[0].occurrences,2);assert.equal(saved.values.custom,'Preserved');assert.equal(saved.extra,note.extra);assert.equal(saved.back,note.back)
  first=await saveReadingArticle({...first,title:'Renamed source'},db)
  assert.equal(readingSources(await db.notes.get(noteId)).find(source=>source.articleId===first.id).title,'Renamed source')
  const {encodeRow,decodeRow}=await import(url(read('row-codec')))
  saved=await db.notes.get(noteId)
  const restored=decodeRow('notes',{id:noteId,created_at:now,...encodeRow('notes',saved)})
  assert.deepEqual(readingSources(restored),readingSources(saved))
  await saveReadingArticle({...first,contentHtml:'Changed'},db)
  sources=readingSources(await db.notes.get(noteId));assert.equal(sources.length,1);assert.equal(sources[0].articleId,second.id)
  await saveReadingArticle({...second,deletedAt:now},db)
  assert.equal(readingSources(await db.notes.get(noteId)).length,0)
 }finally{await db.delete()}
})
test('Detection never edits read-only vocabulary',async()=>{
 const db=new VocabDatabase('reading-viewer-'+crypto.randomUUID()),now=new Date().toISOString()
 try{
  const folder=await saveReadingFolder({id:crypto.randomUUID(),ownerId:'owner',name:'Reading',createdAt:now,updatedAt:now},db)
  const id=crypto.randomUUID();await db.notes.put({id,kind:'basic',front:'word',back:'nghĩa',extra:'',tags:'',createdAt:0,readOnly:true})
  const article=await saveReadingArticle({id:crypto.randomUUID(),ownerId:'owner',folderId:folder.id,title:'Read',contentHtml:'word',note:'',createdAt:now,updatedAt:now},db)
  await saveReadingArticle({...article,detection:{html:'word',createdAt:now,matches:[{start:0,end:4,noteId:id,word:'word'}]}},db)
  assert.equal(readingSources(await db.notes.get(id)).length,0)
 }finally{await db.delete()}
})

test('Translation persists with article JSON, preserves concurrent detection and rejects stale source or ownership',async()=>{
 const db=new VocabDatabase('reading-translation-'+crypto.randomUUID()),now=new Date().toISOString()
 try{
  const folder=await saveReadingFolder({id:crypto.randomUUID(),ownerId:'owner',name:'Translation',createdAt:now,updatedAt:now},db)
  const article=await saveReadingArticle({id:crypto.randomUUID(),ownerId:'owner',folderId:folder.id,title:'Read',contentHtml:'<p>Hello</p>',note:'',createdAt:now,updatedAt:now},db)
  const detection={html:article.contentHtml,matches:[],createdAt:now}
  await saveReadingArticle({...article,detection},db)
  const saved=await saveReadingTranslation(article.id,'owner',article.contentHtml,'Xin chào',db)
  assert.equal(saved.translation.text,'Xin chào');assert.deepEqual(saved.detection,detection);assert.equal(saved.metadataSynced,false)
  assert.equal((await db.readingArticles.get(article.id)).translation.text,'Xin chào')
  await assert.rejects(()=>saveReadingTranslation(article.id,'other',article.contentHtml,'Sai',db))
  const renamed=await saveReadingArticle({...saved,title:'Renamed'},db)
  assert.equal(renamed.translation.text,'Xin chào')
  const edited=await saveReadingArticle({...renamed,contentHtml:'<p>Changed</p>'},db)
  assert.equal(edited.translation,undefined)
  await assert.rejects(()=>saveReadingTranslation(article.id,'owner',article.contentHtml,'Cũ',db))
  await saveReadingArticle({...edited,deletedAt:now},db)
  await assert.rejects(()=>saveReadingTranslation(article.id,'owner',edited.contentHtml,'Mới',db))
 }finally{await db.delete()}
})

test('Manual translation edits preserve line breaks and reject overwriting newer translations',async()=>{
 const db=new VocabDatabase('reading-edit-translation-'+crypto.randomUUID()),now=new Date().toISOString()
 try{
  const folder=await saveReadingFolder({id:crypto.randomUUID(),ownerId:'owner',name:'Edit',createdAt:now,updatedAt:now},db)
  const article=await saveReadingArticle({id:crypto.randomUUID(),ownerId:'owner',folderId:folder.id,title:'Read',contentHtml:'<p>Hello</p>',note:'',createdAt:now,updatedAt:now},db)
  const translated=await saveReadingTranslation(article.id,'owner',article.contentHtml,'Bản dịch AI',db)
  const text='Đoạn đầu đã sửa.\nXuống dòng.\n\nĐoạn mới.'
  const edited=await editReadingTranslation(translated,text,db)
  assert.equal(edited.translation.text,text)
  assert.equal((await db.readingArticles.get(article.id)).translation.text,text)
  assert.equal(edited.metadataSynced,false)
  await assert.rejects(()=>editReadingTranslation(translated,'Ghi đè cũ',db),/Bản dịch đã thay đổi/)
  await assert.rejects(()=>editReadingTranslation(edited,'   ',db))
  assert.equal((await db.readingArticles.get(article.id)).translation.text,text)
  await saveReadingArticle({...edited,contentHtml:'<p>Changed</p>'},db)
  await assert.rejects(()=>editReadingTranslation(edited,'Nội dung cũ',db),/Nội dung bài đã thay đổi/)
 }finally{await db.delete()}
})

test('Confirmed near matches persist, update backlinks and reject stale scans or missing cards',async()=>{
 const db=new VocabDatabase('reading-confirm-'+crypto.randomUUID()),now=new Date().toISOString()
 try{
  const folder=await saveReadingFolder({id:crypto.randomUUID(),ownerId:'owner',name:'Confirm',createdAt:now,updatedAt:now},db)
  const noteId=crypto.randomUUID()
  await db.notes.put({id:noteId,kind:'basic',front:'pinpoint',back:'xác định',extra:'',tags:'',createdAt:0})
  const article=await saveReadingArticle({id:crypto.randomUUID(),ownerId:'owner',folderId:folder.id,title:'Near match',contentHtml:'pinpointing',note:'',createdAt:now,updatedAt:now},db)
  const scanned=await saveReadingArticle({...article,detection:{html:article.contentHtml,matches:[],createdAt:now}},db)
  const confirmed=[{start:0,end:11,noteId,word:'pinpoint',context:'pinpointing'}]
  await assert.rejects(()=>confirmReadingMatches(article.id,'other',scanned.detection,confirmed,db))
  await assert.rejects(()=>confirmReadingMatches(article.id,'owner',scanned.detection,[{...confirmed[0],noteId:'missing'}],db))
  const saved=await confirmReadingMatches(article.id,'owner',scanned.detection,confirmed,db)
  assert.equal(saved.detection.matches[0].confirmed,true)
  assert.equal(saved.detection.matches[0].word,'pinpoint')
  assert.equal(saved.metadataSynced,false)
  assert.equal(readingSources(await db.notes.get(noteId))[0].articleId,article.id)
  await assert.rejects(()=>confirmReadingMatches(article.id,'owner',scanned.detection,confirmed,db),/Kết quả dò đã thay đổi/)
  await saveReadingArticle({...saved,contentHtml:'Edited'},db)
  await assert.rejects(()=>confirmReadingMatches(article.id,'owner',saved.detection,confirmed,db))
 }finally{await db.delete()}
})
