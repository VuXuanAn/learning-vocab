import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const url=s=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s)).toString('base64')
const preferencesUrl=url(read('../src/lib/preferences.ts'))
const {defaultPreferences}=await import(preferencesUrl)
const {createPreferencesSync}=await import(url(read('../src/lib/preferences-sync.ts').replace("'./preferences'",JSON.stringify(preferencesUrl))))
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(check){for(let i=0;i<500;i++){if(check())return;await delay(2)}throw new Error('Timed out')}
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}}
function fixture({userId='a',memory=new Map(),remote={...defaultPreferences},load,save,initial={...defaultPreferences}}={}){
 let state={...initial},cloud=remote,status,applies=0,calls=[]
 const listeners=new Set()
 const sync=createPreferencesSync({userId,debounceMs:5,read:()=>state,apply:value=>{applies++;state={...value};listeners.forEach(fn=>fn())},subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},storage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},status:next=>{status=next},remote:{load:load??(async()=>cloud),save:async patch=>{calls.push({...patch});if(save)return save(patch);cloud={...defaultPreferences,...cloud,...patch};return cloud}}})
 return {sync,calls,memory,get state(){return state},get status(){return status},get applies(){return applies},setCloud:value=>{cloud=value},edit:patch=>{state={...state,...patch};listeners.forEach(fn=>fn())}}
}

test('loads account settings without echoing a write back',async()=>{
 const f=fixture({remote:{...defaultPreferences,autoVoice:true,reminderMinutes:17}})
 try{await until(()=>f.status?.phase==='saved');assert.equal(f.state.autoVoice,true);assert.equal(f.state.reminderMinutes,17);assert.equal(f.calls.length,0)}finally{f.sync.stop()}
})

test('first use saves current settings when no cloud row exists',async()=>{
 const f=fixture({remote:null,initial:{...defaultPreferences,reminderMinutes:12}})
 try{await until(()=>f.status?.phase==='saved');assert.deepEqual(f.calls,[{...defaultPreferences,reminderMinutes:12}])}finally{f.sync.stop()}
})

test('rapid changes debounce and merge only changed fields with current cloud settings',async()=>{
 const f=fixture()
 try{
  await until(()=>f.status?.phase==='saved')
  f.setCloud({...defaultPreferences,reminderMinutes:30})
  f.edit({autoVoice:true});f.edit({reminderEnabled:false})
  await until(()=>f.calls.length===1&&f.status?.phase==='saved')
  assert.deepEqual(f.calls,[{autoVoice:true,reminderEnabled:false}])
  assert.equal(f.state.reminderMinutes,30)
 }finally{f.sync.stop()}
})

test('edits during loading and in-flight saves are never overwritten by stale responses',async()=>{
 const loading=deferred(),saving=deferred();let index=0
 const f=fixture({load:()=>loading.promise,save:async patch=>{index++;if(index===1)return saving.promise;return {...defaultPreferences,...patch}}})
 try{
  f.edit({autoVoice:true})
  loading.resolve({...defaultPreferences})
  await until(()=>f.calls.length===1)
  f.edit({autoVoice:false})
  saving.resolve({...defaultPreferences,autoVoice:true})
  await until(()=>f.calls.length===2&&f.status?.phase==='saved')
  assert.deepEqual(f.calls,[{autoVoice:true},{autoVoice:false}])
  assert.equal(f.state.autoVoice,false)
 }finally{f.sync.stop()}
})

test('failed settings writes survive reload and retry only for the owning account',async()=>{
 const memory=new Map()
 const first=fixture({memory,save:async()=>{throw new Error('offline')}})
 await until(()=>first.status?.phase==='saved')
 first.edit({autoVoice:true})
 await until(()=>first.status?.phase==='error')
 first.sync.stop()
 assert.deepEqual(JSON.parse(memory.get('vocab-settings-sync-a')),{autoVoice:true})
 const other=fixture({memory,userId:'b'})
 const resumed=fixture({memory,userId:'a'})
 try{
  await until(()=>other.status?.phase==='saved'&&resumed.status?.phase==='saved')
  assert.equal(other.state.autoVoice,false)
  assert.equal(other.calls.length,0)
  assert.equal(resumed.state.autoVoice,true)
  assert.deepEqual(resumed.calls,[{autoVoice:true}])
  assert.deepEqual(JSON.parse(memory.get('vocab-settings-sync-a')),{})
 }finally{other.sync.stop();resumed.sync.stop()}
})

test('stopped synchronization ignores an old account response',async()=>{
 const loading=deferred()
 const f=fixture({load:()=>loading.promise})
 f.sync.stop()
 loading.resolve({...defaultPreferences,autoVoice:true})
 await delay(15)
 assert.equal(f.applies,0)
 assert.equal(f.calls.length,0)
})

test('focus retry loads settings changed on another device',async()=>{
 const f=fixture()
 try{
  await until(()=>f.status?.phase==='saved')
  f.setCloud({...defaultPreferences,reminderMinutes:60})
  f.sync.retry()
  await until(()=>f.state.reminderMinutes===60)
  assert.equal(f.calls.length,0)
 }finally{f.sync.stop()}
})
