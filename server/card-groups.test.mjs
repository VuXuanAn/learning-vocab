import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const url=s=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s)).toString('base64')
const relatedUrl=url(read('../src/lib/related-words.ts'))
const {groupRelatedNotes}=await import(url(read('../src/lib/card-groups.ts').replace("'./related-words'",JSON.stringify(relatedUrl))))
const note=(id,word,related='',createdAt=1)=>({id,front:word,createdAt,kind:'ai',values:{'Từ vựng':word,'Các dạng từ liên quan':related}})

test('word-family links group transitive related cards while leaving unrelated words separate',()=>{
 const notes=[note('root','converse','conversation (n): cuộc trò chuyện',1),note('n','conversation','conversational (adj): đàm thoại',2),note('adj','conversational','',3),note('alone','deaf','',4)]
 const groups=groupRelatedNotes(notes,notes)
 const family=groups.find(group=>group.rootId==='root')
 assert.deepEqual(family.notes.map(row=>row.id),['root','n','adj'])
 assert.equal(family.total,3)
 assert.equal(groups.length,2)
 assert.equal(groups.find(group=>group.id==='alone').total,1)
})

test('saved normalized aliases and cycles connect each note exactly once',()=>{
 const a=note('a','distinction','',1),b=note('b','distinguish','',2)
 a.values['__relatedNote:distinguished']='b'
 b.values['__relatedNote:distinction']='a'
 b.values['__relatedNote:deleted']='missing'
 const result=groupRelatedNotes([b,a],[a,b])
 assert.equal(result.length,1)
 assert.deepEqual(result[0].notes.map(row=>row.id),['a','b'])
})

test('shared absent roots connect derived forms without guessing by prefix',()=>{
 const notes=[note('a','effective','effect (n): tác động'),note('b','effectively','effect (n): tác động'),note('c','effectiveness'),note('d','deaf')]
 const groups=groupRelatedNotes(notes,notes)
 assert.equal(groups.find(group=>group.notes.some(row=>row.id==='a')).total,2)
 assert.equal(groups.find(group=>group.notes.some(row=>row.id==='c')).total,1)
 assert.equal(groups.find(group=>group.notes.some(row=>row.id==='d')).total,1)
})

test('filtering preserves group identity and never reveals filtered-out notes',()=>{
 const all=[note('a','converse','conversation (n): trò chuyện'),note('b','conversation','',2),note('c','deaf','',3)]
 const filtered=groupRelatedNotes(all,[all[1]])
 assert.equal(filtered.length,1)
 assert.equal(filtered[0].id,'a')
 assert.equal(filtered[0].label,'converse')
 assert.equal(filtered[0].total,2)
 assert.deepEqual(filtered[0].notes.map(row=>row.id),['b'])
 assert.deepEqual(groupRelatedNotes(all,[]),[])
})
