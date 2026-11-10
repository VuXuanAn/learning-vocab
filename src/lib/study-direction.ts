import { type Flashcard, type Note } from './cards'
import { escapeHtml, renderCardTemplate } from './templates'

export function studyCard(note: Note, card: Flashcard, reversed: boolean): Flashcard {
  if (!reversed) return card
  let front = card.back
  if (note.kind === 'ai' && note.template) {
    const field = note.template.fields.find(field => /nghĩa|meaning|definition/i.test(field.name))
    const meaning = field ? note.values?.[field.name] : undefined
    if (meaning?.trim()) front = note.template.format === 'html' ? `<div class="meaning">${escapeHtml(meaning).replace(/\r?\n/g, '<br>')}</div>` : meaning
  } else if (note.template) {
    // FrontSide must not reveal the answer when the back becomes the question.
    front = renderCardTemplate(note.template, 'backTemplate', note.values ?? {}, '')
  }
  return { ...card, front, back: card.front }
}
