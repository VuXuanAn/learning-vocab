import type { ReadingFolder, ReadingArticle, ReadingStudyNote } from './reading-types'
import type { ShadowingFolder, ShadowingLesson } from './shadowing-types'
import type { SpeakingRecording } from './speaking'
import type { ReviewRecord } from './review'
import type { SavedReviewLog } from './review-storage'
import Dexie, { type Table } from 'dexie'
import type { CardTemplate } from './templates'
import type { VocabularyFolder } from './folders'
import type { Note } from './cards'
import type { SyncedRow } from './row-codec'

export class VocabDatabase extends Dexie {
  readingStudyNotes!: Table<ReadingStudyNote, string>
  readingFolders!: Table<ReadingFolder, string>
  readingArticles!: Table<ReadingArticle, string>
  shadowingFolders!: Table<ShadowingFolder, string>
  shadowingLessons!: Table<ShadowingLesson, string>
  speakingRecordings!: Table<SpeakingRecording, string>
  syncRows!: Table<SyncedRow, string>
  syncMeta!: Table<{ id: string; lastSyncAt: string; mode: string }, string>
  syncBackups!: Table<{ id: string; createdAt: string; tables: Record<string, unknown[]>; bases: SyncedRow[] }, string>
  reviews!: Table<ReviewRecord, string>
  reviewLogs!: Table<SavedReviewLog, string>
  folders!: Table<VocabularyFolder, string>
  templates!: Table<CardTemplate, string>
  notes!: Table<Note, string>
  constructor(name = 'vocab-rows-unassigned') {
    super(name)
    // A new namespace intentionally excludes all legacy snapshot caches.
    this.version(1).stores({
      notes: 'id, kind, createdAt, folderId', templates: 'id, name',
      folders: 'id, nameKey, createdAt', reviews: 'id, noteId, due, state',
      reviewLogs: 'id, cardId, noteId', syncRows: 'key, table, id',
    })
    this.version(2).stores({ syncMeta: 'id', syncBackups: 'id, createdAt' })
    this.version(3).stores({ speakingRecordings: 'id, createdAt, driveFileId' })
    this.version(4).stores({ speakingRecordings: 'id, createdAt, driveFileId, lessonId', shadowingFolders: 'id, ownerId, nameKey, createdAt', shadowingLessons: 'id, ownerId, folderId, createdAt' })
    this.version(5).stores({ readingFolders: 'id, ownerId, createdAt', readingArticles: 'id, ownerId, folderId, createdAt' })
    this.version(6).stores({ readingStudyNotes: 'id, ownerId, articleId, type, createdAt' }).upgrade(async tx=>{
      for(const article of await tx.table('readingArticles').toArray()){
        if(!article.note?.trim())continue
        await tx.table('readingStudyNotes').put({id:article.id,ownerId:article.ownerId,articleId:article.id,type:'other',title:'Ghi chú cũ',content:article.note,sourceQuote:'',createdAt:article.createdAt,updatedAt:article.updatedAt,deletedAt:article.deletedAt,metadataSynced:false})
      }
    })
  }
}
export let db = new VocabDatabase()
let activeUserId: string | null = null
export const getActiveUserId = () => activeUserId
export function accountDatabaseName(userId: string) {
  if (!userId.trim()) throw new Error('Account required')
  return 'vocab-rows-v1-account-' + encodeURIComponent(userId)
}
export function activateAccountDatabase(userId: string) {
  if (activeUserId && activeUserId !== userId) throw new Error('Reload required to switch accounts')
  if (activeUserId === userId) return db
  db.close()
  db = new VocabDatabase(accountDatabaseName(userId))
  activeUserId = userId
  return db
}
