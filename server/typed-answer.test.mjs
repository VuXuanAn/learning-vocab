import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const read=p=>readFileSync(new URL('../src/lib/'+p+'.ts',import.meta.url),'utf8')
const url=s=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s)).toString('base64')
const templatesUrl=url(read('templates'))
const cardsUrl=url(read('cards').replace("'./templates'",JSON.stringify(templatesUrl)))
const meaningUrl=url(read('meaning-quiz').replace("'./cards'",JSON.stringify(cardsUrl)))
const {typedTarget,checkTypedAnswer}=await import(url(read('typed-answer').replace("'./meaning-quiz'",JSON.stringify(meaningUrl))))
const {generateCards}=await import(cardsUrl)
const {aiTemplate}=await import(url(read('ai-batch')))
const {studyCard}=await import(url(read('study-direction').replace("'./cards'",JSON.stringify(cardsUrl)).replace("'./templates'",JSON.stringify(templatesUrl))))
const ai={id:'ai',kind:'ai',front:'when all is said and done',back:'',extra:'',tags:'',createdAt:1,template:aiTemplate,values:{'Từ vựng':'when all is said and done','Nghĩa tiếng Việt':'sau tất cả, suy cho cùng'}}

test('normal AI direction asks for a stored Vietnamese meaning',()=>{
 const target=typedTarget(ai,generateCards(ai)[0],false)
 assert.equal(target.kind,'meaning')
 assert.equal(checkTypedAnswer(' suy cho cùng! ',target),true)
 assert.equal(checkTypedAnswer('Sau tất cả',target),true)
 assert.equal(checkTypedAnswer('sau',target),false)
 assert.equal(checkTypedAnswer('',target),false)
})

test('reverse AI direction asks for the word with case and whitespace normalization',()=>{
 const card=studyCard(ai,generateCards(ai)[0],true)
 const target=typedTarget(ai,card,true)
 assert.equal(target.kind,'word')
 assert.equal(target.expected,ai.front)
 assert.equal(checkTypedAnswer('WHEN  ALL IS SAID AND DONE.',target),true)
 assert.equal(checkTypedAnswer('when all is said',target),false)
 assert.equal(checkTypedAnswer('suy cho cùng',target),false)
})

test('basic reverse cards and per-folder reversal check the actual answer side',()=>{
 const note={id:'b',kind:'reverse',front:'speak',back:'nói',extra:''}
 const [forward,reverse]=generateCards(note)
 assert.equal(typedTarget(note,forward,false).expected,'nói')
 assert.equal(typedTarget(note,reverse,false).kind,'word')
 assert.equal(typedTarget(note,reverse,false).expected,'speak')
 const flipped=studyCard(note,reverse,true)
 assert.equal(typedTarget(note,flipped,true).kind,'meaning')
 assert.equal(typedTarget(note,flipped,true).expected,'nói')
})

test('cloze checks all hidden parts in the active group rather than visible hints',()=>{
 const note={id:'c',kind:'cloze',front:'{{c1::hello::greeting}} {{c1::world}} {{c2::again}}',back:'',extra:''}
 const card=generateCards(note)[0]
 const target=typedTarget(note,card,false)
 assert.equal(target.kind,'cloze')
 assert.equal(checkTypedAnswer('HELLO; world',target),true)
 assert.equal(checkTypedAnswer('hello',target),false)
 assert.equal(checkTypedAnswer('greeting; world',target),false)
 assert.equal(typedTarget(note,card,true),null)
})

test('custom templates without semantic fields are not guessed and apostrophes normalize',()=>{
 const note={...ai,kind:'custom',template:{...aiTemplate,fields:[{id:'x',name:'Custom HTML',required:true}]}}
 assert.equal(typedTarget(note,generateCards(ai)[0],false),null)
 assert.equal(checkTypedAnswer('don’t give up',{kind:'word',expected:"don't give up"}),true)
})
