import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const source=stripTypeScriptTypes(readFileSync('src/lib/note-learning-status.ts','utf8'))
const {latestNoteRatings,validLearningFilter}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
test('multi-card words use the latest actual answer, regardless of record order',()=>{
 const records=[{id:'word-reverse',noteId:'word',lastRating:1,last_review:new Date('2026-11-11T12:00:00Z')},{id:'other-card',noteId:'other',lastRating:2,last_review:new Date('2026-11-11T13:00:00Z')},{id:'word-front',noteId:'word',lastRating:4,last_review:new Date('2026-11-10T10:00:00Z')}]
 assert.equal(latestNoteRatings(records).get('word').status,'1')
 assert.equal(latestNoteRatings([...records].reverse()).get('word').status,'1')
 assert.equal(latestNoteRatings(records).get('other').status,'2')
})
test('unreviewed or invalid progress is not treated as an actual remembered/forgotten answer',()=>{
 const latest=latestNoteRatings([{id:'a',noteId:'new',lastRating:3},{id:'b',noteId:'invalid',lastRating:1,last_review:new Date('invalid')},{id:'c',noteId:'bad-rating',lastRating:0,last_review:new Date()}])
 assert.equal(latest.size,0)
 assert.equal(validLearningFilter('3'),'3');assert.equal(validLearningFilter('new'),'new');assert.equal(validLearningFilter('invalid'),'all')
})
