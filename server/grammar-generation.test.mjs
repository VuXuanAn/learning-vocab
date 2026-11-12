import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { generateGrammar, grammarGenerationSchema } from './grammar-generation.mjs'
import { GenerationError } from './generate.mjs'
import { createApp } from './app.mjs'

const request={title:'Get to + V',prompt:'Ưu tiên bảng, không đánh số tiêu đề.'}
const result={name:'Get to + V',contentHtml:'<h2>Cách dùng</h2><p>Có cơ hội làm gì.</p>'}
test('Grammar generation follows the supplied topic/brief, validates output and does not persist provider conversations',async()=>{
 let captured
 assert.deepEqual(await generateGrammar({responses:{create:async input=>{captured=input;return {status:'completed',output_text:JSON.stringify(result)}}}},'test-model',request),result)
 assert.deepEqual(JSON.parse(captured.input),{topic:request.title,brief:request.prompt})
 assert.equal(captured.store,false)
 assert.equal(captured.model,'test-model')
 assert.deepEqual(captured.text.format.schema.required,['name','contentHtml'])
 for(const output of [{status:'incomplete',output_text:JSON.stringify(result)},{status:'completed',output_text:'invalid'},{status:'completed',output_text:'{"name":"Grammar","contentHtml":""}'}])await assert.rejects(()=>generateGrammar({responses:{create:async()=>output}},'test',request),GenerationError)
 for(const invalid of [{...request,title:''},{...request,title:'x'.repeat(161)},{...request,prompt:'x'.repeat(12001)},{...request,key:'secret'}])assert.equal(grammarGenerationSchema.safeParse(invalid).success,false)
})
test('Grammar endpoint validates requests, configuration and returns metered content',async()=>{
 for(const configured of [false,true]){
  const usage=[]
  const server=createApp({model:'test',usageStore:{record:(...args)=>usage.push(args),summary:()=>({})},client:configured?{responses:{create:async()=>({status:'completed',output_text:JSON.stringify(result),usage:{input_tokens:12,output_tokens:20}})}}:null}).listen(0,'127.0.0.1')
  await once(server,'listening')
  try{
   const base='http://127.0.0.1:'+server.address().port
   const post=body=>fetch(base+'/api/ai/generate-grammar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
   assert.equal((await post({...request,title:''})).status,400)
   const response=await post(request)
   assert.equal(response.status,configured?200:503)
   if(configured){assert.deepEqual(await response.json(),result);assert.deepEqual(usage,[['test',{input_tokens:12,output_tokens:20},false]])}
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
 }
})
