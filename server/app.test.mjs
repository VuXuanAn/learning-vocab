import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createApp } from './app.mjs'
import { generationSchema, generateVocabulary, GenerationError } from './generate.mjs'

const body = { word: 'resilient', kind: 'basic', sourceFieldId: 'front', fields: [{ id: 'front', name: 'Word', value: '' }, { id: 'back', name: 'Meaning', value: '' }] }
const completed = output => ({ status: 'completed', output: [], output_text: JSON.stringify(output) })
async function withServer(options, run) {
  const server = createApp(options).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  try { await run(base) } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
}
const post = (base, payload = body, headers = {}) => fetch(`${base}/api/ai/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) })

test('health and missing key return usable status without exposing secrets', async () => withServer({}, async base => {
  assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { status: 'ok', provider: 'gemini', aiConfigured: false, model: 'gemini-3.5-flash-lite' })
  assert.equal((await post(base)).status, 503)
}))
test('validates inputs before calling AI', async () => withServer({ client: { responses: { create() { throw new Error('must not call') } } } }, async base => {
  assert.equal((await post(base, { ...body, word: '' })).status, 400)
  assert.equal((await post(base, { ...body, sourceFieldId: 'missing' })).status, 400)
  assert.equal((await post(base, { ...body, fields: [body.fields[0], body.fields[0]] })).status, 400)
}))
test('generates dynamic field schema and preserves user input', async () => {
  let captured
  const client = { responses: { create: async request => { captured = request; return completed({ f0: 'incorrect source', f1: 'AI meaning' }) } } }
  const result = await generateVocabulary(client, 'test-model', { ...body, fields: [body.fields[0], { ...body.fields[1], value: 'My definition' }] })
  assert.deepEqual(result.values, { front: 'resilient', back: 'My definition' })
  assert.equal(captured.store, false)
  assert.equal(captured.text.format.strict, true)
  assert.deepEqual(captured.text.format.schema.required, ['f0', 'f1'])
})
test('custom IDs and labels are mapped back correctly', async () => {
  const request = { ...body, kind: 'custom', sourceFieldId: 'uuid-1', fields: [{ id: 'uuid-1', name: 'Word', value: '' }, { id: 'uuid-2', name: 'IPA', value: '' }] }
  const result = await generateVocabulary({ responses: { create: async () => completed({ f0: 'resilient', f1: '/r/' }) } }, 'test', request)
  assert.deepEqual(result.values, { 'uuid-1': 'resilient', 'uuid-2': '/r/' })
})
test('refusal, incomplete and malformed model responses are handled', async () => {
  for (const response of [{ status: 'incomplete' }, { status: 'completed', output_text: 'invalid' }, completed({ f0: 'only one field' }), { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }]) {
    await assert.rejects(() => generateVocabulary({ responses: { create: async () => response } }, 'test', body), GenerationError)
  }
})
test('Cloze requires valid deletion syntax and keeps complete sentences', async () => {
  const request = { ...body, kind: 'cloze' }
  const client = { responses: { create: async () => completed({ f0: 'She is {{c1::resilient}}.', f1: 'A translation' }) } }
  assert.equal((await generateVocabulary(client, 'test', request)).values.front, 'She is {{c1::resilient}}.')
  await assert.rejects(() => generateVocabulary({ responses: { create: async () => completed({ f0: 'plain word', f1: '' }) } }, 'test', request), GenerationError)
})
test('API success is wired through Express to the generator', async () => withServer({ client: { responses: { create: async () => completed({ f0: 'resilient', f1: 'meaning' }) } } }, async base => {
  const response = await post(base)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { values: { front: 'resilient', back: 'meaning' } })
}))
test('upstream errors never disclose provider details or keys', async () => {
  for (const status of [401, 403, 429, 500]) await withServer({ client: { responses: { create: async () => { throw Object.assign(new Error('secret-test-key'), { status }) } } } }, async base => {
    const response = await post(base)
    assert.equal(response.status, status === 429 ? 429 : 502)
    assert.ok(!(await response.text()).includes('secret-test-key'))
  })
})
test('rejects foreign origins, malformed JSON and oversized bodies', async () => withServer({}, async base => {
  assert.equal((await post(base, body, { Origin: 'https://untrusted.example' })).status, 403)
  assert.equal((await fetch(`${base}/api/ai/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400)
  assert.equal((await post(base, { ...body, word: 'x'.repeat(70000) })).status, 413)
}))
test('schema enforces field count and input length', () => {
  assert.equal(generationSchema.safeParse({ ...body, word: 'x'.repeat(201) }).success, false)
  assert.equal(generationSchema.safeParse({ ...body, fields: [] }).success, false)
})
test('rate limits calls before reaching the provider', async () => withServer({}, async base => {
  for (let index = 0; index < 10; index++) assert.equal((await post(base)).status, 503)
  assert.equal((await post(base)).status, 429)
}))
test('serves built frontend and supports direct React routes', async () => withServer({ serveFrontend: true }, async base => {
  const response = await fetch(`${base}/review?folder=test`)
  assert.equal(response.status, 200)
  assert.ok((await response.text()).includes('id="root"'))
  assert.equal((await fetch(`${base}/api/unknown`)).status, 404)
}))
