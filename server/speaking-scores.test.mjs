import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const source=readFileSync('src/lib/speaking-review.ts','utf8').replace("'zod'",JSON.stringify(import.meta.resolve('zod')))
const {storedSpeakingReview,speakingScores10,speakingOverall10,latestLessonScores}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'))
const report=(overrides={})=>({review:{evaluable:true,transcript:'Hello',summary:'Clear',scores:{pronunciation:80,fluency:75,completeness:100},issues:[],practiceTips:[],warnings:[]},model:'model',createdAt:'2026-11-11T10:00:00Z',usage:null,...overrides})
test('legacy reports use explicit default scale 100 even when every score is below ten',()=>{
 const legacy=storedSpeakingReview(report())
 assert.deepEqual(speakingScores10(legacy),{pronunciation:8,fluency:7.5,completeness:10})
 assert.equal(speakingOverall10(legacy),8.5)
 const low=report();low.review.scores={pronunciation:8,fluency:5,completeness:2}
 assert.equal(speakingOverall10(storedSpeakingReview(low)),0.5)
})
test('new reports retain 10-point scores and reject values outside the declared scale',()=>{
 const fresh=report({scoreScale:10});fresh.review.scores={pronunciation:8.5,fluency:null,completeness:10}
 assert.equal(speakingOverall10(storedSpeakingReview(fresh)),9.3)
 fresh.review.scores.pronunciation=11
 assert.equal(storedSpeakingReview(fresh),undefined)
})
test('latest review per lesson wins; an unevaluable newer review does not show a misleading old score',()=>{
 const old=report(),recent=report({createdAt:'2026-11-11T11:00:00Z'});recent.review.evaluable=false
 const rows=[{id:'a',lessonId:'lesson',aiReview:recent},{id:'b',lessonId:'lesson',aiReview:old},{id:'legacy',aiReview:old},{id:'none'}]
 const scores=latestLessonScores(rows)
 assert.equal(scores.get('lesson'),null)
 assert.equal(scores.get('legacy'),8.5)
 assert.equal(scores.has('none'),false)
})
