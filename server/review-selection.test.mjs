import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const source=stripTypeScriptTypes(readFileSync(new URL('../src/lib/review-selection.ts',import.meta.url),'utf8'))
const {selectReviewItem}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
test('a newly due earlier card does not interrupt the active card',()=>{
 const queue=[{card:{id:'waiting'},due:60},{card:{id:'current'},due:0}]
 const first=selectReviewItem(queue,undefined,item=>item.due<=30)
 assert.equal(first.card.id,'current')
 assert.equal(selectReviewItem(queue,first.card.id,item=>item.due<=70).card.id,'current')
 assert.equal(selectReviewItem(queue,undefined,item=>item.due<=70).card.id,'waiting')
})
test('waiting wakes when due; removed active cards fall back to the next due card',()=>{
 const queue=[{card:{id:'next'},due:60}]
 assert.equal(selectReviewItem(queue,undefined,item=>item.due<=30),undefined)
 assert.equal(selectReviewItem(queue,undefined,item=>item.due<=60).card.id,'next')
 assert.equal(selectReviewItem(queue,'deleted',item=>item.due<=60).card.id,'next')
})
