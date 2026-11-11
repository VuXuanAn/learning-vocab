import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const source=readFileSync('src/lib/drive-connection.ts','utf8').replace("'zustand'",JSON.stringify(import.meta.resolve('zustand'))).replace("import { checkDrive } from './google-drive'",'const checkDrive=async()=>{}')
const {createDriveConnectionStore}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'))
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
test('Drive check is shared across repeated initialization and completed page visits',async()=>{
 const wait=deferred();let calls=0
 const store=createDriveConnectionStore(async()=>{calls++;await wait.promise})
 const first=store.getState().initialize('user','token')
 const second=store.getState().initialize('user','token')
 assert.equal(first,second);await Promise.resolve();assert.equal(calls,1)
 wait.resolve();await first
 await store.getState().initialize('user','token')
 assert.equal(calls,1);assert.equal(store.getState().ready,true)
 await store.getState().initialize('user','token',true)
 assert.equal(calls,2)
})
test('old account check cannot overwrite newer connection or logout',async()=>{
 const waits=[deferred(),deferred()];let calls=0
 const store=createDriveConnectionStore(()=>waits[calls++].promise)
 const first=store.getState().initialize('a','token-a');await Promise.resolve()
 const second=store.getState().initialize('b','token-b');await Promise.resolve()
 waits[1].resolve();await second
 waits[0].reject(new Error('Old token'));await first
 assert.equal(store.getState().ready,true)
 store.getState().reset();assert.equal(store.getState().ready,false)
})
test('authorization failure invalidates shared state without rechecking on navigation',async()=>{
 let calls=0
 const store=createDriveConnectionStore(async()=>{calls++})
 await store.getState().initialize('a','t')
 store.getState().invalidate('Expired')
 await store.getState().initialize('a','t')
 assert.equal(calls,1);assert.equal(store.getState().ready,false);assert.equal(store.getState().error,'Expired')
 await store.getState().initialize('a','fresh-token')
 assert.equal(calls,2);assert.equal(store.getState().ready,true)
})
