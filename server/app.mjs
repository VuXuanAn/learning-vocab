import { reviewAudioSchema, reviewSpeaking } from './speaking-review.mjs'
import { createUsageStore, meteredClient } from './usage.mjs'
import { DEFAULT_GEMINI_MODEL, providerError } from './gemini.mjs'
import { batchSchema, generateBatch } from './batch.mjs'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { fileURLToPath } from 'node:url'
import { generateVocabulary, generationSchema, GenerationError } from './generate.mjs'

export function createApp({ client = null, model = DEFAULT_GEMINI_MODEL, frontendOrigin = 'http://localhost:5173', serveFrontend = false, usageStore = createUsageStore() } = {}) {
  const app = express()
  const trackedClient = meteredClient(client, usageStore)
  app.disable('x-powered-by')
  app.use(helmet({ contentSecurityPolicy: { directives: { connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co', 'https://www.googleapis.com', 'https://content.googleapis.com'], mediaSrc: ["'self'", 'blob:'] } } }))
  app.use('/api', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next() })
  app.get('/api/health', (_request, response) => response.json({ status: 'ok', provider: 'gemini', aiConfigured: !!client, model }))
  app.use('/api', (request, response, next) => {
    const origin = request.get('origin')
    const allowed = new Set([frontendOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173', `http://${request.get('host')}`])
    if (origin && !allowed.has(origin)) return response.status(403).json({ error: 'Nguồn yêu cầu không được phép.' })
    if (request.method === 'POST' && !request.is('application/json')) return response.status(415).json({ error: 'Yêu cầu phải có dạng JSON.' })
    next()
  })
  app.use('/api/ai/review-speaking', express.json({ limit: '15mb' }))
  app.use('/api', express.json({ limit: '64kb' }))
  app.get('/api/ai/usage', (_request, response) => response.json({ ...usageStore.summary(model), aiConfigured: !!client }))
  app.use('/api/ai', rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Bạn tạo quá nhanh. Vui lòng thử lại sau một phút.' } }))
  app.post('/api/ai/review-speaking', async (request, response) => {
    const parsed=reviewAudioSchema.safeParse(request.body)
    if(!parsed.success)return response.status(400).json({error:'Cần đoạn văn gốc và file audio hợp lệ, tối đa 10 MB.'})
    if(!client)return response.status(503).json({error:'Chưa cấu hình GEMINI_API_KEY trong server/.env.'})
    try{response.json(await reviewSpeaking(trackedClient,model,parsed.data))}
    catch(error){if(error instanceof GenerationError)return response.status(error.status).json({error:error.message});const failure=providerError(error);response.status(failure.status).json({error:failure.error})}
  })
  app.post('/api/ai/generate', async (request, response) => {
    const parsed = generationSchema.safeParse(request.body)
    if (!parsed.success) return response.status(400).json({ error: 'Từ vựng hoặc danh sách trường không hợp lệ (tối đa 30 trường).' })
    if (!client) return response.status(503).json({ error: 'Chưa cấu hình GEMINI_API_KEY trong server/.env. Thêm key rồi khởi động lại backend.' })
    try { response.json(await generateVocabulary(trackedClient, model, parsed.data)) }
    catch (error) {
      if (error instanceof GenerationError) return response.status(error.status).json({ error: error.message })
      const failure = providerError(error)
      response.status(failure.status).json({ error: failure.error })
    }
  })
  app.post('/api/ai/generate-batch', async (request, response) => {
    const parsed = batchSchema.safeParse(request.body)
    if (!parsed.success) return response.status(400).json({ error: 'Danh sách không hợp lệ: tối đa 20 từ, 20 trường và 200 ô; không lặp từ.' })
    if (!client) return response.status(503).json({ error: 'Chưa cấu hình GEMINI_API_KEY trong server/.env. Thêm key rồi khởi động lại backend.' })
    try { response.json(await generateBatch(trackedClient, model, parsed.data)) }
    catch (error) {
      if (error instanceof GenerationError) return response.status(error.status).json({ error: error.message })
      const failure = providerError(error)
      response.status(failure.status).json({ error: failure.error })
    }
  })
  app.use('/api', (_request, response) => response.status(404).json({ error: 'Không tìm thấy API.' }))
  if (serveFrontend) {
    const dist = fileURLToPath(new URL('../dist/', import.meta.url))
    app.use(express.static(dist))
    app.get('/{*path}', (_request, response) => response.sendFile(`${dist}/index.html`))
  }
  app.use((error, _request, response, _next) => {
    if (error.type === 'entity.too.large') return response.status(413).json({ error: 'Nội dung quá lớn.' })
    if (error instanceof SyntaxError && error.status === 400) return response.status(400).json({ error: 'JSON không hợp lệ.' })
    response.status(500).json({ error: 'Lỗi backend. Vui lòng thử lại.' })
  })
  return app
}
