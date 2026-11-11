import { db } from './db'
import type { Note } from './cards'
import { aiTemplate, rowToNote, type SpellingCheck } from './ai-batch'
import { findRelatedNote, relatedLinkKey } from './related-words'

export async function saveRelatedNote(parentId: string, word: string, generated: Note) {
  return db.transaction('rw', db.notes, db.folders, async () => {
    const parent = await db.notes.get(parentId)
    if (!parent || parent.folderId !== generated.folderId || !parent.folderId || !await db.folders.get(parent.folderId)) throw new Error('Từ gốc hoặc thư mục đã thay đổi. Hãy mở lại thẻ.')
    if (parent.readOnly) throw new Error('Bạn chỉ có quyền xem bộ thẻ này.')
    const notes = await db.notes.toArray()
    // Recheck after generation: another tab may have created the same word.
    const target = findRelatedNote(notes, parent, word) ?? findRelatedNote(notes, parent, generated.front) ?? generated
    if (target === generated) await db.notes.add(generated)
    await db.notes.update(parent.id, { values: { ...parent.values, [relatedLinkKey(word)]: target.id } })
    return target
  })
}
export async function generateRelatedNote(word: string, parent: Note, signal: AbortSignal) {
  const existing = findRelatedNote(await db.notes.toArray(), parent, word)
  if (existing) return existing
  const response = await fetch('/api/ai/generate-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal, body: JSON.stringify({ words: [word], sourceFieldId: 'word', fields: aiTemplate.fields.map(({ id, name }) => ({ id, name })) }) })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Backend chưa sẵn sàng.')
  const data = await response.json() as { error?: string; rows?: { index: number; originalWord: string; spelling: SpellingCheck; values: Record<string, string> }[] }
  if (!response.ok) throw new Error(data.error || 'Không thể tạo từ liên quan.')
  const row = data.rows?.[0]
  if (data.rows?.length !== 1 || row?.index !== 0 || row.originalWord !== word || !row.spelling || !['correct','suggested'].includes(row.spelling.status) || aiTemplate.fields.some(field => typeof row.values?.[field.id] !== 'string' || row.values[field.id].length > 6000 || field.required && !row.values[field.id].trim())) throw new Error('AI chưa tạo được nội dung hợp lệ cho từ này. Hãy thử lại.')
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const note = rowToNote({ ...row, id: crypto.randomUUID(), selected: true, saved: false }, aiTemplate, 'word', parent.folderId ?? '', parent.tags)
  return saveRelatedNote(parent.id, word, note)
}
