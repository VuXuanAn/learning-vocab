import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import Dexie from 'dexie'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'

const name = 'vocab-library-storage-tests'
const asUrl = source => 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64')
const note = (id, folderId) => ({ id, folderId, kind: 'basic', front: 'word', back: 'meaning', extra: '', tags: '', createdAt: Date.now() })
const legacy = new Dexie(name)
legacy.version(3).stores({ notes: 'id, kind, createdAt, folderId', templates: 'id, name', folders: 'id, &nameKey, createdAt' })
await legacy.open()
await legacy.table('folders').add({ id: 'existing', name: 'Existing', nameKey: 'existing', createdAt: 1 })
await legacy.table('notes').bulkAdd([note('legacy-empty', ''), note('legacy-undefined', undefined), note('legacy-orphan', 'gone'), note('valid', 'existing')])
legacy.close()
const dbSource = readFileSync(new URL('../src/lib/db.ts', import.meta.url), 'utf8').replace("'vocab-library'", JSON.stringify(name)).replace("'dexie'", JSON.stringify(import.meta.resolve('dexie')))
const dbUrl = asUrl(dbSource)
const { db } = await import(dbUrl)
const storageSource = readFileSync(new URL('../src/lib/folder-storage.ts', import.meta.url), 'utf8').replace("'./db'", JSON.stringify(dbUrl))
const { saveNotesToFolder, deleteEmptyFolder } = await import(asUrl(storageSource))

test('folder integrity and migration', async context => {
  try {
    await db.open()
    await context.test('migrates all unfiled/orphaned notes without altering valid folders', async () => {
      const migrated = await db.folders.where('nameKey').equals('từ vựng đã lưu').first()
      assert.ok(migrated)
      for (const id of ['legacy-empty', 'legacy-undefined', 'legacy-orphan']) assert.equal((await db.notes.get(id)).folderId, migrated.id)
      assert.equal((await db.notes.get('valid')).folderId, 'existing')
      assert.equal(await db.notes.count(), 4)
    })
    await context.test('rejects absent, missing, all or mismatched folders', async () => {
      for (const id of ['', 'all', 'deleted']) await assert.rejects(() => saveNotesToFolder([note('bad', id)], id))
      await assert.rejects(() => saveNotesToFolder([note('bad', 'wrong')], 'existing'))
      assert.equal(await db.notes.get('bad'), undefined)
    })
    await context.test('saves to chosen folder and rolls back whole batch on duplicate IDs', async () => {
      await saveNotesToFolder([note('new', 'existing')], 'existing')
      assert.equal((await db.notes.get('new')).folderId, 'existing')
      await assert.rejects(() => saveNotesToFolder([note('rolled-back', 'existing'), note('new', 'existing')], 'existing'))
      assert.equal(await db.notes.get('rolled-back'), undefined)
    })
    await context.test('blocks deletion of populated folder and preserves notes', async () => {
      await assert.rejects(() => deleteEmptyFolder('existing'))
      assert.ok(await db.folders.get('existing'))
      assert.ok(await db.notes.get('valid'))
    })
    await context.test('deletes empty folder and reparents children without orphaning notes', async () => {
      await db.folders.bulkAdd([{ id: 'empty', name: 'Empty', nameKey: 'empty', parentId: 'existing', createdAt: 1 }, { id: 'child', name: 'Child', nameKey: 'child', parentId: 'empty', createdAt: 1 }])
      await deleteEmptyFolder('empty')
      assert.equal(await db.folders.get('empty'), undefined)
      assert.equal((await db.folders.get('child')).parentId, 'existing')
    })
  } finally { await db.delete() }
})
