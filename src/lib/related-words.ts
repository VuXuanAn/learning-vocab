import type { Note } from './cards'
export interface RelatedWord { word: string; description: string }
export const wordKey = (word: string) => word.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en')
export const relatedLinkKey = (word: string) => '__relatedNote:' + encodeURIComponent(wordKey(word))
export function parseRelatedWords(text: string): RelatedWord[] {
  const seen = new Set<string>()
  return text.split(/[\r\n;]+/u).map(line => line.trim().replace(/^[-*•]\s+/u, '')).filter(Boolean).map(line => {
    const match = line.match(/^(.+?)\s*(?:\(([^)]+)\))?\s*(?::|：|[–—]|\s-\s)\s*(.+)$/u)
    const word = (match?.[1] ?? line).trim()
    return { word, description: match ? [match[2] ? '(' + match[2] + ')' : '', match[3]].filter(Boolean).join(': ') : '' }
  }).filter(item => {
    const key = wordKey(item.word)
    if (!/^[\p{L}\p{M}][\p{L}\p{M}\s'’‐-]*$/u.test(item.word) || item.word.length > 200 || seen.has(key)) return false
    seen.add(key); return true
  })
}
export function noteWord(note: Note) {
  if (note.kind === 'cloze') return ''
  const field = note.template?.fields.find(field => /^(từ vựng|word|vocabulary)$/iu.test(field.name))
  return note.values?.['Từ vựng'] || (field && note.values?.[field.name]) || note.front
}
export function findRelatedNote(notes: Note[], parent: Note, word: string) {
  const linked = parent.values?.[relatedLinkKey(word)]
  const exact = notes.find(note => note.id === linked)
  if (exact) return exact
  const matches = notes.filter(note => wordKey(noteWord(note)) === wordKey(word))
  return matches.find(note => note.folderId === parent.folderId) ?? matches[0]
}
