import { db } from './db'
import { generateCards, type Note } from './cards'
import { aiTemplate, hasWordFamily } from './ai-batch'
export async function saveNoteEdits(original: Note, draft: Note) {
  const next: Note = { ...original, front: draft.front.trim(), back: draft.back.trim(), extra: draft.extra.trim(), tags: draft.tags.trim(), values: draft.values ? Object.fromEntries(Object.entries(draft.values).map(([key, value]) => [key, value.trim()])) : undefined }
  if (next.kind === 'ai') {
    next.template = aiTemplate
    next.front = next.values?.['Từ vựng'] ?? ''
    if (next.values && !hasWordFamily(next.front)) next.values['Các dạng từ liên quan'] = ''
  }
  if (next.template) {
    if (next.template.fields.some(field => field.required && !next.values?.[field.name]?.trim())) throw new Error('Hãy điền các trường bắt buộc.')
  } else if (!next.front || (next.kind !== 'cloze' && !next.back)) throw new Error('Hãy điền nội dung hai mặt thẻ.')
  const before = generateCards(original).map(card => card.id).sort()
  const after = generateCards(next)
  if (!after.length || after.some(card => !card.front.trim() || !card.back.trim())) throw new Error('Thẻ cần có nội dung hai mặt.')
  if (JSON.stringify(before) !== JSON.stringify(after.map(card => card.id).sort())) throw new Error('Không thể thay đổi các nhóm cloze trong khi đang học. Hãy giữ nguyên số nhóm c1, c2…')
  await db.transaction('rw', db.notes, async () => {
    const current = await db.notes.get(original.id)
    if (!current) throw new Error('Từ vựng đã bị xóa.')
    if (JSON.stringify(current) !== JSON.stringify(original)) throw new Error('Từ vựng đã được sửa ở nơi khác. Hãy hủy và mở chỉnh sửa lại.')
    await db.notes.put(next)
  })
}
