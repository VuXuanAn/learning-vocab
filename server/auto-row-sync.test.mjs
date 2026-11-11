import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const source=readFileSync(new URL('../src/lib/auto-row-sync.ts',import.meta.url),'utf8')
const {createAutoRowSync}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'))
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(check){for(let i=0;i<200;i++){if(check())return;await delay(2)}throw new Error('Timeout')}

test('changes debounce into one two-way cycle',async()=>{
 let calls=0,mode
 const sync=createAutoRowSync({debounceMs:10,online:()=>true,status:()=>{},cycle:async next=>{calls++;mode=next}})
 try{sync.changed();sync.changed();sync.changed();await until(()=>calls===1);await delay(20);assert.equal(calls,1);assert.equal(mode,'merge')}finally{sync.stop()}
})

test('changes made during a request queue one follow-up without overlapping',async()=>{
 let calls=0,active=0,max=0,release
 const sync=createAutoRowSync({online:()=>true,status:()=>{},cycle:async()=>{calls++;active++;max=Math.max(max,active);if(calls===1)await new Promise(done=>{release=done});active--}})
 try{sync.request();await until(()=>!!release);sync.changed();sync.changed();release();await until(()=>calls===2);assert.equal(max,1);assert.equal(calls,2)}finally{sync.stop()}
})

test('offline changes wait for connectivity and retry via a merge',async()=>{
 let online=false,calls=0,status
 const sync=createAutoRowSync({online:()=>online,status:next=>{status=next},cycle:async()=>{calls++}})
 try{sync.request();assert.equal(status.error.code,'OFFLINE');assert.equal(calls,0);online=true;sync.request();await until(()=>status.phase==='saved');assert.equal(calls,1)}finally{sync.stop()}
})

test('network failures retry with backoff and preserve the failed status until retry',async()=>{
 let calls=0,status
 const sync=createAutoRowSync({retryMs:10,online:()=>true,status:next=>{status=next},cycle:async()=>{calls++;if(calls===1)throw new Error('network')}})
 try{sync.request();await until(()=>status.phase==='error');await until(()=>status.phase==='saved');assert.equal(calls,2)}finally{sync.stop()}
})

test('stopping cancels scheduled changes and ignores a late response after account exit',async()=>{
 let calls=0,status,release,active
 const scheduled=createAutoRowSync({debounceMs:10,online:()=>true,status:()=>{},cycle:async()=>{calls++}})
 scheduled.changed();scheduled.stop();await delay(20);assert.equal(calls,0)
 const running=createAutoRowSync({online:()=>true,status:next=>{status=next},cycle:async (_mode,isActive)=>{active=isActive;await new Promise(done=>{release=done})}})
 running.request();await until(()=>!!release);running.stop();assert.equal(active(),false);release();await delay(10);assert.notEqual(status.phase,'saved')
})

test('closing-page flush starts a cycle immediately without waiting for a debounce timer',async()=>{
 let calls=0
 const sync=createAutoRowSync({online:()=>true,status:()=>{},cycle:async()=>{calls++}})
 try{sync.changed();sync.request('merge');assert.equal(calls,1)}finally{sync.stop()}
})

