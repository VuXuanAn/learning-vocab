import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import Dexie from 'dexie'
const url=source=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64')
const dbUrl=url(readFileSync('src/lib/db.ts','utf8').replace("'dexie'",JSON.stringify(import.meta.resolve('dexie'))))
const {VocabDatabase}=await import(dbUrl)
const {saveGrammarEntry,deleteGrammarEntry,saveGrammarFolder,deleteGrammarFolder}=await import(url(readFileSync('src/lib/grammar-storage.ts','utf8').replace("'./db'",JSON.stringify(dbUrl)).replace("'zod'",JSON.stringify(import.meta.resolve('zod')))))
const now=()=>new Date().toISOString()
const folderRow=(ownerId='owner')=>({id:crypto.randomUUID(),ownerId,name:'Grammar',nameKey:'grammar',createdAt:now(),updatedAt:now()})
const entryRow=folder=>({id:crypto.randomUUID(),ownerId:folder.ownerId,folderId:folder.id,title:'My grammar',topic:'',structure:'S + V',usage:'Cách dùng',example:'An example.',translation:'Ví dụ.',notes:'My notes',status:'review',createdAt:now(),updatedAt:now()})
test('Grammar starts empty and persists user content, line breaks and account isolation',async()=>{
 const a=new VocabDatabase('grammar-a-'+crypto.randomUUID()),b=new VocabDatabase('grammar-b-'+crypto.randomUUID())
 try{
  assert.equal(await a.grammarEntries.count(),0);assert.equal(await a.grammarFolders.count(),0)
  const folder=await saveGrammarFolder(folderRow('a'),a)
  const row=await saveGrammarEntry({...entryRow(folder),structure:'S + V\n\nSecond line'},a)
  assert.equal(row.structure,'S + V\n\nSecond line')
  await assert.rejects(()=>saveGrammarEntry({...row,title:'  '},a))
  await assert.rejects(()=>saveGrammarEntry({...row,ownerId:'other'},a))
  await assert.rejects(()=>deleteGrammarEntry({...row,ownerId:'other'},a))
  await assert.rejects(()=>saveGrammarEntry({...row,updatedAt:'old'},a))
  a.close();await a.open()
  assert.equal((await a.grammarEntries.get(row.id)).notes,'My notes')
  assert.equal(await b.grammarEntries.count(),0);assert.equal(await b.grammarFolders.count(),0)
  await deleteGrammarEntry(row,a)
  a.close();await a.open()
  assert.equal(await a.grammarEntries.count(),0)
 }finally{await a.delete();await b.delete()}
})
test('Upgrading pre-folder Grammar preserves real structures in an owned default folder',async()=>{
 const name='grammar-upgrade-'+crypto.randomUUID(),legacy=new Dexie(name),timestamp=now()
 legacy.version(8).stores({grammarEntries:'id, ownerId, topic, status, createdAt',syncMeta:'id'})
 const id=crypto.randomUUID()
 await legacy.table('grammarEntries').put({id,ownerId:'owner',title:'My grammar',structure:'S + V',notes:'Keep my notes',createdAt:timestamp,updatedAt:timestamp})
 legacy.close()
 const db=new VocabDatabase(name)
 try{
  const entry=await db.grammarEntries.get(id),folder=await db.grammarFolders.get(entry.folderId)
  assert.equal(entry.notes,'Keep my notes');assert.equal(entry.updatedAt,timestamp)
  assert.equal(folder.ownerId,'owner');assert.equal(folder.name,'Ngữ pháp của tôi')
  db.close();await db.open()
  assert.equal(await db.grammarFolders.count(),1)
 }finally{await db.delete()}
})
test('Upgrade removes mock Grammar and its empty auto-folder while preserving real entries and folders',async()=>{
 const name='grammar-cleanup-'+crypto.randomUUID(),legacy=new Dexie(name)
 legacy.version(9).stores({grammarEntries:'id, ownerId, folderId',grammarFolders:'id, ownerId, nameKey',syncMeta:'id'})
 const sampleFolder={...folderRow(),name:'Ngữ pháp của tôi',nameKey:'ngữ pháp của tôi'},realFolder=folderRow(),mixedFolder={...folderRow(),ownerId:'mixed',name:'Ngữ pháp của tôi',nameKey:'ngữ pháp của tôi'}
 await legacy.table('grammarFolders').bulkPut([sampleFolder,realFolder,mixedFolder])
 const real=entryRow(realFolder),mixedReal=entryRow(mixedFolder)
 await legacy.table('grammarEntries').bulkPut([{...entryRow(sampleFolder),isExample:true},{...entryRow(mixedFolder),isExample:true},real,mixedReal])
 await legacy.table('syncMeta').bulkPut([{id:'grammar-examples-v1-owner',lastSyncAt:now(),mode:'grammar-examples'},{id:'current',lastSyncAt:now(),mode:'merge'}])
 legacy.close()
 const db=new VocabDatabase(name)
 try{
  assert.equal(await db.grammarEntries.count(),2)
  assert.equal((await db.grammarEntries.get(real.id)).notes,real.notes)
  assert.equal((await db.grammarEntries.get(mixedReal.id)).notes,mixedReal.notes)
  assert.equal(await db.grammarFolders.get(sampleFolder.id),undefined)
  assert.ok(await db.grammarFolders.get(realFolder.id));assert.ok(await db.grammarFolders.get(mixedFolder.id))
  assert.equal(await db.syncMeta.get('grammar-examples-v1-owner'),undefined)
  assert.ok(await db.syncMeta.get('current'))
  db.close();await db.open()
  assert.equal(await db.grammarEntries.count(),2)
 }finally{await db.delete()}
})
test('Grammar folders validate names and ownership, move entries and only delete empty folders',async()=>{
 const db=new VocabDatabase('grammar-folders-'+crypto.randomUUID())
 try{
  const original=await saveGrammarFolder(folderRow(),db),entry=await saveGrammarEntry(entryRow(original),db)
  const folder=await saveGrammarFolder({...folderRow(),name:'  Tenses  '},db)
  assert.equal(folder.name,'Tenses');assert.equal(folder.nameKey,'tenses')
  await assert.rejects(()=>saveGrammarFolder({...folder,id:crypto.randomUUID(),name:'tenses'},db),/đã tồn tại/)
  await assert.rejects(()=>saveGrammarFolder({...folder,ownerId:'other'},db))
  await assert.rejects(()=>deleteGrammarFolder({...folder,ownerId:'other'},db))
  await assert.rejects(()=>deleteGrammarFolder(original,db),/còn cấu trúc/)
  const foreign=await saveGrammarFolder({...folder,id:crypto.randomUUID(),ownerId:'other'},db)
  await assert.rejects(()=>saveGrammarEntry({...entry,folderId:foreign.id},db))
  await assert.rejects(()=>saveGrammarEntry({...entry,folderId:crypto.randomUUID()},db))
  const moved=await saveGrammarEntry({...entry,folderId:folder.id},db)
  assert.equal(moved.folderId,folder.id);assert.equal(moved.structure,entry.structure)
  const renamed=await saveGrammarFolder({...folder,name:'Verb tenses'},db)
  assert.equal((await db.grammarEntries.get(entry.id)).folderId,renamed.id)
  await saveGrammarEntry({...moved,folderId:original.id},db)
  await deleteGrammarFolder(renamed,db)
  assert.equal(await db.grammarFolders.get(renamed.id),undefined)
  assert.equal(await db.grammarEntries.count(),1)
 }finally{await db.delete()}
})

const {grammarFolderIds,grammarFolderRows,grammarFolderPath}=await import(url(readFileSync('src/lib/grammar-folders.ts','utf8')))
test('Grammar tree indents children, collapses entire branches and counts descendants',()=>{
 const root=folderRow(),child={...folderRow(),parentId:root.id},grandchild={...folderRow(),parentId:child.id},other=folderRow()
 const folders=[root,other,grandchild,child]
 assert.deepEqual(grammarFolderRows(folders).map(row=>[row.folder.id,row.depth,row.hasChildren]),[[root.id,0,true],[child.id,1,true],[grandchild.id,2,false],[other.id,0,false]])
 assert.deepEqual(grammarFolderRows(folders,new Set([root.id])).map(row=>row.folder.id),[root.id,other.id])
 assert.deepEqual(grammarFolderRows(folders,new Set([child.id])).map(row=>row.folder.id),[root.id,child.id,other.id])
 assert.deepEqual([...grammarFolderIds(root.id,folders)],[root.id,child.id,grandchild.id])
 assert.deepEqual(grammarFolderPath(grandchild.id,folders).map(folder=>folder.id),[root.id,child.id,grandchild.id])
 const cycle=[{...root,parentId:child.id},child]
 assert.equal(grammarFolderRows(cycle).length,2)
 assert.equal(grammarFolderIds(root.id,cycle).size,2)
})
test('Grammar hierarchy persists, rejects cycles and foreign parents, and promotes children when deleting an empty parent',async()=>{
 const db=new VocabDatabase('grammar-tree-'+crypto.randomUUID())
 try{
  const root=await saveGrammarFolder(folderRow(),db),other=await saveGrammarFolder({...folderRow(),name:'Other'},db)
  const child=await saveGrammarFolder({...folderRow(),parentId:root.id,name:'Tenses'},db)
  const grandchild=await saveGrammarFolder({...folderRow(),parentId:child.id,name:'Past'},db)
  await saveGrammarFolder({...folderRow(),parentId:other.id,name:'Tenses'},db)
  await assert.rejects(()=>saveGrammarFolder({...folderRow(),parentId:root.id,name:'tenses'},db),/đã tồn tại/)
  await assert.rejects(()=>saveGrammarFolder({...root,parentId:grandchild.id},db),/chính nó/)
  await assert.rejects(()=>saveGrammarFolder({...root,parentId:root.id},db),/chính nó/)
  await assert.rejects(()=>saveGrammarFolder({...folderRow('other-owner'),parentId:root.id},db),/thư mục cha/)
  await assert.rejects(()=>saveGrammarFolder({...folderRow(),parentId:crypto.randomUUID()},db),/thư mục cha/)
  const entry=await saveGrammarEntry(entryRow(grandchild),db)
  assert.equal((await db.grammarFolders.get(grandchild.id)).parentId,child.id)
  await deleteGrammarFolder(root,db)
  assert.equal((await db.grammarFolders.get(child.id)).parentId,undefined)
  assert.equal((await db.grammarFolders.get(grandchild.id)).parentId,child.id)
  assert.equal((await db.grammarEntries.get(entry.id)).folderId,grandchild.id)
  db.close();await db.open()
  assert.equal((await db.grammarFolders.get(grandchild.id)).parentId,child.id)
  const all=await db.grammarFolders.toArray(),ids=grammarFolderIds(child.id,all)
  assert.equal((await db.grammarEntries.toArray()).filter(row=>ids.has(row.folderId)).length,1)
 }finally{await db.delete()}
})

test('Reading grammar persists selected highlight ranges and rejects stale source on creation',async()=>{
 const db=new VocabDatabase('grammar-source-'+crypto.randomUUID())
 try{
  const folder=await saveGrammarFolder(folderRow(),db)
  const article={id:crypto.randomUUID(),ownerId:'owner',title:'Gossip',contentHtml:'<p>freed our ancestors from</p>',folderId:crypto.randomUUID(),createdAt:now(),updatedAt:now()}
  await db.readingArticles.put(article)
  const source={articleId:article.id,articleTitle:article.title,contentHtml:article.contentHtml,start:1,end:25,quote:'freed our ancestors from',highlights:[{start:1,end:6},{start:21,end:25}]}
  // Canonical passage offsets include the paragraph delimiter.
  source.end=source.start+source.quote.length;source.highlights[1]={start:source.end-4,end:source.end}
  const saved=await saveGrammarEntry({...entryRow(folder),source},db)
  assert.deepEqual(saved.source,source)
  db.close();await db.open()
  assert.deepEqual((await db.grammarEntries.get(saved.id)).source.highlights,source.highlights)
  await assert.rejects(()=>saveGrammarEntry({...entryRow(folder),source:{...source,highlights:[{start:0,end:2}]}},db),/tô sáng/)
  await db.readingArticles.update(article.id,{contentHtml:'Changed'})
  await assert.rejects(()=>saveGrammarEntry({...entryRow(folder),source},db),/đã thay đổi/)
  // Grammar remains editable even after the original passage has changed.
  const edited=await saveGrammarEntry({...saved,notes:'My edited grammar'},db)
  assert.equal(edited.notes,'My edited grammar')
  await db.readingArticles.update(article.id,{contentHtml:article.contentHtml,ownerId:'other'})
  await assert.rejects(()=>saveGrammarEntry({...entryRow(folder),source},db))
 }finally{await db.delete()}
})

test('Manual grammar assignment preserves existing sources, validates ownership and persists the exact selection',async()=>{
 const db=new VocabDatabase('grammar-assign-'+crypto.randomUUID())
 try{
  const folder=await saveGrammarFolder(folderRow(),db)
  const article={id:crypto.randomUUID(),ownerId:'owner',title:'Reading',contentHtml:'<p>They are thought to have arrived.</p>',createdAt:now(),updatedAt:now()}
  await db.readingArticles.put(article)
  const source={articleId:article.id,articleTitle:article.title,contentHtml:article.contentHtml,start:1,end:5,quote:'They',highlights:[{start:1,end:5}]}
  const original=await saveGrammarEntry({...entryRow(folder),source},db)
  const assigned={...source,start:6,end:33,quote:'are thought to have arrived',exactSelection:true,highlights:[{start:6,end:33}]}
  assigned.end=assigned.start+assigned.quote.length;assigned.highlights[0].end=assigned.end
  const saved=await saveGrammarEntry({...original,sources:[assigned]},db)
  assert.deepEqual(saved.source,source)
  assert.deepEqual(saved.sources,[assigned])
  assert.equal(saved.structure,original.structure)
  db.close();await db.open()
  assert.deepEqual((await db.grammarEntries.get(saved.id)).sources,[assigned])
  await assert.rejects(()=>saveGrammarEntry({...saved,sources:[{...assigned,highlights:[{start:0,end:2}]}]},db),/tô sáng/)
  await db.readingArticles.update(article.id,{ownerId:'foreign'})
  await assert.rejects(()=>saveGrammarEntry({...saved,sources:[{...assigned,quote:'different'}]},db),/đã thay đổi/)
 }finally{await db.delete()}
})
