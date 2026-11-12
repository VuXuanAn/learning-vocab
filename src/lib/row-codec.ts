import type { GrammarEntry, GrammarFolder } from './grammar-types'
import type { Note } from './cards'
import type { VocabularyFolder } from './folders'
import type { CardTemplate } from './templates'
import type { ReviewRecord } from './review'
import type { SavedReviewLog } from './review-storage'
export const rowTables = ['folders', 'templates', 'notes', 'reviews', 'reviewLogs', 'grammarFolders', 'grammarEntries'] as const
export type RowTable = typeof rowTables[number]
export type LocalRow = VocabularyFolder | CardTemplate | Note | ReviewRecord | SavedReviewLog | GrammarEntry | GrammarFolder
export type WireRow = Record<string, any> // SQL records have different columns per table.
export interface SyncedRow { key: string; table: RowTable; id: string; remote: WireRow; value: WireRow | null }
export const sqlTables: Record<RowTable, string> = { folders: 'folders', templates: 'card_templates', notes: 'notes', reviews: 'user_card_progress', reviewLogs: 'review_logs', grammarFolders: 'grammar_folders', grammarEntries: 'grammar_entries' }
export function stable(value: unknown): string {
  if (value === undefined) return 'undefined'
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) && !(item instanceof Date) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
}
export function cardKey(id: string, noteId: string) {
  if (!id.startsWith(noteId + '-')) throw new Error('Invalid card ID')
  return id.slice(noteId.length + 1)
}
export function localId(table: RowTable, row: WireRow): string {
  return table === 'reviews' ? row.note_id + '-' + row.card_key : row.id
}
// Older clients stored a generated summary; carry its useful data forward without syncing the field.
function grammarEntryData(row:WireRow):WireRow {
 const {structure,...data}=row
 if(typeof structure!=='string'||!structure.trim())return data
 return {...data,structures:data.structures??[{id:1,type:'',formula:structure}],
  ...(data.source?{source:{...data.source,pattern:data.source.pattern??structure}}:{}),
  ...(Array.isArray(data.sources)?{sources:data.sources.map(source=>({...source,pattern:source.pattern??structure}))}:{}),
 }
}
export function encodeRow(table: RowTable, local: LocalRow): WireRow {
  const row = local as any
  if (table === 'grammarFolders' || table === 'grammarEntries') {
    const { id: _id, ownerId: _ownerId, ...data } = row
    return { data:table==='grammarEntries'?grammarEntryData(data):data, ...(table === 'grammarEntries' ? { folder_id: row.folderId } : {}) }
  }
  if (table === 'folders') return { name: row.name, parent_id: row.parentId || null, reverse_cards: !!row.reverseCards }
  if (table === 'templates') return { definition: row }
  if (table === 'notes') return { folder_id: row.folderId, kind: row.kind, front: row.front, back: row.back, extra: row.extra, tags: row.tags, field_values: row.values ?? {}, template: row.template ?? null }
  if (table === 'reviewLogs') return JSON.parse(JSON.stringify({ note_id: row.noteId, card_key: cardKey(row.cardId, row.noteId), reviewed_at: row.log.review, log: row.log }))
  const { id, noteId, lastRating, revision, ...fsrs } = row
  return JSON.parse(JSON.stringify({ note_id: noteId, card_key: cardKey(id, noteId), due: row.due, fsrs, last_rating: lastRating, review_revision: revision }))
}
export function decodeRow(table: RowTable, row: WireRow): LocalRow {
  if (table === 'grammarFolders' || table === 'grammarEntries') return { ...(table==='grammarEntries'?grammarEntryData(row.data):row.data), id: row.id, ownerId: row.owner_id, ...(table === 'grammarEntries' ? { folderId: row.folder_id } : {}) } as GrammarEntry | GrammarFolder
  if (table === 'folders') return { id: row.id, name: row.name, nameKey: row.name.toLocaleLowerCase('vi'), parentId: row.parent_id ?? '', reverseCards: row.reverse_cards, createdAt: Date.parse(row.created_at), ownerId: row.owner_id, permission: row.permission }
  if (table === 'templates') return { ...row.definition, id: row.id }
  if (table === 'notes') return { id: row.id, readOnly: !!row.readOnly, folderId: row.folder_id, kind: row.kind, front: row.front, back: row.back, extra: row.extra, tags: row.tags, values: row.field_values, template: row.template ?? undefined, createdAt: Date.parse(row.created_at) }
  if (table === 'reviews') return { ...row.fsrs, id: localId(table, row), noteId: row.note_id, due: new Date(row.due), last_review: row.fsrs.last_review ? new Date(row.fsrs.last_review) : undefined, lastRating: row.last_rating, revision: Number(row.review_revision) }
  return { id: row.id, noteId: row.note_id, cardId: row.note_id + '-' + row.card_key, log: { ...row.log, due: new Date(row.log.due), review: new Date(row.log.review) } }
}
