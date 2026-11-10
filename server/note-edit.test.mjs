import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const url=s=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s)).toString('base64')
const dbUrl=url(read('../src/lib/db.ts').replace("'dexie'",JSON.stringify(import.meta.resolve('dexie'))).replace("'vocab-library'","'note-edit-tests'"))
const templateUrl=url(read('../src/lib/templates.ts'))
const cardsUrl=url(read('../src/lib/cards.ts').replace("'./templates'",JSON.stringify(templateUrl)))
const aiUrl=url(read('../src/lib/ai-batch.ts'))
const {db}=await import(dbUrl)
const {aiTemplate}=await import(aiUrl)
const {saveNoteEdits}=await import(url(read('../src/lib/note-edit.ts').replace("'./db'",JSON.stringify(dbUrl)).replace("'./cards'",JSON.stringify(cardsUrl)).replace("'./ai-batch'",JSON.stringify(aiUrl))))
const note={id:'word',kind:'ai',front:'effect',back:'',extra:'',tags:'',folderId:'folder',createdAt:1,template:aiTemplate,values:{'Từ vựng':'effect','Nghĩa tiếng Việt':'tác động','Phiên âm IPA':'/ɪˈfekt/'}}

test('editing updates AI fields and pronunciation without changing IDs, folder or FSRS state',async()=>{
 try{
  await db.notes.add(note)
  const review={id:'word-custom',noteId:'word',revision:4,due:new Date('2026-12-01'),stability:3}
  await db.reviews.add(review)
  await db.reviewLogs.add({id:'log',noteId:'word',cardId:review.id})
  await saveNoteEdits(note,{...note,id:'different',folderId:'other',values:{...note.values,'Từ vựng':' effective ','Phiên âm IPA':'/ɪˈfektɪv/','Nghĩa tiếng Việt':' hiệu quả ','Các dạng từ liên quan':'effect (n): tác động'}})
  const saved=await db.notes.get(note.id)
  assert.equal(saved.front,'effective')
  assert.equal(saved.values['Phiên âm IPA'],'/ɪˈfektɪv/')
  assert.equal(saved.values['Nghĩa tiếng Việt'],'hiệu quả')
  assert.equal(saved.folderId,'folder')
  assert.equal(saved.id,'word')
  assert.equal(saved.createdAt,1)
  assert.deepEqual(await db.reviews.get(review.id),review)
  assert.equal(await db.reviewLogs.count(),1)
  await assert.rejects(()=>saveNoteEdits(note,note),/nơi khác/)
  await assert.rejects(()=>saveNoteEdits(saved,{...saved,values:{...saved.values,'Từ vựng':''}}))
  assert.equal((await db.notes.get(note.id)).front,'effective')
  await saveNoteEdits(saved,{...saved,values:{...saved.values,'Từ vựng':'take effect','Các dạng từ liên quan':'unwanted'}})
  assert.equal((await db.notes.get(note.id)).values['Các dạng từ liên quan'],'')
 }finally{await db.delete()}
})

test('editing cloze preserves card groups and rejects deleted notes',async()=>{
 try{
  await db.open()
  const cloze={id:'cloze',kind:'cloze',front:'{{c1::hello}} world',back:'',extra:'',tags:'',createdAt:1}
  await db.notes.add(cloze)
  await assert.rejects(()=>saveNoteEdits(cloze,{...cloze,front:'{{c2::hello}}'}))
  await saveNoteEdits(cloze,{...cloze,front:'{{c1::goodbye}} world'})
  const current=await db.notes.get(cloze.id)
  await db.notes.delete(cloze.id)
  await assert.rejects(()=>saveNoteEdits(current,current),/đã bị xóa/)
 }finally{await db.delete()}
})

