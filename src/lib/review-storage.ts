import { db } from './db'
import { generateCards } from './cards'
import { nextReview, isDue, type Grade, type ReviewRecord } from './review'
import type { ReviewLog } from 'ts-fsrs'
export interface SavedReviewLog { id: string; cardId: string; noteId: string; log: ReviewLog }
export async function saveReview(cardId: string, noteId: string, grade: Grade, expectedRevision: number, now = new Date()) {
  return db.transaction('rw', db.notes, db.reviews, db.reviewLogs, async () => {
    const note = await db.notes.get(noteId)
    if (!note || !generateCards(note).some(card => card.id === cardId)) throw new Error('Thẻ không còn tồn tại. Hãy bắt đầu lại phiên ôn tập.')
    const previous = await db.reviews.get(cardId)
    if ((previous?.revision ?? 0) !== expectedRevision) throw new Error('Thẻ vừa được ôn ở phiên khác. Hãy kiểm tra lịch mới rồi chọn lại.')
    if (previous && !isDue(previous, now.getTime())) throw new Error('Thẻ chưa đến hạn ôn. Vui lòng chờ đúng lịch.')
    const result = nextReview(previous, grade, now)
    const record: ReviewRecord = { ...result.card, id: cardId, noteId, revision: expectedRevision + 1, lastRating: grade }
    await db.reviews.put(record)
    await db.reviewLogs.add({ id: crypto.randomUUID(), cardId, noteId, log: result.log })
    return record
  })
}

