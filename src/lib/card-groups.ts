import type { Note } from './cards'
import { noteWord, parseRelatedWords, wordKey } from './related-words'
export interface CardGroup { id: string; label: string; rootId: string; notes: Note[]; total: number }
export function groupRelatedNotes(allNotes: Note[], visibleNotes: Note[]): CardGroup[] {
  const byId = new Map(allNotes.map(note => [note.id, note]))
  const parents = new Map(allNotes.map(note => [note.id, note.id]))
  function root(id: string): string {
    let current = id
    while (parents.get(current) !== current) current = parents.get(current)!
    while (id !== current) { const next = parents.get(id)!; parents.set(id, current); id = next }
    return current
  }
  function join(a: string, b: string) { const x = root(a), y = root(b); if (x !== y) parents.set(y, x) }
  const tokens = new Map<string, string>()
  for (const note of allNotes) {
    const related = parseRelatedWords(note.values?.['Các dạng từ liên quan'] ?? '')
    // Shared dictionary words also connect two derived forms when their root
    // has not been saved as its own card yet. Never infer by matching prefixes.
    const words = [noteWord(note), ...related.map(item => item.word)]
    for (const word of words) {
      const key = wordKey(word)
      if (!key) continue
      const first = tokens.get(key)
      if (first) join(note.id, first)
      else tokens.set(key, note.id)
    }
    for (const [key, target] of Object.entries(note.values ?? {})) {
      if (key.startsWith('__relatedNote:') && byId.has(target)) join(note.id, target)
    }
  }
  const members = new Map<string, Note[]>()
  for (const note of allNotes) { const id = root(note.id); const group = members.get(id) ?? []; group.push(note); members.set(id, group) }
  const visible = new Set(visibleNotes.map(note => note.id))
  return [...members.values()].map(notes => {
    const ordered = [...notes].sort((a,b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    const source = ordered[0]
    return { id: source.id, rootId: source.id, label: noteWord(source) || source.front, total: notes.length, notes: ordered.filter(note => visible.has(note.id)), newest: Math.max(...notes.map(note => note.createdAt)) }
  }).filter(group => group.notes.length > 0).sort((a,b) => b.newest - a.newest || a.id.localeCompare(b.id))
}
