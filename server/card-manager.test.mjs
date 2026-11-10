import 'fake-indexeddb/auto'
import test, {beforeEach,after} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const url=s=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s)).toString('base64')
const dbUrl=url(read('../src/lib/db.ts').replace("'dexie'",JSON.stringify(import.meta.resolve('dexie'))).replace("'vocab-library'","'manager-tests'"))
const foldersUrl=url(read('../src/lib/folders.ts'))
const {db}=await import(dbUrl)
const {managedNotes,deleteNote}=await import(url(read('../src/lib/card-manager.ts').replace("'./db'",JSON.stringify(dbUrl)).replace("'./folders'",JSON.stringify(foldersUrl))))
const make=(id,folderId,front)=>({id,folderId,front,back:'meaning',extra:'',tags:'',createdAt:1,kind:'basic'})
beforeEach(async()=>{for(const table of db.tables)await table.clear()})
after(async()=>{await db.delete()})

test('manager filters exact folder or descendants and searches visible values',()=>{
 const folders=[{id:'parent'},{id:'child',parentId:'parent'},{id:'other'}]
 const notes=[make('p','parent','speak'),{...make('c','child','effect'),values:{'Nghĩa tiếng Việt':'Hiệu quả','__relatedNote:effective':'secret-id'}},make('o','other','book')]
 assert.deepEqual(managedNotes(notes,folders,'parent',true,'').map(n=>n.id),['p','c'])
 assert.deepEqual(managedNotes(notes,folders,'parent',false,'').map(n=>n.id),['p'])
 assert.deepEqual(managedNotes(notes,folders,'all',true,' HIỆU QUẢ ').map(n=>n.id),['c'])
 assert.equal(managedNotes(notes,folders,'all',true,'secret-id').length,0)
 assert.equal(managedNotes(notes,folders,'all',true,'BOOK')[0].id,'o')
})

async function seed(){
 await db.notes.bulkAdd([make('delete','f','effect'),{...make('keep','f','effective'),values:{'Nghĩa tiếng Việt':'hiệu quả','__relatedNote:effect':'delete','__relatedNote:other':'other'}}])
 await db.reviews.bulkAdd([{id:'delete-forward',noteId:'delete'},{id:'delete-reverse',noteId:'delete'},{id:'keep-forward',noteId:'keep'}])
 await db.reviewLogs.bulkAdd([{id:'delete-log',noteId:'delete',cardId:'delete-forward'},{id:'keep-log',noteId:'keep',cardId:'keep-forward'}])
}

test('deleting a vocabulary removes its cards, schedules, logs and incoming related links only',async()=>{
 await seed()
 await deleteNote('delete')
 assert.equal(await db.notes.get('delete'),undefined)
 assert.deepEqual((await db.reviews.toArray()).map(x=>x.id),['keep-forward'])
 assert.deepEqual((await db.reviewLogs.toArray()).map(x=>x.id),['keep-log'])
 const keep=await db.notes.get('keep')
 assert.equal(keep.values['Nghĩa tiếng Việt'],'hiệu quả')
 assert.equal(keep.values['__relatedNote:effect'],undefined)
 assert.equal(keep.values['__relatedNote:other'],'other')
 await assert.rejects(()=>deleteNote('delete'))
})

test('delete rolls back all records if related-link cleanup fails',async()=>{
 await seed()
 const fail=()=>{throw new Error('Storage failed')}
 db.notes.hook('updating',fail)
 try{await assert.rejects(()=>deleteNote('delete'),/Storage failed/)}finally{db.notes.hook('updating').unsubscribe(fail)}
 assert.ok(await db.notes.get('delete'))
 assert.equal(await db.reviews.count(),3)
 assert.equal(await db.reviewLogs.count(),2)
 assert.equal((await db.notes.get('keep')).values['__relatedNote:effect'],'delete')
})
