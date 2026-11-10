import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs'
export { Rating, State }
export type { Grade }
export interface ReviewRecord extends Card { id: string; noteId: string; lastRating: Grade; revision: number }
export const scheduler = fsrs({ enable_fuzz: false, learning_steps: ['1m', '10m'], relearning_steps: ['10m'] })
export const reviewGrades: { grade: Grade; label: string; color: string }[] = [
  { grade: Rating.Again, label: 'Quên', color: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' },
  { grade: Rating.Hard, label: 'Khó', color: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' },
  { grade: Rating.Good, label: 'Tốt', color: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  { grade: Rating.Easy, label: 'Dễ', color: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' },
]
export function isLearning(record?: ReviewRecord) { return record?.state === State.Learning || record?.state === State.Relearning }
export function isDue(record: ReviewRecord | undefined, now: number) { return !record || record.due.getTime() <= now }
export function nextReview(record: ReviewRecord | undefined, grade: Grade, now: Date) { return scheduler.next(record ?? createEmptyCard(now), now, grade) }
export function formatInterval(due: Date, now: number) {
  const seconds = Math.max(0, Math.ceil((due.getTime() - now) / 1000))
  if (!seconds) return 'Ngay bây giờ'
  if (seconds < 60) return `${seconds} giây`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} phút`
  if (seconds < 86400) return `${Math.ceil(seconds / 3600)} giờ`
  return `${Math.ceil(seconds / 86400)} ngày`
}
export function reviewCounts(ids: string[], records: Map<string, ReviewRecord>, now: number) {
  return ids.reduce((counts, id) => {
    const record = records.get(id)
    if (!record || record.state === State.New) counts.new++
    else if (isLearning(record)) counts.learning++
    else if (isDue(record, now)) counts.due++
    return counts
  }, { new: 0, learning: 0, due: 0 })
}
