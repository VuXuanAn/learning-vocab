import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const source=stripTypeScriptTypes(readFileSync('src/lib/manual-row-sync.ts','utf8'))
const {createManualRowSync}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
test('manual sync remains idle until requested and does not retry failed requests',async()=>{
 let calls=0,status
 const sync=createManualRowSync({online:()=>true,status:next=>{status=next},cycle:async()=>{calls++;throw new Error('network')}})
 assert.equal(calls,0)
 await sync.request();assert.equal(calls,1);assert.equal(status.phase,'error')
 await new Promise(resolve=>setTimeout(resolve,25));assert.equal(calls,1)
 await sync.request();assert.equal(calls,2)
 sync.stop()
})
test('manual sync prevents overlap and never queues an automatic follow-up',async()=>{
 let calls=0,release,status
 const sync=createManualRowSync({online:()=>true,status:next=>{status=next},cycle:async()=>{calls++;await new Promise(resolve=>{release=resolve})}})
 const running=sync.request('merge');assert.equal(calls,1)
 await sync.request('merge');assert.equal(calls,1)
 release();await running;assert.equal(status.phase,'saved');assert.equal(calls,1)
 sync.stop()
})
test('offline and stopped sessions never call the transport; reconnection requires another request',async()=>{
 let online=false,calls=0,status
 const sync=createManualRowSync({online:()=>online,status:next=>{status=next},cycle:async()=>{calls++}})
 await sync.request();assert.equal(calls,0);assert.equal(status.error.code,'OFFLINE')
 online=true;assert.equal(calls,0)
 await sync.request();assert.equal(calls,1)
 sync.stop();await sync.request();assert.equal(calls,1)
})
