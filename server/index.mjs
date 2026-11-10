import { createGeminiClient, DEFAULT_GEMINI_MODEL } from './gemini.mjs'
import { createApp } from './app.mjs'

const port = Number(process.env.PORT || 4100)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1-65535')
const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()
const client = apiKey ? createGeminiClient({ apiKey }) : null
const app = createApp({ client, model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173', serveFrontend: true })
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Backend listening at http://127.0.0.1:${port}`)
  console.log(client ? 'Gemini configured.' : 'Gemini not configured: add GEMINI_API_KEY to server/.env and restart.')
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)))
