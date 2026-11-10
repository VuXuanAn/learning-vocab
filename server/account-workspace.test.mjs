import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const url=s=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s)).toString('base64')
const dbUrl=url(read('../src/lib/db.ts').replace("'dexie'",JSON.stringify(import.meta.resolve('dexie'))))
const database=await import(dbUrl)
const memory=new Map()
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)}
globalThis.window={localStorage}
const preferencesUrl=url(read('../src/lib/preferences.ts'))
const settingsUrl=url(read('../src/lib/settings.ts').replace("'zustand'",JSON.stringify(import.meta.resolve('zustand'))).replace("'zustand/middleware'",JSON.stringify(import.meta.resolve('zustand/middleware'))).replace("'./preferences'",JSON.stringify(preferencesUrl)))
const schemaUrl=url(read('../src/lib/cloud-schema.ts').replace("'zod'",JSON.stringify(import.meta.resolve('zod'))))
const localUrl=url(read('../src/lib/cloud-local.ts').replace("'./db'",JSON.stringify(dbUrl)).replace("'./settings'",JSON.stringify(settingsUrl)).replace("'./cloud-schema'",JSON.stringify(schemaUrl)))
let calls=0, fail=true
const payload={version:1,createdAt:new Date().toISOString(),folders:[{id:'f',name:'Cloud',nameKey:'cloud',createdAt:1}],templates:[],notes:[],reviews:[],reviewLogs:[],preferences:{autoVoice:true,reminderEnabled:true,reminderMinutes:9}}
globalThis.workspaceSupabase={from:()=>({select:()=>({eq:(_column,userId)=>({maybeSingle:async()=>{
 assert.equal(userId,'workspace-user');calls++
 return fail?{error:new Error('offline')}:{data:{payload,revision:4,updated_at:new Date().toISOString()}}
}})})})}
const supabaseUrl=url('export const supabase = globalThis.workspaceSupabase')
const source=read('../src/lib/account-workspace.ts').replace("'./db'",JSON.stringify(dbUrl)).replace("'./settings'",JSON.stringify(settingsUrl)).replace("'./cloud-local'",JSON.stringify(localUrl)).replace("'./supabase'",JSON.stringify(supabaseUrl))
test('fresh workspace retries cloud errors, restores once and preserves subsequent local edits',async()=>{
 try{
  const {prepareAccountWorkspace}=await import(url(source))
  await assert.rejects(()=>prepareAccountWorkspace('workspace-user'),/offline/)
  fail=false
  await prepareAccountWorkspace('workspace-user')
  assert.equal((await database.db.folders.get('f')).name,'Cloud')
  assert.equal((await database.db.cloudMeta.get('current')).revision,4)
  const {useSettings}=await import(settingsUrl)
  assert.equal(useSettings.getState().reminderMinutes,9)
  await database.db.folders.update('f',{name:'Local edit'})
  // Simulate a new page preparation with the same persisted account database.
  const fresh=await import(url(source+'\n// New document'))
  await fresh.prepareAccountWorkspace('workspace-user')
  assert.equal(calls,2)
  assert.equal((await database.db.folders.get('f')).name,'Local edit')
 }finally{await database.db.delete()}
})
