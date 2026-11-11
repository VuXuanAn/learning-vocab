import { db } from './db'
import type { Note } from './cards'
import { filterNotesByFolder, type VocabularyFolder } from './folders'
export function noteMeaning(note: Note) {
  const field = note.template?.fields.find(field => /nghĩa|meaning|definition/iu.test(field.name))
  return note.values?.['Nghĩa tiếng Việt'] || (field && note.values?.[field.name]) || note.back
}
export function managedNotes(notes: Note[], folders: VocabularyFolder[], folderId: string, includeChildren: boolean, query: string) {
  const scoped = folderId === 'all' ? notes : includeChildren ? filterNotesByFolder(notes, folderId, folders) : notes.filter(note => note.folderId === folderId)
  const key = query.normalize('NFKC').trim().toLocaleLowerCase('vi')
  return !key ? scoped : scoped.filter(note => [note.front, note.back, note.tags, ...Object.entries(note.values ?? {}).filter(([name]) => !name.startsWith('__relatedNote:')).map(([,value]) => value)].some(value => value.normalize('NFKC').toLocaleLowerCase('vi').includes(key)))
}
export async function deleteNote(noteId: string) {
  await db.transaction('rw', db.notes, db.reviews, db.reviewLogs, async () => {
    const current = await db.notes.get(noteId)
    if (current?.readOnly) throw new Error('Bạn chỉ có quyền xem bộ thẻ này.')
    if (!current) throw new Error('Thẻ đã bị xóa ở nơi khác.')
    await db.reviews.where('noteId').equals(noteId).delete()
    await db.reviewLogs.where('noteId').equals(noteId).delete()
    await db.notes.delete(noteId)
    // A deleted related card should become an AI gen action again.
    for (const note of await db.notes.toArray()) {
      if (note.readOnly) continue
      const entries = Object.entries(note.values ?? {})
      const retained = entries.filter(([key,value]) => !(key.startsWith('__relatedNote:') && value === noteId))
      if (retained.length !== entries.length) await db.notes.update(note.id, {values:Object.fromEntries(retained)})
    }
  })
}
