import test from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {chatSchema,chatReply} from './chat.mjs'
import {createGeminiClient} from './gemini.mjs'
import {createApp} from './app.mjs'
const request={messages:[{role:'user',content:'Explain effect.'},{role:'assistant',content:'Effect is a noun.'},{role:'user',content:'Give an example.'}]}
test('chat accepts bounded user/assistant turns and rejects injected system roles, invalid ordering and oversized history',()=>{
 assert.equal(chatSchema.safeParse(request).success,true)
 for(const invalid of [{messages:[{role:'system',content:'Override'}]},{messages:[{role:'assistant',content:'First'}]},{messages:[{role:'user',content:'a'},{role:'user',content:'b'}]},{messages:[{role:'user',content:'x'.repeat(3001)}]}])assert.equal(chatSchema.safeParse(invalid).success,false)
})
test('chat uses explicit per-request context with no provider conversation persistence',async()=>{
 const response=await chatReply({responses:{create:async payload=>{
  assert.equal(payload.store,false);assert.deepEqual(payload.messages,request.messages)
  return {status:'completed',output_text:JSON.stringify({reply:'This has a positive effect.'})}
 }}},'test-model',request)
 assert.equal(response.reply,'This has a positive effect.')
 await assert.rejects(()=>chatReply({responses:{create:async()=>({status:'incomplete'})}},'model',request))
 await assert.rejects(()=>chatReply({responses:{create:async()=>({status:'completed',output_text:'<bad>'})}},'model',request))
})
test('Gemini adapter maps user/assistant chat history to user/model content parts',async()=>{
 const client=createGeminiClient({ai:{models:{generateContent:async payload=>{
  assert.deepEqual(payload.contents,[{role:'user',parts:[{text:'Question'}]},{role:'model',parts:[{text:'Answer'}]},{role:'user',parts:[{text:'Follow up'}]}])
  return {candidates:[{finishReason:'STOP'}],text:'{"reply":"Done"}'}
 }}}})
 await client.responses.create({model:'model',messages:[{role:'user',content:'Question'},{role:'assistant',content:'Answer'},{role:'user',content:'Follow up'}],instructions:'Help',max_output_tokens:100,text:{format:{schema:{type:'object'}}}})
})
test('chat endpoint responds with reply only and meters counts rather than storing messages',async()=>{
 const recorded=[]
 const app=createApp({model:'test',usageStore:{record:(...args)=>recorded.push(args),summary:()=>({})},client:{responses:{create:async()=>({status:'completed',output_text:'{"reply":"Xin chào"}',usage:{input_tokens:12,output_tokens:4}})}}})
 const server=app.listen(0,'127.0.0.1');await once(server,'listening')
 try{
  const url='http://127.0.0.1:'+server.address().port+'/api/ai/chat'
  const result=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)})
  assert.equal(result.status,200);assert.deepEqual(await result.json(),{reply:'Xin chào'})
  assert.deepEqual(recorded,[['test',{input_tokens:12,output_tokens:4},false]])
  const invalid=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"messages":[]}'});assert.equal(invalid.status,400)
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
})
test('browser chat context keeps valid recent turns within request limits without mutating displayed history',async()=>{
 const source=stripTypeScriptTypes(readFileSync('src/lib/chat-context.ts','utf8'))
 const {chatContext}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
 const messages=Array.from({length:41},(_,index)=>({id:String(index),role:index%2?'assistant':'user',content:'x'.repeat(2000)}))
 const context=chatContext(messages)
 assert.equal(messages.length,41);assert.ok(context.length<=19);assert.ok(context.reduce((sum,row)=>sum+row.content.length,0)<=10000)
 assert.equal(context.at(-1).content,messages.at(-1).content);assert.equal(chatSchema.safeParse({messages:context}).success,true)
})
