import type { Grade } from 'ts-fsrs'
export function reviewShortcut(event: { key: string; repeat?: boolean; isComposing?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean }, state: { hasCard: boolean; hasSeenAnswer: boolean; busy: boolean; editing: boolean; dialog: boolean }): Grade | 'flip' | 'speak' | null {
  if (!state.hasCard || state.busy || state.editing || state.dialog || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null
  if (event.key.toLowerCase() === 's') return 'speak'
  if (event.key === ' ') return 'flip'
  if (state.hasSeenAnswer && /^[1-4]$/.test(event.key)) return Number(event.key) as Grade
  return null
}
