import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const url = s => 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(s)).toString('base64')
const dbUrl = url(read('../src/lib/db.ts').replace("'dexie'", JSON.stringify(import.meta.resolve('dexie'))))
const { VocabDatabase, activateAccountDatabase, accountDatabaseName } = await import(dbUrl)
const memory = new Map()
globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) }
globalThis.window = { localStorage }
const preferencesUrl = url(read('../src/lib/preferences.ts'))
const settingsUrl = url(read('../src/lib/settings.ts').replace("'zustand'", JSON.stringify(import.meta.resolve('zustand'))).replace("'zustand/middleware'", JSON.stringify(import.meta.resolve('zustand/middleware'))).replace("'./preferences'", JSON.stringify(preferencesUrl)))
const { useSettings, activateAccountSettings } = await import(settingsUrl)
const folder = { id:'same-id', name:'Private', nameKey:'private', createdAt:1 }

test('accounts isolate folders, notes, schedules, sync metadata and preserve them on reopen', async () => {
 const a = new VocabDatabase(accountDatabaseName('test-a'))
 const b = new VocabDatabase(accountDatabaseName('test-b'))
 try {
  await a.folders.add(folder)
  await a.notes.add({id:'word',folderId:folder.id,front:'secret-a'})
  await a.reviews.add({id:'review',noteId:'word',due:new Date('2026-11-20')})
  await a.syncRows.add({key:'notes:word',table:'notes',id:'word',remote:{},value:{front:'secret-a'}})
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

test('new cache namespace excludes old account data without importing it', async () => {
 const old = new VocabDatabase('vocab-library-account-old-user')
 const fresh = new VocabDatabase(accountDatabaseName('old-user'))
 try {
  await old.folders.add(folder)
  assert.notEqual(old.name, fresh.name)
  assert.equal(await fresh.folders.count(), 0)
  assert.equal(await old.folders.count(), 1)
 } finally { await old.delete(); await fresh.delete() }
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
