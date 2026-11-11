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
const source=read('../src/lib/account-workspace.ts').replace("'./db'",JSON.stringify(dbUrl)).replace("'./settings'",JSON.stringify(settingsUrl))
test('workspace opens row cache without cloud bootstrap or importing legacy data',async()=>{
 const {prepareAccountWorkspace}=await import(url(source))
 try{
  await prepareAccountWorkspace('workspace-user')
  assert.equal(database.db.name, 'vocab-rows-v1-account-workspace-user')
  assert.equal(await database.db.notes.count(),0)
  await database.db.folders.put({id:'f',name:'Local',nameKey:'local',createdAt:1})
  await prepareAccountWorkspace('workspace-user')
  assert.equal((await database.db.folders.get('f')).name,'Local')
 }finally{await database.db.delete()}
})
