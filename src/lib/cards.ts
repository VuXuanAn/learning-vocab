import { renderCardTemplate, type CardTemplate } from './templates'
export type NoteKind = 'basic' | 'reverse' | 'cloze' | 'custom' | 'ai'
export interface Note {
  id: string
  kind: NoteKind
  front: string
  back: string
  extra: string
  tags: string
  template?: CardTemplate
  values?: Record<string, string>
  folderId?: string
  createdAt: number
}
export interface Flashcard { id: string; front: string; back: string; extra: string }
export const noteLabels: Record<NoteKind, string> = { basic: 'Cơ bản', reverse: 'Cơ bản + đảo chiều', cloze: 'Điền chỗ trống', custom: 'Tùy chỉnh', ai: 'AI generator' }

export function generateCards(note: Note): Flashcard[] {
  if (note.kind === 'custom' || note.kind === 'ai') {
    if (!note.template) return []
    const front = renderCardTemplate(note.template, 'frontTemplate', note.values ?? {})
    return [{ id: note.id + '-custom', front, back: renderCardTemplate(note.template, 'backTemplate', note.values ?? {}), extra: note.extra }]
  }
  const base = { extra: note.extra }
  if (note.kind === 'cloze') {
    const groups = [...new Set([...note.front.matchAll(/\{\{c([1-9]\d*)::([^{}]+?)\}\}/g)].map(match => match[1]))]
    return groups.map(group => ({ ...base, id: `${note.id}-c${group}`,
      front: note.front.replace(/\{\{c([1-9]\d*)::([^{}]+?)\}\}/g, (_, index: string, content: string) => {
        const [answer, hint] = content.split('::')
        return index === group ? `[${hint || '…'}]` : answer
      }),
      back: note.front.replace(/\{\{c([1-9]\d*)::([^{}]+?)\}\}/g, (_, _index: string, content: string) => content.split('::')[0]),
      extra: [note.back, note.extra].filter(Boolean).join('\n'),
    }))
  }
  const cards = [{ ...base, id: `${note.id}-forward`, front: note.front, back: note.back }]
  if (note.kind === 'reverse') cards.push({ ...base, id: `${note.id}-reverse`, front: note.back, back: note.front })
  return cards
}

