import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const read=p=>readFileSync('src/lib/'+p+'.ts','utf8')
const url=source=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64')
const dbUrl=url(read('db').replace("'dexie'",JSON.stringify(import.meta.resolve('dexie'))))
const {VocabDatabase}=await import(dbUrl)
const {addCachedWord,fillCachedWords,removeCachedWords}=await import(url(read('vocabulary-cache').replace("'./db'",JSON.stringify(dbUrl))))
test('cache persists across reopen, deduplicates normalized phrases and stays isolated per account',async()=>{
 const first=new VocabDatabase('cache-first-'+crypto.randomUUID()),second=new VocabDatabase('cache-second-'+crypto.randomUUID())
 try{
  assert.equal(await addCachedWord('  break  the ice  ',first),true)
  assert.equal(await addCachedWord('BREAK THE ICE',first),false)
  first.close();await first.open()
  assert.equal(await first.vocabularyCache.count(),1)
  assert.equal((await first.vocabularyCache.toArray())[0].text,'break the ice')
  assert.equal(await second.vocabularyCache.count(),0)
  await assert.rejects(()=>addCachedWord('x'.repeat(201),first))
 }finally{await first.delete();await second.delete()}
})
test('filling preserves existing words, skips duplicates and leaves overflow cached until successful save',async()=>{
 const db=new VocabDatabase('cache-fill-'+crypto.randomUUID())
 try{
  for(let index=0;index<25;index++)await addCachedWord('word '+index,db)
  const cached=await db.vocabularyCache.orderBy('createdAt').toArray()
  const result=fillCachedWords(['WORD 0','already entered'],cached)
  assert.equal(result.words.length,20);assert.equal(result.added,18)
  assert.equal(result.words[0],'WORD 0');assert.equal(result.words[1],'already entered')
  assert.equal(await db.vocabularyCache.count(),25)
  // Only the subset of input words whose cards were actually saved is consumed.
  await removeCachedWords(['WORD 0','word 1'],db)
  assert.equal(await db.vocabularyCache.count(),23)
  assert.ok(await db.vocabularyCache.get('word 24'))
  const full=fillCachedWords(result.words,cached)
  assert.equal(full.added,0);assert.equal(full.words.length,20)
 }finally{await db.delete()}
})
