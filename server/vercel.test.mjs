import test from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
test('Vercel entry boots without a port listener or disk persistence and serves API routes',async()=>{
 process.env.VERCEL_URL='preview-vocab.vercel.app'
 process.env.FRONTEND_ORIGIN='https://vocab.example.com'
 delete process.env.GEMINI_API_KEY;delete process.env.GOOGLE_API_KEY
 const {default:app}=await import('../api/index.mjs')
 assert.equal(app.get('trust proxy'),1)
 const server=app.listen(0,'127.0.0.1');await once(server,'listening')
 const origin='http://127.0.0.1:'+server.address().port
 try{
  const health=await(await fetch(origin+'/api/health')).json();assert.equal(health.status,'ok');assert.equal(health.aiConfigured,false)
  const usage=await(await fetch(origin+'/api/ai/usage')).json();assert.equal(usage.storageMode,'memory')
  for(const host of ['https://preview-vocab.vercel.app','https://vocab.example.com']){
   const response=await fetch(origin+'/api/ai/generate-batch',{method:'POST',headers:{Origin:host,'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,400)
  }
  const denied=await fetch(origin+'/api/ai/generate-batch',{method:'POST',headers:{Origin:'https://unrelated.example','Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403)
  const missing=await fetch(origin+'/api/unknown');assert.equal(missing.status,404);assert.match(missing.headers.get('content-type'),/json/)
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
})
