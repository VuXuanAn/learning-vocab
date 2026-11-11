import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { unlinkSync, existsSync, readFileSync } from 'node:fs'
import { createUsageStore, meteredClient } from './usage.mjs'
import { createApp } from './app.mjs'

test('usage sums tokens and requests by model with Vietnamese day/month boundaries',()=>{
 let clock=new Date('2026-11-10T16:59:59Z')
 const store=createUsageStore({now:()=>clock})
 store.record('a',{input_tokens:10,output_tokens:3})
 store.record('a',undefined,true)
 store.record('b',{input_tokens:999,output_tokens:1})
 assert.equal(store.summary('a').today.totalTokens,13)
 assert.equal(store.summary('a').today.requests,2)
 assert.equal(store.summary('a').today.failures,1)
 assert.equal(store.summary('a').today.missingUsage,1)
 clock=new Date('2026-11-10T17:00:00Z')
 assert.equal(store.summary('a').day,'2026-11-11')
 assert.equal(store.summary('a').today.totalTokens,0)
 assert.equal(store.summary('a').monthUsage.totalTokens,13)
 clock=new Date('2026-11-30T17:00:00Z')
 assert.equal(store.summary('a').month,'2026-12')
 assert.equal(store.summary('a').monthUsage.totalTokens,0)
 assert.equal(store.summary('a').quotaRemaining,null)
})

test('persistent metrics survive restart without storing request content',()=>{
 const file=join(tmpdir(),'vocab-usage-'+randomUUID()+'.json')
 try{
  const store=createUsageStore({file})
  store.record('test-model',{input_tokens:14,output_tokens:5})
  const restored=createUsageStore({file})
  assert.equal(restored.summary('test-model').today.totalTokens,19)
  assert.equal(restored.summary('test-model').today.requests,1)
  const text=readFileSync(file,'utf8')
  assert.equal(text.includes('prompt'),false)
  assert.equal(text.includes('apiKey'),false)
 }finally{if(existsSync(file))unlinkSync(file);if(existsSync(file+'.tmp'))unlinkSync(file+'.tmp')}
})

test('meter counts successful, incomplete and failed provider calls without changing results',async()=>{
 const store=createUsageStore()
 const value={status:'incomplete',usage:{input_tokens:2,output_tokens:7}}
 const client=meteredClient({responses:{create:async()=>value}},store)
 assert.equal(await client.responses.create({model:'test'}),value)
 const failure=new Error('provider error')
 const failing=meteredClient({responses:{create:async()=>{throw failure}}},store)
 await assert.rejects(()=>failing.responses.create({model:'test'}),error=>error===failure)
 assert.equal(store.summary('test').today.failures,2)
 assert.equal(store.summary('test').today.totalTokens,9)
 assert.equal(store.summary('test').today.missingUsage,1)
})

test('usage endpoint reads locally and records real generation usage without extra provider calls',async()=>{
 let calls=0
 const client={responses:{create:async()=>{calls++;return {status:'completed',output_text:JSON.stringify({rows:[{index:0,spelling:{status:'correct',suggestion:'',reason:''},values:{f0:'nghĩa'}}]}),usage:{input_tokens:11,output_tokens:4}}}}}
 const server=createApp({client,model:'test'}).listen(0,'127.0.0.1')
 await once(server,'listening')
 const base='http://127.0.0.1:'+server.address().port
 try{
  const first=await (await fetch(base+'/api/ai/usage')).json()
  assert.equal(first.today.requests,0)
  assert.equal(calls,0)
  const response=await fetch(base+'/api/ai/generate-batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({words:['effect'],sourceFieldId:'word',fields:[{id:'word',name:'Word'},{id:'meaning',name:'Meaning'}]})})
  assert.equal(response.status,200)
  const stats=await (await fetch(base+'/api/ai/usage')).json()
  assert.equal(calls,1)
  assert.equal(stats.today.requests,1)
  assert.equal(stats.today.totalTokens,15)
  assert.equal(stats.aiConfigured,true)
  assert.equal(stats.scope,'backend')
  assert.equal(stats.quotaRemaining,null)
  assert.equal((await fetch(base+'/api/ai/usage',{headers:{Origin:'https://untrusted.example'}})).status,403)
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
})
