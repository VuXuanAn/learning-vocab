import 'fake-indexeddb/auto'
import test, { beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const url=s=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s)).toString('base64')
const dbUrl=url(read('../src/lib/db.ts').replace("'dexie'",JSON.stringify(import.meta.resolve('dexie'))).replace("'vocab-library'","'related-tests'"))
const relatedUrl=url(read('../src/lib/related-words.ts'))
const aiUrl=url(read('../src/lib/ai-batch.ts'))
const {aiTemplate}=await import(aiUrl)
const {db}=await import(dbUrl)
const {parseRelatedWords,findRelatedNote,relatedLinkKey}=await import(relatedUrl)
const {saveRelatedNote,generateRelatedNote}=await import(url(read('../src/lib/related-storage.ts').replace("'./db'",JSON.stringify(dbUrl)).replace("'./ai-batch'",JSON.stringify(aiUrl)).replace("'./related-words'",JSON.stringify(relatedUrl))))
const make=(id,word,folderId='f')=>({id,front:word,kind:'ai',back:'',extra:'',tags:'',createdAt:1,folderId,template:aiTemplate,values:{'Từ vựng':word,'Nghĩa tiếng Việt':'nghĩa'}})
const originalFetch=globalThis.fetch
beforeEach(async()=>{
 for(const table of db.tables)await table.clear()
 await db.folders.add({id:'f',name:'Folder',nameKey:'folder',createdAt:1})
 await db.notes.add(make('parent','distinction'))
 globalThis.fetch=async()=>{throw new Error('Unexpected provider call')}
})
after(async()=>{globalThis.fetch=originalFetch;await db.delete()})

test('related-word parsing separates headwords and Vietnamese definitions',()=>{
 assert.deepEqual(parseRelatedWords('distinguish (v): phân biệt\ndistinguished (adj): lỗi lạc, kiệt xuất\ndistinction (n): sự khác biệt'),[
 {word:'distinguish',description:'(v): phân biệt'},
 {word:'distinguished',description:'(adj): lỗi lạc, kiệt xuất'},
 {word:'distinction',description:'(n): sự khác biệt'}])
 assert.deepEqual(parseRelatedWords('• effective (adj): hiệu quả; effectively (adv): hiệu quả\nEffective (adj): trùng').map(x=>x.word),['effective','effectively'])
 assert.equal(parseRelatedWords('<script>: bad').length,0)
})

test('lookup reuses existing cards, prioritizes same folder and follows saved lemma aliases',()=>{
 const parent=make('parent','distinction')
 const other=make('other','DISTINGUISH','other-folder')
 const local=make('local','distinguish')
 assert.equal(findRelatedNote([other,local],parent,' distinguish ').id,'local')
 assert.equal(findRelatedNote([other],parent,'distinguish').id,'other')
 parent.values[relatedLinkKey('distinguished')]='local'
 assert.equal(findRelatedNote([local],parent,'distinguished').id,'local')
 assert.equal(findRelatedNote([],parent,'distinguished'),undefined)
})

test('concurrent saves reuse one note and persist aliases to normalized headwords',async()=>{
 const [a,b]=await Promise.all([
 saveRelatedNote('parent','distinguished',make('new-a','distinguish')),
 saveRelatedNote('parent','distinguished',make('new-b','distinguish'))])
 assert.equal(a.id,b.id)
 assert.equal(await db.notes.count(),2)
 const parent=await db.notes.get('parent')
 assert.equal(parent.values['Từ vựng'],'distinction')
 assert.equal(parent.values[relatedLinkKey('distinguished')],a.id)
 assert.equal(findRelatedNote(await db.notes.toArray(),parent,'distinguished').id,a.id)
})

test('generation skips AI when an existing word is available',async()=>{
 await db.notes.add(make('existing','distinguish'))
 const parent=await db.notes.get('parent')
 assert.equal((await generateRelatedNote('distinguish',parent,new AbortController().signal)).id,'existing')
})

test('one AI request creates and saves all fields in the parent folder',async()=>{
 let calls=0
 globalThis.fetch=async(_url,options)=>{
  calls++
  const request=JSON.parse(options.body)
  assert.deepEqual(request.words,['distinguished'])
  assert.equal(request.fields.length,7)
  return new Response(JSON.stringify({rows:[{index:0,originalWord:'distinguished',spelling:{status:'suggested',suggestion:'distinguish',reason:''},values:{word:'distinguish',ipa:'/d/',pos:'verb',meaning:'phân biệt',example:'Example.',translation:'Ví dụ.',wordFamily:'distinction (n): sự khác biệt'}}]}),{headers:{'Content-Type':'application/json'}})
 }
 const parent=await db.notes.get('parent')
 const target=await generateRelatedNote('distinguished',parent,new AbortController().signal)
 assert.equal(calls,1)
 assert.equal(target.front,'distinguish')
 assert.equal(target.folderId,'f')
 assert.equal(target.values['Phiên âm IPA'],'/d/')
 assert.equal(await db.notes.count(),2)
 assert.equal((await db.notes.get('parent')).values[relatedLinkKey('distinguished')],target.id)
})

test('failed or uncertain generation does not save partial cards',async()=>{
 const parent=await db.notes.get('parent')
 globalThis.fetch=async()=>new Response(JSON.stringify({error:'Provider unavailable'}),{status:503,headers:{'Content-Type':'application/json'}})
 await assert.rejects(()=>generateRelatedNote('newword',parent,new AbortController().signal),/Provider unavailable/)
 globalThis.fetch=async()=>new Response(JSON.stringify({rows:[{index:0,originalWord:'newword',spelling:{status:'uncertain',suggestion:'',reason:''},values:{}}]}),{headers:{'Content-Type':'application/json'}})
 await assert.rejects(()=>generateRelatedNote('newword',parent,new AbortController().signal))
 assert.equal(await db.notes.count(),1)
})

test('deleted source or folder prevents saving an orphaned generated card',async()=>{
 await db.folders.delete('f')
 await assert.rejects(()=>saveRelatedNote('parent','distinguish',make('new','distinguish')))
 assert.equal(await db.notes.count(),1)
})
