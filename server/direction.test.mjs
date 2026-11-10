import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const url=s=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s)).toString('base64')
const templateUrl=url(read('../src/lib/templates.ts'))
const cardsUrl=url(read('../src/lib/cards.ts').replace("'./templates'",JSON.stringify(templateUrl)))
const directionUrl=url(read('../src/lib/study-direction.ts').replace("'./templates'",JSON.stringify(templateUrl)).replace("'./cards'",JSON.stringify(cardsUrl)))
const {studyCard}=await import(directionUrl)
const {generateCards}=await import(cardsUrl)
const {aiTemplate}=await import(url(read('../src/lib/ai-batch.ts')))
const note={id:'n',kind:'basic',front:'word',back:'meaning',extra:'example',createdAt:0,tags:''}
test('deck reversal swaps sides without mutating notes or FSRS card identity',()=>{
 const card=generateCards(note)[0]
 const reverse=studyCard(note,card,true)
 assert.equal(reverse.id,card.id)
 assert.equal(reverse.front,'meaning')
 assert.equal(reverse.back,'word')
 assert.equal(reverse.extra,'example')
 assert.equal(note.front,'word')
 assert.equal(studyCard(note,card,false),card)
})
test('AI reversed question contains only meaning, never the word, IPA or example',()=>{
 const ai={...note,kind:'ai',template:aiTemplate,values:{'Từ vựng':'resilient','Nghĩa tiếng Việt':'kiên cường','Phiên âm IPA':'IPA ANSWER','Câu ví dụ':'She is resilient.'}}
 const card=studyCard(ai,generateCards(ai)[0],true)
 assert.ok(card.front.includes('kiên cường'))
 assert.ok(!card.front.includes('resilient'))
 assert.ok(!card.front.includes('IPA ANSWER'))
 assert.ok(card.back.includes('resilient'))
})
test('custom reverse omits FrontSide so it does not reveal the answer',()=>{
 const custom={...note,kind:'custom',template:{fields:[],frontTemplate:'{{Word}}',backTemplate:'{{FrontSide}}<hr>{{Meaning}}',format:'html'},values:{Word:'secret-word',Meaning:'definition'}}
 const card=studyCard(custom,generateCards(custom)[0],true)
 assert.ok(!card.front.includes('secret-word'))
 assert.ok(card.front.includes('definition'))
 assert.equal(card.back,'secret-word')
})
test('reversed AI meanings remain escaped HTML',()=>{
 const ai={...note,kind:'ai',template:aiTemplate,values:{'Từ vựng':'word','Nghĩa tiếng Việt':'<b>literal</b>'}}
 assert.ok(studyCard(ai,generateCards(ai)[0],true).front.includes('&lt;b&gt;'))
})
