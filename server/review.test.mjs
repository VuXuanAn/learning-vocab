import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
const url = source => 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64')
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const templatesUrl = url(read('../src/lib/templates.ts'))
const cardsUrl = url(read('../src/lib/cards.ts').replace("'./templates'",JSON.stringify(templatesUrl)))
const reviewUrl = url(read('../src/lib/review.ts').replace("'ts-fsrs'",JSON.stringify(import.meta.resolve('ts-fsrs'))))
const { nextReview, isLearning, isDue, reviewCounts, Rating, State } = await import(reviewUrl)
const dbUrl = url(read('../src/lib/db.ts').replace("'vocab-library'", "'vocab-review-test'").replace("'dexie'",JSON.stringify(import.meta.resolve('dexie'))))
const { db } = await import(dbUrl)
const storageUrl = url(read('../src/lib/review-storage.ts').replace("'./db'",JSON.stringify(dbUrl)).replace("'./cards'",JSON.stringify(cardsUrl)).replace("'./review'",JSON.stringify(reviewUrl)))
const { saveReview } = await import(storageUrl)
const now = new Date('2026-11-10T00:00:00Z')

test('four grades produce distinct, ordered first-review intervals', () => {
  const results = [1,2,3,4].map(grade => nextReview(undefined,grade,now).card)
  assert.equal(results[0].due.getTime()-now.getTime(),60_000)
  assert.equal(results[1].due.getTime()-now.getTime(),360_000)
  assert.equal(results[2].due.getTime()-now.getTime(),600_000)
  assert.ok(results[3].due.getTime()>results[2].due.getTime())
  assert.deepEqual(results.map(card=>card.state),[State.Learning,State.Learning,State.Learning,State.Review])
})
test('repeat is gated by due time; Good advances learning, Easy graduates', () => {
  const first = nextReview(undefined,Rating.Good,now).card
  assert.equal(isDue(first,now.getTime()),false)
  assert.equal(isDue(first,first.due.getTime()),true)
  const graduated = nextReview(first,Rating.Good,first.due).card
  assert.equal(graduated.state,State.Review)
  const relearn = nextReview(graduated,Rating.Again,graduated.due).card
  assert.equal(relearn.state,State.Relearning)
  assert.equal(isLearning(relearn),true)
  assert.equal(nextReview(relearn,Rating.Easy,relearn.due).card.state,State.Review)
})
test('home counts new, learning and due without counting future reviews as due', () => {
  const learning=nextReview(undefined,Rating.Again,now).card
  const future=nextReview(undefined,Rating.Easy,now).card
  const records=new Map([['learning',learning],['future',future],['due',{...future,due:now}]])
  assert.deepEqual(reviewCounts(['new','learning','future','due'],records,now.getTime()),{new:1,learning:1,due:1})
})
test('persists independent schedules and logs; rejects stale double answers and missing cards', async () => {
  try {
    await db.notes.add({id:'n',kind:'reverse',front:'word',back:'meaning',extra:'',tags:'',folderId:'f',createdAt:0})
    const result = await saveReview('n-forward','n',Rating.Hard,0,now)
    assert.equal(result.lastRating,Rating.Hard)
    assert.equal(result.revision,1)
    assert.equal(await db.reviews.get('n-reverse'),undefined)
    await assert.rejects(()=>saveReview('n-forward','n',Rating.Good,1,now))
    await assert.rejects(()=>saveReview('n-forward','n',Rating.Easy,0,now))
    await assert.rejects(()=>saveReview('missing','n',Rating.Easy,0,now))
    assert.equal(await db.reviewLogs.count(),1)
    await db.close();await db.open()
    const loaded=await db.reviews.get('n-forward')
    assert.ok(loaded.due instanceof Date)
    assert.equal(loaded.due.getTime(),result.due.getTime())
    await saveReview('n-reverse','n',Rating.Easy,0,now)
    assert.equal((await db.reviews.get('n-forward')).lastRating,Rating.Hard)
    assert.equal((await db.reviews.get('n-reverse')).state,State.Review)
  } finally {await db.delete()}
})

