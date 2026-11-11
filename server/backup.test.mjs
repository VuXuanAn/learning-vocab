import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const read=p=>readFileSync(new URL('../src/lib/'+p+'.ts',import.meta.url),'utf8')
const url=s=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s)).toString('base64')
const templatesUrl=url(read('templates'))
const cardsUrl=url(read('cards').replace("'./templates'",JSON.stringify(templatesUrl)))
const foldersUrl=url(read('folders'))
const codecUrl=url(read('row-codec'))
const preferencesUrl=url(read('preferences'))
const memory=new Map()
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)}
globalThis.window={localStorage}
const settingsUrl=url(read('settings').replace("'zustand'",JSON.stringify(import.meta.resolve('zustand'))).replace("'zustand/middleware'",JSON.stringify(import.meta.resolve('zustand/middleware'))).replace("'./preferences'",JSON.stringify(preferencesUrl)))
const dbUrl=url(read('db').replace("'dexie'",JSON.stringify(import.meta.resolve('dexie'))))
const formatUrl=url(read('backup-format').replace("'zod'",JSON.stringify(import.meta.resolve('zod'))).replace("'./cards'",JSON.stringify(cardsUrl)).replace("'./templates'",JSON.stringify(templatesUrl)))
const storageUrl=url(read('backup-storage').replace("'./db'",JSON.stringify(dbUrl)).replace("'./row-codec'",JSON.stringify(codecUrl)).replace("'./folders'",JSON.stringify(foldersUrl)).replace("'./settings'",JSON.stringify(settingsUrl)).replace("'./preferences'",JSON.stringify(preferencesUrl)).replace("'./backup-format'",JSON.stringify(formatUrl)))
const {VocabDatabase}=await import(dbUrl)
const {parseBackup,backupCounts}=await import(formatUrl)
const {exportBackup,importBackup}=await import(storageUrl)
const {generateCards}=await import(cardsUrl)
const {useSettings}=await import(settingsUrl)
const {aiTemplate}=await import(url(read('ai-batch')))
const custom={id:'t',name:'HTML card',format:'html',align:'left',fontSize:24,color:'#166534',fields:[{id:'a',name:'Front',required:true},{id:'b',name:'Back',required:true}],frontTemplate:'<b>{{Front}}</b>',backTemplate:'{{FrontSide}}<p>{{Back}}</p>',css:'b{color:red}',speech:{fieldId:'a',lang:'en-US',rate:1}}
function sample(){
 const base={back:'nghĩa',extra:'ghi chú',tags:'tag',createdAt:1,folderId:'f'}
 return {format:'vocab-library-backup',version:1,createdAt:new Date().toISOString(),folders:[{id:'f',name:'Root',nameKey:'root',createdAt:1,reverseCards:true,ownerId:'other',permission:'viewer'},{id:'child',name:'Child',nameKey:'child',parentId:'f',createdAt:2}],templates:[custom],notes:[
 {...base,id:'basic',kind:'basic',front:'word'},
 {...base,id:'reverse',kind:'reverse',front:'reverse'},
 {...base,id:'cloze',kind:'cloze',front:'{{c1::hello::hint}} {{c2::world}}'},
 {...base,id:'custom',kind:'custom',front:'html',template:custom,values:{Front:'<word>',Back:'meaning'}},
 {...base,id:'ai',kind:'ai',front:'effect',folderId:'child',template:aiTemplate,readOnly:true,values:{'Từ vựng':'effect','Nghĩa tiếng Việt':'tác động','Phiên âm IPA':'/ɪˈfekt/','Các dạng từ liên quan':'effective (adj): hiệu quả','__relatedNote:word':'basic','__relatedNote:outside':'not-in-file'}}],
 reviews:[{id:'ai-custom',noteId:'ai',due:'2026-12-01T00:00:00Z',last_review:'2026-11-01T00:00:00Z',stability:10,difficulty:3,elapsed_days:1,scheduled_days:30,learning_steps:0,reps:2,lapses:0,state:2,lastRating:3,revision:2}],
 reviewLogs:[{id:'log',noteId:'ai',cardId:'ai-custom',log:{due:'2026-11-01T00:00:00Z',review:'2026-11-01T00:00:00Z',rating:3,state:2,stability:10,difficulty:3,elapsed_days:1,last_elapsed_days:1,scheduled_days:30,learning_steps:0}}],preferences:{reminderEnabled:false,reminderMinutes:17,autoVoice:true}}
}

test('all five card types round-trip including HTML, cloze groups, links and FSRS dates',async()=>{
 const account=new VocabDatabase('backup-'+crypto.randomUUID())
 try{
  const data=parseBackup(sample())
  const before=backupCounts(data)
  assert.deepEqual(before.kinds,{basic:1,reverse:1,cloze:1,custom:1,ai:1})
  assert.equal(before.cards,7)
  await account.folders.add({id:'existing',name:'Keep',nameKey:'keep',createdAt:1})
  await account.notes.add({id:'basic',kind:'basic',folderId:'existing',front:'existing data',back:'keep',extra:'',tags:'',createdAt:1})
  const imported=await importBackup(JSON.parse(JSON.stringify(data)),{progress:true,preferences:false},account)
  assert.equal(imported.notes,5)
  assert.equal((await account.notes.get('basic')).front,'existing data')
  const rows=(await account.notes.toArray()).filter(n=>n.id!=='basic')
  assert.ok(rows.every(n=>!['basic','reverse','cloze','ai','custom'].includes(n.id)))
  assert.equal(rows.reduce((sum,n)=>sum+generateCards(n).length,0),7)
  const html=rows.find(n=>n.kind==='custom')
  assert.equal(html.template.css,custom.css)
  assert.equal(html.template.speech.fieldId,'a')
  assert.ok(generateCards(html)[0].front.includes('&lt;word&gt;'))
  const cloze=rows.find(n=>n.kind==='cloze')
  assert.equal(generateCards(cloze).length,2)
  assert.equal(cloze.front,data.notes[2].front)
  const ai=rows.find(n=>n.kind==='ai')
  assert.equal(ai.readOnly,undefined)
  assert.equal(ai.values['__relatedNote:word'],rows.find(n=>n.kind==='basic').id)
  assert.equal(ai.values['__relatedNote:outside'],undefined)
  const progress=await account.reviews.toCollection().first()
  assert.equal(progress.noteId,ai.id)
  assert.equal(progress.id,ai.id+'-custom')
  assert.equal(progress.due.toISOString(),new Date(data.reviews[0].due).toISOString())
  assert.equal(progress.revision,2)
  const log=await account.reviewLogs.toCollection().first()
  assert.equal(log.cardId,progress.id)
  assert.ok(log.log.review instanceof Date)
  assert.equal(await account.syncBackups.count(),1)
  const exported=await exportBackup('all',account)
  assert.equal(exported.notes.length,6)
  assert.equal(exported.reviews[0].due,new Date(data.reviews[0].due).toISOString())
  assert.ok(exported.folders.every(f=>!('ownerId' in f)&&!('permission' in f)))
 }finally{await account.delete()}
})

test('import without progress starts fresh and applies settings only on explicit choice',async()=>{
 const account=new VocabDatabase('backup-'+crypto.randomUUID())
 try{
  useSettings.getState().update({reminderEnabled:true,reminderMinutes:5,autoVoice:false})
  await importBackup(sample(),{progress:false,preferences:false},account)
  assert.equal(await account.reviews.count(),0)
  assert.equal(await account.reviewLogs.count(),0)
  assert.equal(useSettings.getState().autoVoice,false)
  await importBackup(sample(),{progress:true,preferences:true},account)
  assert.equal(await account.notes.count(),10)
  assert.equal(useSettings.getState().reminderMinutes,17)
  assert.equal(useSettings.getState().autoVoice,true)
 }finally{await account.delete()}
})

test('invalid versions, templates, orphan records and cyclic folders reject before writes',()=>{
 for(const change of [data=>{data.version=99},data=>{data.notes[4].template=undefined},data=>{data.notes[0].folderId='missing'},data=>{data.folders[0].parentId='child'},data=>{data.reviews[0].id='missing'},data=>{data.reviewLogs[0].cardId='missing'},data=>{data.notes[2].front='{{c0::invalid}}'},data=>{data.notes.push({...data.notes[0]})}]){
  const data=sample();change(data);assert.throws(()=>parseBackup(data))
 }
})

test('import transaction rolls back folders, cards, backups and preserves previous data on failure',async()=>{
 const account=new VocabDatabase('backup-'+crypto.randomUUID())
 try{
  await account.folders.add({id:'keep',name:'Keep',nameKey:'keep',createdAt:1})
  const fail=()=>{throw new Error('Disk full')}
  account.notes.hook('creating',fail)
  try{await assert.rejects(()=>importBackup(sample(),{progress:true,preferences:false},account),/Disk full/)}finally{account.notes.hook('creating').unsubscribe(fail)}
  assert.equal(await account.folders.count(),1)
  assert.equal(await account.notes.count(),0)
  assert.equal(await account.templates.count(),0)
  assert.equal(await account.reviews.count(),0)
  assert.equal(await account.syncBackups.count(),0)
 }finally{await account.delete()}
})

test('folder export includes descendants and ancestor paths, not sibling notes',async()=>{
 const account=new VocabDatabase('backup-'+crypto.randomUUID())
 try{
  const data=parseBackup(sample())
  await account.folders.bulkAdd(data.folders)
  await account.notes.bulkAdd(data.notes)
  const subset=await exportBackup('child',account)
  assert.deepEqual(subset.notes.map(n=>n.id),['ai'])
  assert.deepEqual(subset.folders.map(f=>f.id).sort(),['child','f'])
 }finally{await account.delete()}
})
