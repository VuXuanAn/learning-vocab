import type { CardTemplate } from './templates'
import type { Note } from './cards'

export const aiTemplate: CardTemplate = {
  id: 'builtin-ai-generator', name: 'AI generator', format: 'html', align: 'center', fontSize: 24, color: '#166534',
  fields: [{ id: 'word', name: 'Từ vựng', required: true }, { id: 'ipa', name: 'Phiên âm IPA', required: false }, { id: 'pos', name: 'Loại từ', required: false }, { id: 'meaning', name: 'Nghĩa tiếng Việt', required: true }, { id: 'example', name: 'Câu ví dụ', required: false }, { id: 'translation', name: 'Dịch câu ví dụ', required: false }, { id: 'wordFamily', name: 'Các dạng từ liên quan', required: false }],
  frontTemplate: '<div class="word">{{Từ vựng}}</div>',
  backTemplate: '{{FrontSide}}<p class="ipa">{{Phiên âm IPA}} · {{Loại từ}}</p><div class="meaning">{{Nghĩa tiếng Việt}}</div><p class="example">{{Câu ví dụ}}</p><p class="translation">{{Dịch câu ví dụ}}</p><div class="word-family">{{Các dạng từ liên quan}}</div>',
  css: '.word{font-size:36px;font-weight:700}.ipa{font-size:16px;color:#64748b}.meaning{margin:24px 0;font-weight:600}.example{font-size:20px}.translation{font-size:16px;color:#64748b}.word-family{margin-top:24px;white-space:pre-line;font-size:16px;text-align:left;color:#475569}',
  speech: { fieldId: 'word', lang: 'en-US', rate: 1 },
}
export function hasWordFamily(word: string) {
  return !!word.trim() && word.trim().split(/\s+/u).length === 1
}
export function parseWordList(input: string) {
  return [...new Map(input.split(/[\n,;]+/).map(word => word.trim()).filter(Boolean).map(word => [word.toLocaleLowerCase('vi'), word] as const)).values()]
}
export interface SpellingCheck { status: 'correct' | 'suggested' | 'uncertain'; suggestion: string; reason: string }
export interface BatchRow { originalWord?: string; spelling?: SpellingCheck; spellingReviewed?: boolean; id: string; values: Record<string, string>; selected: boolean; saved: boolean }
export function needsSpellingReview(row: BatchRow) {
  return !!row.spelling && row.spelling.status === 'uncertain' && !row.spellingReviewed
}
export function rowToNote(row: BatchRow, template: CardTemplate, sourceId: string, folderId: string, tags: string): Note {
  if (needsSpellingReview(row)) throw new Error('Hãy xác nhận kiểm tra chính tả trước khi lưu.')
  const values = Object.fromEntries(template.fields.map(field => [field.name, (row.values[field.id] ?? '').trim()]))
  const wordField = template.fields.find(field => field.id === sourceId)
  if (template.id === aiTemplate.id && (!hasWordFamily(values[wordField?.name ?? ''] ?? '') || (row.originalWord && !hasWordFamily(row.originalWord)))) values['Các dạng từ liên quan'] = ''
  return { id: row.id, kind: template.id === aiTemplate.id ? 'ai' : 'custom', front: wordField ? values[wordField.name] : '', back: '', extra: '', values, template, folderId, tags, createdAt: Date.now() }
}
