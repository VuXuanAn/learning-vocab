import type { Note } from './cards'
import { noteWord } from './related-words'
import { readingSearchWords } from './reading-similarity'
import { irregularVerbs, irregularVerbForms, irregularVerbId } from './irregular-verbs'

export interface ReadingWordChoice { id: string; word: string; kind: 'vocab' | 'irregular'; partOfSpeech: string; meaning: string }
const plain = (value: string) => value.replace(/<[^>]*>/g, '').trim()
const key = (value: string) => plain(value).toLowerCase().replace(/\s+/gu, ' ')
const fieldKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase()

export function readingWordChoices(word: string, notes: Note[], linkedId = ''): ReadingWordChoice[] {
 const term = key(word)
 if (!term) return []
 const saved: ReadingWordChoice[] = notes.filter(note => note.id === linkedId || readingSearchWords(noteWord(note)).some(word => key(word) === term)).map(note => {
  const field = (pattern: RegExp) => {
   const found = note.template?.fields.find(field => pattern.test(fieldKey(field.name)))
   return plain((found && note.values?.[found.name]) || '')
  }
  return { id: note.id, word: plain(noteWord(note)), kind: 'vocab', partOfSpeech: field(/^(loai tu|part of speech|word type|pos)$/), meaning: field(/nghia|meaning|definition/) || plain(note.back) }
 })
 const reference: ReadingWordChoice[] = irregularVerbs.filter(verb => irregularVerbForms(verb).includes(term) || irregularVerbId(verb) === linkedId).map(verb => ({ id: irregularVerbId(verb), word: `${verb.base} – ${verb.past} – ${verb.participle}`, kind: 'irregular', partOfSpeech: 'Động từ bất quy tắc', meaning: verb.meaning }))
 return [...saved, ...reference]
}
