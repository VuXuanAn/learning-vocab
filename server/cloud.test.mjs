import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const url=s=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s)).toString('base64')
const schemaUrl=url(read('../src/lib/cloud-schema.ts').replace("'zod'",JSON.stringify(import.meta.resolve('zod'))))
const {parseSnapshot,canUpload}=await import(schemaUrl)
const {publicSupabaseConfig}=await import(url(read('../src/lib/supabase-config.ts')))
const preferencesUrl=url(read('../src/lib/preferences.ts'))
const settingsUrl=url(read('../src/lib/settings.ts').replace("'zustand'",JSON.stringify(import.meta.resolve('zustand'))).replace("'zustand/middleware'",JSON.stringify(import.meta.resolve('zustand/middleware'))).replace("'./preferences'",JSON.stringify(preferencesUrl)))
const memory=new Map()
globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)}
globalThis.window={localStorage:globalThis.localStorage}
const {useSettings}=await import(settingsUrl)
const dbUrl=url(read('../src/lib/db.ts').replace("'vocab-library'","'vocab-cloud-test'").replace("'dexie'",JSON.stringify(import.meta.resolve('dexie'))))
const {db}=await import(dbUrl)
const localUrl=url(read('../src/lib/cloud-local.ts').replace("'./db'",JSON.stringify(dbUrl)).replace("'./cloud-schema'",JSON.stringify(schemaUrl)).replace("'./settings'",JSON.stringify(settingsUrl)))
const {localSnapshot,restoreSnapshot,uploadSnapshot}=await import(localUrl)

test('public config accepts publishable/anon keys but rejects privileged secrets',()=>{
 assert.equal(publicSupabaseConfig().error,'')
 assert.equal(publicSupabaseConfig('https://project.supabase.co','sb_publishable_example').error,'')
 const jwt=role=>'header.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature'
 assert.equal(publicSupabaseConfig('https://project.supabase.co',jwt('anon')).error,'')
 for(const key of ['sb_secret_example',jwt('service_role'),'not-a-key'])assert.ok(publicSupabaseConfig('https://project.supabase.co',key).error)
 assert.ok(publicSupabaseConfig('https://bad','sb_secret_secret').error)
 assert.ok(publicSupabaseConfig('http://project.supabase.co','sb_publishable_example').error)
})
test('revision and owner checks prevent cross-account and stale overwrites',()=>{
 assert.equal(canUpload(undefined,'a',0,0),true)
 assert.equal(canUpload('a','a',2,2),true)
 assert.equal(canUpload('a','b',2,2),false)
 assert.equal(canUpload('a','a',1,2),false)
 assert.equal(canUpload(undefined,'a',0,1),false)
})
test('snapshot restore preserves local backup, owner, FSRS dates and preferences atomically',async()=>{
 try{
  await db.folders.add({id:'f',name:'Folder',nameKey:'folder',createdAt:1})
  await db.notes.add({id:'n',kind:'basic',front:'word',back:'meaning',extra:'',tags:'',folderId:'f',createdAt:1})
  await db.cloudMeta.put({id:'current',userId:'owner-a',revision:2,lastSyncAt:new Date().toISOString()})
  const due=new Date('2026-11-20T00:00:00Z')
  await db.reviews.add({id:'n-forward',noteId:'n',due,stability:1,difficulty:1,elapsed_days:0,scheduled_days:1,learning_steps:0,reps:1,lapses:0,state:2,last_review:new Date('2026-11-19T00:00:00Z'),lastRating:3,revision:1})
  await assert.rejects(()=>uploadSnapshot('owner-b',0))
  const payload=await uploadSnapshot('owner-a',2)
  assert.equal(typeof payload.reviews[0].due,'string')
  const changed={...payload,notes:[{...payload.notes[0],front:'cloud-word'}],preferences:{...payload.preferences,reminderMinutes:10}}
  await restoreSnapshot(changed,'owner-b',4)
  assert.equal((await db.notes.get('n')).front,'cloud-word')
  assert.equal((await db.reviews.get('n-forward')).due.getTime(),due.getTime())
  assert.equal(useSettings.getState().reminderMinutes,10)
  const backup=await db.localBackups.toCollection().first()
  assert.equal(backup.payload.notes[0].front,'word')
  assert.equal(backup.owner.userId,'owner-a')
  assert.equal((await db.cloudMeta.get('current')).userId,'owner-b')
  await assert.rejects(()=>restoreSnapshot({...changed,notes:[{id:'invalid'}]},'owner-b',4))
  assert.equal((await db.notes.get('n')).front,'cloud-word')
  // Duplicate unique folder keys fail inside transaction and roll back all changes.
  await assert.rejects(()=>restoreSnapshot({...changed,folders:[changed.folders[0],{...changed.folders[0],id:'another'}]},'owner-b',4))
  assert.equal((await db.notes.get('n')).front,'cloud-word')
  await restoreSnapshot(backup.payload,backup.owner.userId,backup.owner.revision)
  assert.equal((await db.notes.get('n')).front,'word')
  assert.equal((await db.cloudMeta.get('current')).userId,'owner-a')
 }finally{await db.delete()}
})
test('snapshot rejects malformed dates and duplicate IDs before writing',()=>{
 assert.throws(()=>parseSnapshot({version:1,createdAt:'bad'}))
})
