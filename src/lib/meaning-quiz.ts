import { generateCards, type Note } from './cards'
import type { ReviewRecord } from './review'
export interface MeaningQuestion { cardId: string; noteId: string; word: string; meaning: string; lang: string; rate: number }
const plain = (value: string) => value.replace(/<[^>]*>/g, '').trim()
const fieldName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export function meaningQuestions(notes: Note[], records: ReviewRecord[]): MeaningQuestion[] {
  const forgotten = new Map(records.filter(record => record.lastRating === 1).map(record => [record.noteId, record.id]))
  return notes.flatMap(note => {
    const cardId = forgotten.get(note.id)
    if (!cardId || !generateCards(note).some(card => card.id === cardId) || note.kind === 'cloze') return []
    let word = note.front
    let meaning = note.back
    if (note.template) {
      const fields = note.template.fields
      const wordField = fields.find(field => field.id === note.template?.speech?.fieldId) ?? fields.find(field => /^(tu vung|word|term|vocabulary)$/.test(fieldName(field.name)))
      const meaningField = fields.find(field => /nghia|meaning|definition/.test(fieldName(field.name)))
      if (!wordField || !meaningField) return []
      word = note.values?.[wordField.name] ?? ''
      meaning = note.values?.[meaningField.name] ?? ''
    }
    if (!plain(word) || !plain(meaning)) return []
    return [{ cardId, noteId: note.id, word: plain(word), meaning: plain(meaning), lang: note.template?.speech?.lang ?? 'en-US', rate: note.template?.speech?.rate ?? 1 }]
  })
}
export function normalizeMeaning(value: string) {
  return value.normalize('NFC').toLocaleLowerCase('vi').replace(/\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}
export function matchesMeaning(answer: string, meaning: string) {
  const normalized = normalizeMeaning(answer)
  return !!normalized && [meaning, ...meaning.split(/[;,\n]+/)].some(part => normalizeMeaning(part) === normalized)
}
export function nextQuestion(questions: MeaningQuestion[], previousId?: string, random = Math.random): MeaningQuestion | undefined {
  const other = questions.filter(question => question.noteId !== previousId)
  const pool = other.length ? other : questions
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] : undefined
}

export function reminderReady(state: { now: number; due: number; visible: boolean; focused: boolean; hasDialog: boolean; reviewActive: boolean; editing: boolean }) {
  return state.now >= state.due && state.visible && state.focused && !state.hasDialog && !state.reviewActive && !state.editing
}
