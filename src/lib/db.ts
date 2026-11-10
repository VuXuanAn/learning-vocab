import type { CloudMeta, LocalBackup } from './cloud-types'
import type { ReviewRecord } from './review'
import type { SavedReviewLog } from './review-storage'
import Dexie, { type Table } from 'dexie'
import type { CardTemplate } from './templates'
import type { VocabularyFolder } from './folders'
import type { Note } from './cards'

export class VocabDatabase extends Dexie {
  cloudMeta!: Table<CloudMeta, string>
  localBackups!: Table<LocalBackup, string>
  reviews!: Table<ReviewRecord, string>
  reviewLogs!: Table<SavedReviewLog, string>
  folders!: Table<VocabularyFolder, string>
  templates!: Table<CardTemplate, string>
  notes!: Table<Note, string>
  constructor(name = 'vocab-library') {
    super(name)
    this.version(1).stores({ notes: 'id, kind, createdAt' })
    this.version(2).stores({ notes: 'id, kind, createdAt', templates: 'id, name' })
    this.version(3).stores({ notes: 'id, kind, createdAt, folderId', templates: 'id, name', folders: 'id, &nameKey, createdAt' })
    this.version(4).stores({ notes: 'id, kind, createdAt, folderId', templates: 'id, name', folders: 'id, &nameKey, createdAt' }).upgrade(async transaction => {
      const folders = await transaction.table('folders').toArray()
      const ids = new Set(folders.map(folder => folder.id))
      const orphaned = transaction.table('notes').filter(note => !note.folderId || !ids.has(note.folderId))
      if (!await orphaned.count()) return
      let name = 'Từ vựng đã lưu'
      let suffix = 1
      while (folders.some(folder => folder.nameKey === name.toLocaleLowerCase('vi'))) name = 'Từ vựng đã lưu ' + suffix++
      const id = crypto.randomUUID()
      await transaction.table('folders').add({ id, name, nameKey: name.toLocaleLowerCase('vi'), createdAt: Date.now() })
      await orphaned.modify({ folderId: id })
    })
    this.version(5).stores({ notes: 'id, kind, createdAt, folderId', templates: 'id, name', folders: 'id, &nameKey, createdAt', reviews: 'id, noteId, due, state', reviewLogs: 'id, cardId, noteId' })
    this.version(6).stores({ notes: 'id, kind, createdAt, folderId', templates: 'id, name', folders: 'id, &nameKey, createdAt', reviews: 'id, noteId, due, state', reviewLogs: 'id, cardId, noteId', cloudMeta: 'id', localBackups: 'id, createdAt' })
  }
}
export let db = new VocabDatabase()
let activeUserId: string | null = null
export const getActiveUserId = () => activeUserId
export function accountDatabaseName(userId: string) {
  if (!userId.trim()) throw new Error('Account required')
  return 'vocab-library-account-' + encodeURIComponent(userId)
}
export function activateAccountDatabase(userId: string) {
  if (activeUserId && activeUserId !== userId) throw new Error('Reload required to switch accounts')
  if (activeUserId === userId) return db
  db.close()
  db = new VocabDatabase(accountDatabaseName(userId))
  activeUserId = userId
  return db
}

// Only a previously recorded owner can receive the old shared database.
// Unowned data stays untouched rather than being assigned to whoever logs in first.
export async function migrateOwnedLegacy(target: VocabDatabase, userId: string) {
  if (!await Dexie.exists('vocab-library')) return false
  const legacy = new VocabDatabase('vocab-library')
  try {
    const owner = await legacy.cloudMeta.get('current')
    if (owner?.userId !== userId) return false
    const data = await legacy.transaction('r', legacy.tables, async () => ({
      folders: await legacy.folders.toArray(), templates: await legacy.templates.toArray(),
      notes: await legacy.notes.toArray(), reviews: await legacy.reviews.toArray(),
      reviewLogs: await legacy.reviewLogs.toArray(),
      backups: (await legacy.localBackups.toArray()).filter(row => row.owner?.userId === userId), owner,
    }))
    return await target.transaction('rw', target.tables, async () => {
      if (await target.cloudMeta.get('current') || await target.notes.count() || await target.folders.count() || await target.templates.count()) return false
      await target.folders.bulkPut(data.folders)
      await target.templates.bulkPut(data.templates)
      await target.notes.bulkPut(data.notes)
      await target.reviews.bulkPut(data.reviews)
      await target.reviewLogs.bulkPut(data.reviewLogs)
      await target.localBackups.bulkPut(data.backups)
      await target.cloudMeta.put(data.owner)
      return true
    })
  } finally { legacy.close() }
}


