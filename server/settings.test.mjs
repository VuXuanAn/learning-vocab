import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const url = source => 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64')
const templatesUrl = url(read('../src/lib/templates.ts'))
const cardsUrl = url(read('../src/lib/cards.ts').replace("'./templates'", JSON.stringify(templatesUrl)))
const {meaningQuestions,matchesMeaning,nextQuestion,reminderReady}=await import(url(read('../src/lib/meaning-quiz.ts').replace("'./cards'",JSON.stringify(cardsUrl))))
const {defaultPreferences,normalizePreferences}=await import(url(read('../src/lib/preferences.ts')))
const base = { id:'n', kind:'basic', front:'resilient', back:'Kiên cường; bền bỉ', extra:'', tags:'', createdAt:0 }

test('settings defaults and input validation keep timer safe',()=>{
  assert.equal(defaultPreferences.reminderMinutes,5)
  assert.equal(defaultPreferences.reminderEnabled,true)
  assert.equal(defaultPreferences.autoVoice,false)
  for(const value of [0,-1,121,1.5,NaN,'5']) assert.equal(normalizePreferences({reminderMinutes:value}).reminderMinutes,5)
  assert.deepEqual(normalizePreferences({reminderMinutes:10,reminderEnabled:false,autoVoice:true}),{reminderMinutes:10,reminderEnabled:false,autoVoice:true})
})
test('quiz only includes existing cards last rated Again',()=>{
  assert.equal(meaningQuestions([base],[{id:'n-forward',noteId:'n',lastRating:1}]).length,1)
  for(const lastRating of [2,3,4]) assert.equal(meaningQuestions([base],[{id:'n-forward',noteId:'n',lastRating}]).length,0)
  assert.equal(meaningQuestions([base],[{id:'removed',noteId:'n',lastRating:1}]).length,0)
  assert.equal(meaningQuestions([],[{id:'n-forward',noteId:'n',lastRating:1}]).length,0)
})
test('custom quiz uses vocabulary and meaning fields without exposing examples',()=>{
  const note={...base,kind:'ai',template:{fields:[{id:'w',name:'Từ vựng'},{id:'m',name:'Nghĩa tiếng Việt'},{id:'e',name:'Ví dụ'}],speech:{fieldId:'w',lang:'en-GB',rate:0.7},frontTemplate:'{{Từ vựng}}',backTemplate:'{{Nghĩa tiếng Việt}}'},values:{'Từ vựng':'resilient','Nghĩa tiếng Việt':'kiên cường','Ví dụ':'example'}}
  const question=meaningQuestions([note],[{id:'n-custom',noteId:'n',lastRating:1}])[0]
  assert.equal(question.word,'resilient')
  assert.equal(question.meaning,'kiên cường')
  assert.equal(question.lang,'en-GB')
  assert.equal(question.rate,0.7)
})
test('answer matching supports case, punctuation, alternatives and preserves accents',()=>{
  assert.equal(matchesMeaning('KIÊN CƯỜNG!','Kiên cường; bền bỉ'),true)
  assert.equal(matchesMeaning('bền bỉ','Kiên cường; bền bỉ'),true)
  assert.equal(matchesMeaning('','meaning'),false)
  assert.equal(matchesMeaning('ma','má'),false)
  assert.equal(matchesMeaning('unrelated','kiên cường'),false)
})
test('random quiz avoids repeating previous word when alternatives exist',()=>{
  const pool=[{noteId:'a'},{noteId:'b'}]
  assert.equal(nextQuestion(pool,'a',()=>0).noteId,'b')
  assert.equal(nextQuestion([pool[0]],'a',()=>0).noteId,'a')
  assert.equal(nextQuestion([],undefined,()=>0),undefined)
})
test('reminders wait for interval and defer during editing, dialogs or active study',()=>{
  const state={now:300000,due:300000,visible:true,focused:true,hasDialog:false,reviewActive:false,editing:false}
  assert.equal(reminderReady(state),true)
  for(const patch of [{now:299999},{visible:false},{focused:false},{hasDialog:true},{reviewActive:true},{editing:true}])assert.equal(reminderReady({...state,...patch}),false)
})
