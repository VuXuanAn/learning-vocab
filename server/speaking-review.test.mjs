import test from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {reviewAudioSchema,reviewSpeaking} from './speaking-review.mjs'
import {createGeminiClient} from './gemini.mjs'
import {createApp} from './app.mjs'
const request={referenceText:'Hello world.',audio:{mimeType:'audio/webm',data:Buffer.from('audio-test').toString('base64')}}
const report={evaluable:true,transcript:'Hello world.',summary:'Đọc rõ.',scores:{pronunciation:8,fluency:7.5,completeness:10},issues:[],practiceTips:['Luyện nối âm.'],warnings:['Điểm tham khảo.']}
const completed=value=>({status:'completed',output_text:JSON.stringify(value),usage:{input_tokens:20,output_tokens:30}})

test('speaking review sends actual audio and reference once with constrained coaching output',async()=>{
 let calls=0
 const result=await reviewSpeaking({responses:{create:async payload=>{
  calls++;assert.deepEqual(payload.audio,request.audio)
  assert.equal(JSON.parse(payload.input).referenceText,request.referenceText)
  assert.ok(payload.instructions.includes('not calibrated'));assert.ok(payload.instructions.includes('0 to 10'));assert.ok(payload.instructions.includes('practiceTips'))
  return completed(report)
 }}},'test-model',request)
 assert.equal(calls,1)
 assert.equal(result.review.scores.completeness,10)
 assert.equal(result.model,'test-model');assert.equal(result.scoreScale,10)
 assert.deepEqual(result.usage,{inputTokens:20,outputTokens:30})
})

test('silent or unverifiable audio cannot produce a scored result',async()=>{
 for(const value of [{...report,evaluable:false},{...report,transcript:''}]){
  const result=await reviewSpeaking({responses:{create:async()=>completed(value)}},'model',request)
  assert.equal(result.review.evaluable,false)
  assert.deepEqual(result.review.scores,{pronunciation:null,fluency:null,completeness:null})
  assert.deepEqual(result.review.issues,[])
 }
})

test('invalid audio and malformed model outputs are rejected',async()=>{
 for(const invalid of [{...request,referenceText:''},{...request,audio:{mimeType:'text/html',data:request.audio.data}},{...request,audio:{mimeType:'audio/webm',data:'not base64!'}}])assert.equal(reviewAudioSchema.safeParse(invalid).success,false)
 for(const output of [{...report,scores:{...report.scores,pronunciation:10.1}},{...report,issues:[{expected:'word'}]}])await assert.rejects(()=>reviewSpeaking({responses:{create:async()=>completed(output)}},'model',request))
 await assert.rejects(()=>reviewSpeaking({responses:{create:async()=>({status:'incomplete'})}},'model',request))
})

test('Gemini adapter forwards audio bytes alongside the reference rather than a filename',async()=>{
 const client=createGeminiClient({ai:{models:{generateContent:async payload=>{
  assert.equal(payload.contents[1].inlineData.data,request.audio.data)
  assert.equal(payload.contents[1].inlineData.mimeType,'audio/webm')
  assert.equal(payload.contents[0].text,'reference')
  return {candidates:[{finishReason:'STOP'}],text:JSON.stringify(report)}
 }}}})
 await client.responses.create({model:'test',input:'reference',audio:request.audio,instructions:'coach',max_output_tokens:100,text:{format:{schema:{type:'object'}}}})
})

test('review endpoint handles audio larger than text limit and includes usage metrics',async()=>{
 let calls=0
 const server=createApp({client:{responses:{create:async()=>{calls++;return completed(report)}}},model:'review-model'}).listen(0,'127.0.0.1')
 await once(server,'listening');const base='http://127.0.0.1:'+server.address().port
 try{
  const response=await fetch(base+'/api/ai/review-speaking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...request,audio:{...request.audio,data:Buffer.alloc(80000,1).toString('base64')}})})
  assert.equal(response.status,200)
  assert.equal((await response.json()).review.transcript,'Hello world.')
  const usage=await(await fetch(base+'/api/ai/usage')).json()
  assert.equal(usage.today.totalTokens,50)
  assert.equal(calls,1)
  const bad=await fetch(base+'/api/ai/review-speaking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...request,referenceText:''})})
  assert.equal(bad.status,400);assert.equal(calls,1)
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
})
import {reviewGenerationSchema} from './review-json-schema.mjs'
import {z} from 'zod'
import {speakingResultSchema} from './speaking-review.mjs'

test('review generation uses a compact supported schema while local validation retains limits',()=>{
 const schema=reviewGenerationSchema(z.toJSONSchema(speakingResultSchema))
 assert.deepEqual(schema.properties.scores.properties.pronunciation.type,['number','null'])
 assert.deepEqual(schema.properties.issues.items.properties.timestampSeconds.type,['number','null'])
 const serialized=JSON.stringify(schema)
 for(const key of ['$schema','maxLength','maxItems','minimum','maximum'])assert.equal(serialized.includes('"'+key+'"'),false)
 assert.equal(schema.type,'object')
 assert.equal(schema.additionalProperties,false)
 assert.ok(schema.required.includes('scores'))
 assert.equal(speakingResultSchema.safeParse({...report,scores:{...report.scores,pronunciation:101}}).success,false)
 assert.equal(speakingResultSchema.safeParse({...report,summary:'x'.repeat(3001)}).success,false)
})
