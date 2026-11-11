import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const source=stripTypeScriptTypes(readFileSync(new URL('../src/lib/local-review-session.ts',import.meta.url),'utf8'))
const {reviewSessionKey,readReviewSession,writeReviewSession}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
function store(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}}
const session={ids:['b','c'],total:3,attempts:1,directions:{folder:true},currentId:'c'}
test('resume remaining cards, progress and active card per account and folder',()=>{
 const storage=store(),key=reviewSessionKey('account1','folder1')
 writeReviewSession(storage,key,session)
 assert.deepEqual(readReviewSession(storage,key),session)
 assert.equal(readReviewSession(storage,reviewSessionKey('account1','folder2')),null)
 assert.equal(readReviewSession(storage,reviewSessionKey('account2','folder1')),null)
 writeReviewSession(storage,key,{...session,ids:[],attempts:3})
 assert.equal(readReviewSession(storage,key).ids.length,0)
 writeReviewSession(storage,key,null)
 assert.equal(readReviewSession(storage,key),null)
})
test('invalid local snapshots safely fall back to no session',()=>{
 const storage=store()
 for(const value of ['bad',JSON.stringify({...session,total:0}),JSON.stringify({...session,ids:['b','b']}),JSON.stringify({...session,attempts:-1})]){
  storage.setItem('key',value)
  assert.equal(readReviewSession(storage,'key'),null)
 }
})
