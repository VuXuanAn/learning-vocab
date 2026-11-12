import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import Dexie from 'dexie'
import {JSDOM} from 'jsdom'
import createDOMPurify from 'dompurify'
const {window}=new JSDOM('')
globalThis.document=window.document
globalThis.__grammarPurify=createDOMPurify(window)
const url=source=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64')
const dbUrl=url(readFileSync('src/lib/db.ts','utf8').replace("'dexie'",JSON.stringify(import.meta.resolve('dexie'))))
const {VocabDatabase}=await import(dbUrl)
const orderUrl=url(readFileSync('src/lib/grammar-order.ts','utf8'))
const documentUrl=url(readFileSync('src/lib/grammar-document.ts','utf8'))
const htmlUrl=url(readFileSync('src/lib/grammar-html.ts','utf8').replace("import DOMPurify from 'dompurify'",'const DOMPurify=globalThis.__grammarPurify').replace("'./grammar-document'",JSON.stringify(documentUrl)))
const {grammarEntryHtml,grammarHtmlText,prepareGrammarHtml}=await import(htmlUrl)
const {saveGrammarEntry,deleteGrammarEntry,saveGrammarFolder,deleteGrammarFolder,moveGrammarItem}=await import(url(readFileSync('src/lib/grammar-storage.ts','utf8').replace("'./grammar-html'",JSON.stringify(htmlUrl)).replace("'./grammar-order'",JSON.stringify(orderUrl)).replace("'./grammar-document'",JSON.stringify(documentUrl)).replace("'./db'",JSON.stringify(dbUrl)).replace("'zod'",JSON.stringify(import.meta.resolve('zod')))))
const now=()=>new Date().toISOString()
const folderRow=(ownerId='owner')=>({id:crypto.randomUUID(),ownerId,name:'Grammar',nameKey:'grammar',createdAt:now(),updatedAt:now()})
const entryRow=folder=>({id:crypto.randomUUID(),ownerId:folder.ownerId,folderId:folder.id,title:'My grammar',topic:'',structure:'S + V',usage:'Cách dùng',example:'An example.',translation:'Ví dụ.',notes:'My notes',status:'review',createdAt:now(),updatedAt:now()})

test('Reorder persists sibling positions, preserves content and hierarchy, and rejects foreign ownership',async()=>{
 const {sortGrammarItems}=await import(orderUrl)
 const {encodeRow,decodeRow}=await import(url(readFileSync('src/lib/row-codec.ts','utf8')))
 const db=new VocabDatabase('grammar-order-'+crypto.randomUUID())
 try{
  const first=await saveGrammarFolder({...folderRow(),name:'First',createdAt:'2026-01-01'},db)
  const second=await saveGrammarFolder({...folderRow(),name:'Second',createdAt:'2026-01-02'},db)
  const child=await saveGrammarFolder({...folderRow(),name:'Child',parentId:first.id},db)
  assert.equal(await moveGrammarItem('grammarFolders',second.id,1,'owner',db),false)
  await moveGrammarItem('grammarFolders',second.id,-1,'owner',db)
  assert.deepEqual(grammarFolderRows(await db.grammarFolders.toArray()).map(row=>row.folder.id),[second.id,first.id,child.id])
  assert.equal((await db.grammarFolders.get(child.id)).parentId,first.id)
  assert.equal((await db.grammarFolders.get(child.id)).sortOrder,undefined)
  const a=await saveGrammarEntry({...entryRow(first),title:'A',createdAt:'2026-01-01'},db)
  const b=await saveGrammarEntry({...entryRow(first),title:'B',createdAt:'2026-01-02'},db)
  const outsider=await saveGrammarEntry({...entryRow(second),title:'Other folder'},db)
  await moveGrammarItem('grammarEntries',a.id,-1,'owner',db)
  assert.deepEqual(sortGrammarItems(await db.grammarEntries.where('folderId').equals(first.id).toArray(),true).map(row=>row.id),[a.id,b.id])
  assert.equal((await db.grammarEntries.get(outsider.id)).sortOrder,undefined)
  const ordered=await db.grammarEntries.get(a.id)
  assert.equal(ordered.structure,a.structure);assert.equal(ordered.notes,a.notes)
  assert.notEqual(ordered.updatedAt,a.updatedAt)
  const saved=await saveGrammarEntry({...ordered,notes:'Edited after reorder'},db)
  assert.equal(saved.sortOrder,0)
  const wire=encodeRow('grammarEntries',saved)
  assert.equal(decodeRow('grammarEntries',{id:saved.id,owner_id:saved.ownerId,folder_id:saved.folderId,...wire}).sortOrder,0)
  const savedFolder=await saveGrammarFolder({...await db.grammarFolders.get(second.id),name:'Renamed'},db)
  assert.equal(savedFolder.sortOrder,0)
  await assert.rejects(()=>moveGrammarItem('grammarEntries',a.id,1,'other',db))
  await assert.rejects(()=>moveGrammarItem('grammarFolders',second.id,1,'other',db))
  db.close();await db.open()
  assert.equal((await db.grammarEntries.get(a.id)).sortOrder,0)
  assert.equal((await db.grammarFolders.get(second.id)).sortOrder,0)
 }finally{await db.delete()}
})

test('Drag-drop moves across multiple siblings without swapping intervening items and rejects another group',async()=>{
 const {sortGrammarItems}=await import(orderUrl)
 const db=new VocabDatabase('grammar-drag-'+crypto.randomUUID())
 try{
  const roots=[]
  for(let index=0;index<4;index++)roots.push(await saveGrammarFolder({...folderRow(),name:'Folder '+index,createdAt:'2026-01-0'+(index+1)},db))
  const child=await saveGrammarFolder({...folderRow(),name:'Child',parentId:roots[0].id},db)
  await moveGrammarItem('grammarFolders',roots[3].id,roots[0].id,'owner',db)
  const tree=grammarFolderRows(await db.grammarFolders.toArray())
  assert.deepEqual(tree.map(row=>row.folder.id),[roots[3].id,roots[0].id,child.id,roots[1].id,roots[2].id])
  await assert.rejects(()=>moveGrammarItem('grammarFolders',child.id,roots[0].id,'owner',db))
  const entries=[]
  for(let index=0;index<4;index++)entries.push(await saveGrammarEntry({...entryRow(roots[0]),createdAt:'2026-01-0'+(index+1)},db))
  // Initial order is newest first: 3, 2, 1, 0. Move 0 to 3, then 0 back to 1.
  await moveGrammarItem('grammarEntries',entries[0].id,entries[3].id,'owner',db)
  const ordered=async()=>sortGrammarItems(await db.grammarEntries.where('folderId').equals(roots[0].id).toArray(),true).map(row=>row.id)
  assert.deepEqual(await ordered(),[entries[0].id,entries[3].id,entries[2].id,entries[1].id])
  await moveGrammarItem('grammarEntries',entries[0].id,entries[1].id,'owner',db)
  assert.deepEqual(await ordered(),[entries[3].id,entries[2].id,entries[1].id,entries[0].id])
  const other=await saveGrammarEntry(entryRow(roots[1]),db)
  await assert.rejects(()=>moveGrammarItem('grammarEntries',entries[0].id,other.id,'owner',db))
  assert.deepEqual(await ordered(),[entries[3].id,entries[2].id,entries[1].id,entries[0].id])
  assert.equal(await moveGrammarItem('grammarEntries',entries[0].id,entries[0].id,'owner',db),false)
 }finally{await db.delete()}
})

test('Structured grammar retains formulas, usage ids and paired examples through edits and cloud encoding',async()=>{
 const {withGrammarDocument,grammarDocument}=await import(documentUrl)
 const {encodeRow,decodeRow}=await import(url(readFileSync('src/lib/row-codec.ts','utf8')))
 const db=new VocabDatabase('structured-grammar-'+crypto.randomUUID())
 try{
  const folder=await saveGrammarFolder(folderRow(),db)
  const document={name:'Hiện tại đơn - Present Simple',category:'tenses',level:'A1',structures:[{id:1,type:'Khẳng định',formula:'S + V(s/es) + O'},{id:2,type:'Phủ định',formula:'S + do/does + not + V + O'},{id:3,type:'Nghi vấn',formula:'Do/Does + S + V + O?'}],usages:[{id:1,content:'Diễn tả thói quen, hành động lặp lại.'},{id:2,content:'Diễn tả sự thật hiển nhiên.'},{id:10,content:''}],examples:[{id:1,en:'I study English every day.',vi:'Tôi học tiếng Anh mỗi ngày.'},{id:2,en:"She doesn't drink coffee.",vi:'Cô ấy không uống cà phê.'}],notes:'He/She/It + V(s/es).'}
  const saved=await saveGrammarEntry(withGrammarDocument(entryRow(folder),document),db)
  assert.equal(saved.name,document.name);assert.equal(saved.title,document.name)
  assert.deepEqual(saved.structures,document.structures)
  assert.deepEqual(saved.usages,document.usages.slice(0,2))
  assert.deepEqual(saved.examples,document.examples)
  db.close();await db.open()
  assert.deepEqual((await db.grammarEntries.get(saved.id)).examples,document.examples)
  const wire=encodeRow('grammarEntries',saved)
  const cloud=decodeRow('grammarEntries',{id:saved.id,owner_id:saved.ownerId,folder_id:saved.folderId,...JSON.parse(JSON.stringify(wire))})
  assert.deepEqual(grammarDocument(cloud),grammarDocument(saved))
  const edited=await saveGrammarEntry(withGrammarDocument(cloud,{...grammarDocument(cloud),structures:[document.structures[0],{id:4,type:'Bổ sung',formula:'S + be + adj'}],examples:[document.examples[1]]}),db)
  assert.deepEqual(edited.structures.map(row=>row.id),[1,4])
  assert.deepEqual(edited.examples,[document.examples[1]])
  await assert.rejects(()=>saveGrammarEntry(withGrammarDocument(edited,{...grammarDocument(edited),structures:[]}),db))
  await assert.rejects(()=>saveGrammarEntry(withGrammarDocument(edited,{...grammarDocument(edited),structures:[{id:1,type:'Missing',formula:''}]}),db))
  await assert.rejects(()=>saveGrammarEntry(withGrammarDocument(edited,{...grammarDocument(edited),examples:[{id:1,en:'',vi:'Chỉ có bản dịch'}]}),db))
 }finally{await db.delete()}
})
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

const {grammarFolderIds,grammarFolderRows,grammarFolderPath}=await import(url(readFileSync('src/lib/grammar-folders.ts','utf8').replace("'./grammar-order'",JSON.stringify(orderUrl))))
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


test('Free HTML grammar saves without a formula, strips unsafe markup, and survives cloud encoding',async()=>{
 const {encodeRow,decodeRow}=await import(url(readFileSync('src/lib/row-codec.ts','utf8')))
 const db=new VocabDatabase('grammar-html-'+crypto.randomUUID())
 try{
  const folder=await saveGrammarFolder(folderRow(),db)
  const saved=await saveGrammarEntry({...entryRow(folder),title:'Get to + V',structure:'',contentHtml:'<h2>Ý nghĩa</h2><p onclick="evil()">Có <strong>cơ hội</strong></p><ul><li>Ví dụ tự do</li></ul><table><tr><td>get to meet</td></tr></table><script>evil()</script><a href="javascript:evil()">bad</a>'},db)
  assert.equal(saved.title,'Get to + V')
  assert.equal(saved.structure,'Get to + V')
  assert.ok(saved.contentHtml.includes('<strong>cơ hội</strong>'))
  assert.ok(saved.contentHtml.includes('<table>'))
  assert.ok(!/onclick|script|javascript:/.test(saved.contentHtml))
  assert.ok(saved.usage.includes('cơ hội'))
  const wire=encodeRow('grammarEntries',saved)
  const decoded=decodeRow('grammarEntries',{id:saved.id,owner_id:saved.ownerId,folder_id:saved.folderId,...wire})
  assert.equal(decoded.contentHtml,saved.contentHtml)
  const imported=await saveGrammarEntry({...saved,usages:[{id:1,content:''}],examples:[{id:1,en:'',vi:''}]},db)
  assert.deepEqual(imported.usages,[])
  assert.deepEqual(imported.examples,[])
  await assert.rejects(()=>saveGrammarEntry({...saved,contentHtml:'<p><br></p>'},db),/nội dung/)
  await assert.rejects(()=>saveGrammarEntry({...saved,contentHtml:'<script>evil()</script>'},db),/nội dung/)
  await assert.rejects(()=>saveGrammarEntry({...saved,ownerId:'foreign'},db),/thư mục/)
 }finally{await db.delete()}
})
test('Legacy grammar converts all sections without executing embedded markup; plain notes retain line breaks',async()=>{
 const {withGrammarDocument}=await import(documentUrl)
 const folder=folderRow()
 const old=withGrammarDocument(entryRow(folder),{name:'Custom',level:'B1',structures:[{id:1,type:'Loại',formula:'S + V < O'}],usages:[{id:1,content:'Cách dùng <script>test</script>'}],examples:[{id:1,en:'I get to meet people.',vi:'Tôi có cơ hội gặp mọi người.'}],notes:'Ghi chú tự do'})
 const html=grammarEntryHtml(old)
 for(const value of ['B1','Loại','S + V &lt; O','&lt;script&gt;test&lt;/script&gt;','I get to meet people.','Tôi có cơ hội gặp mọi người.','Ghi chú tự do'])assert.ok(html.includes(value),value)
 assert.equal(grammarEntryHtml({...old,contentHtml:'<p>Edited</p>'}),'<p>Edited</p>')
 const plain=prepareGrammarHtml('Dùng khi x < 10\nDòng tiếp theo & ví dụ')
 assert.ok(plain.includes('&lt; 10<br>'))
 assert.equal(grammarHtmlText(plain),'Dùng khi x < 10\nDòng tiếp theo & ví dụ')
})
test('Converting an existing grammar to free HTML preserves Reading highlight sources',async()=>{
 const db=new VocabDatabase('grammar-html-source-'+crypto.randomUUID())
 try{
  const folder=await saveGrammarFolder(folderRow(),db)
  const article={id:crypto.randomUUID(),ownerId:'owner',title:'Reading',contentHtml:'<p>get to meet</p>'}
  await db.readingArticles.put(article)
  const source={articleId:article.id,articleTitle:article.title,contentHtml:article.contentHtml,start:1,end:12,quote:'get to meet',highlights:[{start:1,end:4},{start:5,end:7}]}
  const old=await saveGrammarEntry({...entryRow(folder),structure:'get to',source},db)
  const updated=await saveGrammarEntry({...old,contentHtml:grammarEntryHtml(old)},db)
  assert.deepEqual(updated.source,source)
  assert.equal(updated.structure,'get to')
 }finally{await db.delete()}
})


test('Rich formatting, checklists and image dimensions survive saving and cloud encoding',async()=>{
 const {encodeRow,decodeRow}=await import(url(readFileSync('src/lib/row-codec.ts','utf8')))
 const db=new VocabDatabase('grammar-rich-'+crypto.randomUUID())
 try{
  const folder=await saveGrammarFolder(folderRow(),db)
  const html='<p style="text-align: center; margin-left: 4em; line-height: 1.5"><span style="font-family: Georgia; font-size: 24px; color: #dc2626">Colored example</span><mark data-color="#fef08a" style="background-color:#fef08a">highlight</mark><sup>2</sup><sub>3</sub></p><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Remember this</p></div></li></ul><img src="https://example.com/grammar.png" alt="Example" width="320" height="180">'
  const saved=await saveGrammarEntry({...entryRow(folder),contentHtml:html},db)
  const root=document.createElement('div');root.innerHTML=saved.contentHtml
  assert.equal(root.querySelector('p').style.textAlign,'center')
  assert.equal(root.querySelector('p').style.marginLeft,'4em')
  assert.equal(root.querySelector('p').style.lineHeight,'1.5')
  assert.equal(root.querySelector('span').style.fontFamily,'Georgia')
  assert.equal(root.querySelector('span').style.fontSize,'24px')
  assert.equal(root.querySelector('span').style.color,'rgb(220, 38, 38)')
  assert.equal(root.querySelector('mark').getAttribute('data-color'),'#fef08a')
  assert.equal(root.querySelector('li').getAttribute('data-checked'),'true')
  assert.equal(root.querySelector('input').checked,true)
  assert.equal(root.querySelector('input').disabled,true)
  assert.equal(root.querySelector('img').getAttribute('width'),'320')
  const wire=encodeRow('grammarEntries',saved)
  assert.equal(decodeRow('grammarEntries',{id:saved.id,owner_id:saved.ownerId,folder_id:saved.folderId,...wire}).contentHtml,saved.contentHtml)
  const image=await saveGrammarEntry({...entryRow(folder),structure:'',contentHtml:'<img src="data:image/png;base64,aGVsbG8=" alt="An image">'},db)
  assert.ok(image.contentHtml.includes('data:image/png;base64,'))
 }finally{await db.delete()}
})
test('Rich HTML keeps formatting while removing executable images, controls and layout styles',()=>{
 const safe=prepareGrammarHtml('<p style="color:red;position:fixed;inset:0;background-image:url(https://evil.test);font-size:18px">Text</p><mark data-color="red;position:fixed" style="background-color:yellow">mark</mark><img src="javascript:evil()" onerror="evil()"><img src="data:image/svg+xml;base64,PHN2Zz4="><input type="password"><label>Label</label><ul data-type="evil"><li data-checked="true">Plain item</li></ul>')
 const root=document.createElement('div');root.innerHTML=safe
 assert.equal(root.querySelector('p').style.color,'red')
 assert.equal(root.querySelector('p').style.fontSize,'18px')
 assert.equal(root.querySelector('p').style.position,'')
 assert.equal(root.querySelector('p').style.backgroundImage,'')
 assert.equal(root.querySelector('mark').hasAttribute('data-color'),false)
 assert.equal(root.querySelectorAll('img,input').length,0)
 assert.equal(root.querySelector('[data-type],[data-checked]'),null)
})
