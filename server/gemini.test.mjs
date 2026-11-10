import test from 'node:test'
import assert from 'node:assert/strict'
import { GoogleGenAI } from '@google/genai'
import { createGeminiClient, DEFAULT_GEMINI_MODEL, providerError } from './gemini.mjs'
import { generateBatch } from './batch.mjs'

const request = { words: ['resilient'], sourceFieldId: 'word', fields: [{ id: 'word', name: 'Word' }, { id: 'meaning', name: 'Meaning' }] }
const schema = { type: 'object', properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false }

test('Gemini adapter forwards JSON schema, system instruction and token cap', async () => {
  let calls = 0
  let received
  const client = createGeminiClient({ ai: { models: { generateContent: async input => {
    received = input; calls++
    return { candidates: [{ finishReason: 'STOP' }], text: '{"value":"ok"}', usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 3 } }
  } } } })
  const result = await client.responses.create({ model: DEFAULT_GEMINI_MODEL, input: 'word', instructions: 'system', max_output_tokens: 1000, text: { format: { schema } } })
  assert.equal(calls, 1)
  assert.equal(received.config.responseMimeType, 'application/json')
  assert.deepEqual(received.config.responseJsonSchema, schema)
  assert.equal(received.config.systemInstruction, 'system')
  assert.equal(received.config.maxOutputTokens, 1000)
  assert.equal(result.status, 'completed')
  assert.equal(result.usage.output_tokens, 23)
})
test('Gemini blocked and truncated responses stay blocked/incomplete', async () => {
  for (const result of [{ promptFeedback: { blockReason: 'SAFETY' } }, { candidates: [{ finishReason: 'SAFETY' }] }, { candidates: [{ finishReason: 'MAX_TOKENS' }], text: '{' }]) {
    const client = createGeminiClient({ ai: { models: { generateContent: async () => result } } })
    const response = await client.responses.create({ model: 'test', input: '', text: { format: { schema } } })
    assert.equal(response.status, 'incomplete')
  }
})
test('real Google SDK transport works with batch mapping in a single request', async () => {
  let calls = 0
  const google = new GoogleGenAI({ apiKey: 'test-key-only', httpOptions: { retryOptions: { attempts: 1 }, fetch: async (url, init) => {
    calls++
    assert.ok(String(url).includes(DEFAULT_GEMINI_MODEL))
    const body = JSON.parse(init.body)
    assert.equal(body.generationConfig.responseMimeType, 'application/json')
    assert.equal(body.generationConfig.responseJsonSchema.type, 'object')
    return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({ rows: [{ index: 0, spelling: { status: 'correct', suggestion: '', reason: '' }, values: { f0: 'meaning' } }] }) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 40 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } } })
  const result = await generateBatch(createGeminiClient({ ai: google }), DEFAULT_GEMINI_MODEL, request)
  assert.equal(calls, 1)
  assert.equal(result.rows[0].values.word, 'resilient')
  assert.equal(result.rows[0].values.meaning, 'meaning')
  assert.equal(result.usage.inputTokens, 30)
})
test('Gemini quota errors do not trigger retries or expose upstream secrets', async () => {
  let calls = 0
  const google = new GoogleGenAI({ apiKey: 'test-key-only', httpOptions: { retryOptions: { attempts: 1 }, fetch: async () => {
    calls++
    return new Response(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'do-not-show-this-key' } }), { status: 429, headers: { 'Content-Type': 'application/json' } })
  } } })
  try { await generateBatch(createGeminiClient({ ai: google }), DEFAULT_GEMINI_MODEL, request); assert.fail('must reject') }
  catch(error) { const mapped = providerError(error); assert.equal(mapped.status, 429); assert.ok(!mapped.error.includes('do-not-show-this-key')) }
  assert.equal(calls, 1)
})
test('provider error codes distinguish invalid key, quota, model and timeout', () => {
  for(const error of [{status:401},{status:403},{status:400,message:'API_KEY_INVALID'}]) assert.ok(providerError(error).error.includes('API key'))
  assert.equal(providerError({status:429}).status,429)
  assert.ok(providerError({status:404}).error.includes('Model'))
  assert.equal(providerError({name:'AbortError'}).status,504)
  assert.equal(providerError({status:500,message:'secret'}).error.includes('secret'),false)
})
