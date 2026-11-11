import { createApp } from '../server/app.mjs'
import { createGeminiClient, DEFAULT_GEMINI_MODEL } from '../server/gemini.mjs'
import { createUsageStore } from '../server/usage.mjs'

const apiKey=process.env.GEMINI_API_KEY?.trim()||process.env.GOOGLE_API_KEY?.trim()
const origins=[process.env.VERCEL_URL,process.env.VERCEL_PROJECT_PRODUCTION_URL,process.env.VERCEL_BRANCH_URL].filter(Boolean).map(host=>'https://'+host)
const frontendOrigin=process.env.FRONTEND_ORIGIN?.trim().replace(/\/+$/,'')||origins[0]||'http://localhost:5173'
// Vercel owns the HTTP listener. No app.listen() or filesystem writes here.
export default createApp({
 client:apiKey?createGeminiClient({apiKey}):null,
 model:process.env.GEMINI_MODEL||DEFAULT_GEMINI_MODEL,
 frontendOrigin,additionalOrigins:origins,trustProxy:1,
 usageStore:createUsageStore(),serveFrontend:false,
})
