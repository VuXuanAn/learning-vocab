import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const url = s => 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(s)).toString('base64')
const dbUrl = url(read('../src/lib/db.ts').replace("'dexie'", JSON.stringify(import.meta.resolve('dexie'))))
const { VocabDatabase, activateAccountDatabase, accountDatabaseName, migrateOwnedLegacy } = await import(dbUrl)
const memory = new Map()
globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) }
globalThis.window = { localStorage }
const preferencesUrl = url(read('../src/lib/preferences.ts'))
const settingsUrl = url(read('../src/lib/settings.ts').replace("'zustand'", JSON.stringify(import.meta.resolve('zustand'))).replace("'zustand/middleware'", JSON.stringify(import.meta.resolve('zustand/middleware'))).replace("'./preferences'", JSON.stringify(preferencesUrl)))
const { useSettings, activateAccountSettings } = await import(settingsUrl)
const folder = { id:'same-id', name:'Private', nameKey:'private', createdAt:1 }

test('accounts isolate folders, notes, schedules, backups and preserve them on reopen', async () => {
 const a = new VocabDatabase(accountDatabaseName('test-a'))
 const b = new VocabDatabase(accountDatabaseName('test-b'))
 try {
  await a.folders.add(folder)
  await a.notes.add({id:'word',folderId:folder.id,front:'secret-a'})
  await a.reviews.add({id:'review',noteId:'word',due:new Date('2026-11-20')})
  await a.localBackups.add({id:'backup',createdAt:'2026-11-10'})
  for (const table of b.tables) assert.equal(await table.count(),0)
  await b.folders.add({...folder,name:'B folder'})
  await b.notes.add({id:'word',folderId:folder.id,front:'secret-b'})
  assert.equal((await a.notes.get('word')).front,'secret-a')
  a.close()
  await a.open()
  assert.equal((await a.notes.get('word')).front,'secret-a')
  assert.equal((await b.folders.get(folder.id)).name,'B folder')
 } finally { await a.delete(); await b.delete() }
})

test('legacy migration requires the recorded owner and never overwrites account data', async () => {
 const legacy = new VocabDatabase('vocab-library')
 const a = new VocabDatabase(accountDatabaseName('legacy-a'))
 const b = new VocabDatabase(accountDatabaseName('legacy-b'))
 try {
  await legacy.folders.add(folder)
  assert.equal(await migrateOwnedLegacy(a,'legacy-a'),false)
  assert.equal(await a.folders.count(),0)
  await legacy.cloudMeta.put({id:'current',userId:'legacy-a',revision:3,lastSyncAt:'2026-11-10'})
  await legacy.localBackups.bulkAdd([{id:'own',owner:{userId:'legacy-a'},createdAt:'2026-11-10'},{id:'other',owner:{userId:'legacy-b'},createdAt:'2026-11-10'}])
  assert.equal(await migrateOwnedLegacy(b,'legacy-b'),false)
  assert.equal(await migrateOwnedLegacy(a,'legacy-a'),true)
  assert.equal((await a.cloudMeta.get('current')).revision,3)
  assert.deepEqual((await a.localBackups.toArray()).map(x=>x.id),['own'])
  await a.folders.update(folder.id,{name:'Edited'})
  assert.equal(await migrateOwnedLegacy(a,'legacy-a'),false)
  assert.equal((await a.folders.get(folder.id)).name,'Edited')
  assert.equal(await legacy.folders.count(),1)
 } finally { await legacy.delete(); await a.delete(); await b.delete() }
})

test('preferences are scoped and an unknown account gets defaults', () => {
 activateAccountSettings('a')
 useSettings.getState().update({autoVoice:true,reminderMinutes:12})
 activateAccountSettings('b')
 assert.equal(useSettings.getState().autoVoice,false)
 assert.equal(useSettings.getState().reminderMinutes,5)
 useSettings.getState().update({reminderMinutes:30})
 activateAccountSettings('a')
 assert.equal(useSettings.getState().autoVoice,true)
 assert.equal(useSettings.getState().reminderMinutes,12)
})

test('a document cannot rebind its database to another account while work is in flight', async () => {
 const db = activateAccountDatabase('active-a')
 try {
  assert.equal(activateAccountDatabase('active-a'),db)
  assert.throws(()=>activateAccountDatabase('active-b'),/Reload required/)
  assert.throws(()=>accountDatabaseName(''))
 } finally { await db.delete() }
})
