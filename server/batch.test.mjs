import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { batchSchema, generateBatch } from './batch.mjs'
import { GenerationError } from './generate.mjs'
import { createApp } from './app.mjs'

const request = { words: ['resilient', 'serendipity'], sourceFieldId: 'word', fields: [{ id: 'word', name: 'Word' }, { id: 'meaning', name: 'Meaning' }, { id: 'example', name: 'Example' }] }
const completed = rows => ({ status: 'completed', output: [], output_text: JSON.stringify({ rows }), usage: { input_tokens: 100, output_tokens: 200 } })
const sampleRows = [{ index: 0, spelling: { status: 'correct', suggestion: '', reason: '' }, values: { f0: 'meaning 1', f1: 'example 1' } }, { index: 1, spelling: { status: 'correct', suggestion: '', reason: '' }, values: { f0: 'meaning 2', f1: 'example 2' } }]

test('batch uses exactly one provider call and one shared field schema', async () => {
  let calls = 0
  let captured
  const client = { responses: { create: async input => { calls++; captured = input; return completed(sampleRows) } } }
  const result = await generateBatch(client, 'test', request)
  assert.equal(calls, 1)
  assert.deepEqual(result.rows.map(row => row.values.word), request.words)
  assert.equal(result.rows[1].values.meaning, 'meaning 2')
  assert.deepEqual(result.usage, { inputTokens: 100, outputTokens: 200 })
  assert.deepEqual(Object.keys(captured.text.format.schema.properties.rows.items.properties.values.properties), ['f0', 'f1'])
  assert.equal(captured.store, false)
  assert.deepEqual(JSON.parse(captured.input).words, request.words)
})
test('batch normalizes reordered responses by index without mixing words', async () => {
  const result = await generateBatch({ responses: { create: async () => completed([...sampleRows].reverse()) } }, 'test', request)
  assert.equal(result.rows[0].values.word, 'resilient')
  assert.equal(result.rows[0].values.meaning, 'meaning 1')
})
test('batch rejects missing, duplicate, out-of-range or invalid cells', async () => {
  for (const rows of [[sampleRows[0]], [sampleRows[0], sampleRows[0]], [sampleRows[0], { ...sampleRows[1], index: 99 }], [sampleRows[0], { index: 1, values: { f0: 123, f1: 'value' } }]]) {
    await assert.rejects(() => generateBatch({ responses: { create: async () => completed(rows) } }, 'test', request), GenerationError)
  }
})
test('batch handles refusal, invalid JSON and incomplete output', async () => {
  for (const output of [{ status: 'incomplete' }, { status: 'completed', output_text: 'invalid' }, { output: [{ type: 'message', content: [{ type: 'refusal' }] }] }]) await assert.rejects(() => generateBatch({ responses: { create: async () => output } }, 'test', request), GenerationError)
})
test('batch accepts one word; validates duplicates, limits and source field', () => {
  assert.equal(batchSchema.safeParse({ ...request, words: ['one'] }).success, true)
  for (const invalid of [{ ...request, words: [] }, { ...request, words: ['Apple', 'apple'] }, { ...request, words: Array.from({ length: 21 }, (_, i) => `word${i}`) }, { ...request, sourceFieldId: 'missing' }, { ...request, fields: [request.fields[0]] }, { ...request, words: Array.from({ length: 20 }, (_, i) => `word${i}`), fields: Array.from({ length: 11 }, (_, i) => ({ id: i ? `field${i}` : 'word', name: `Field ${i}` })) }]) assert.equal(batchSchema.safeParse(invalid).success, false)
})
test('batch endpoint returns validated table via one call', async () => {
  let calls = 0
  const server = createApp({ client: { responses: { create: async () => { calls++; return completed(sampleRows) } } } }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ai/generate-batch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).rows.length, 2)
    assert.equal(calls, 1)
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64')
const { aiTemplate, parseWordList, rowToNote } = await import(moduleUrl(readFileSync(new URL('../src/lib/ai-batch.ts', import.meta.url), 'utf8')))
const templateUrl = moduleUrl(readFileSync(new URL('../src/lib/templates.ts', import.meta.url), 'utf8'))
const { generateCards } = await import(moduleUrl(readFileSync(new URL('../src/lib/cards.ts', import.meta.url), 'utf8').replace("'./templates'", JSON.stringify(templateUrl))))
test('frontend parses words, phrases, duplicates and empty lines', () => {
  assert.deepEqual(parseWordList('resilient\n\nserendipity;break the ice,resilient'), ['resilient', 'serendipity', 'break the ice'])
  assert.equal(parseWordList('Apple\napple').length, 1)
  assert.deepEqual(parseWordList(' \n,;'), [])
})
test('reviewed table row becomes an AI note preserving edited cells and folder', () => {
  const row = { id: 'row-1', values: { word: 'resilient', ipa: '/r/', pos: 'adj', meaning: 'Edited meaning', example: 'An edited example.', translation: 'Edited translation' }, selected: true, saved: false }
  const note = rowToNote(row, aiTemplate, 'word', 'folder-1', 'tag')
  assert.equal(note.kind, 'ai')
  assert.equal(note.folderId, 'folder-1')
  assert.equal(note.values[aiTemplate.fields[3].name], 'Edited meaning')
  const cards = generateCards(note)
  assert.equal(cards.length, 1)
  assert.ok(cards[0].front.includes('resilient'))
  assert.ok(cards[0].back.includes('Edited meaning'))
})
test('custom output retains user HTML template and escaped vocabulary', () => {
  const template = { ...aiTemplate, id: 'custom' }
  const note = rowToNote({ id: 'r', values: { word: '<test>', meaning: 'meaning' } }, template, 'word', '', '')
  assert.equal(note.kind, 'custom')
  assert.ok(generateCards(note)[0].front.includes('&lt;test&gt;'))
})

test('spelling suggestions preserve original input and generate the corrected candidate', async () => {
  let calls = 0
  const result = await generateBatch({ responses: { create: async captured => {
    calls++
    assert.ok(captured.instructions.includes('US/UK'))
    return completed([{ index: 0, spelling: { status: 'suggested', suggestion: 'resilient', reason: 'Typo' }, values: { f0: 'corrected definition', f1: 'corrected example' } }])
  } } }, 'test', { ...request, words: ['resilent'] })
  assert.equal(calls, 1)
  assert.equal(result.rows[0].originalWord, 'resilent')
  assert.equal(result.rows[0].values.word, 'resilient')
  assert.equal(result.rows[0].spelling.status, 'suggested')
})
test('uncertain spellings keep input and discard guessed definitions', async () => {
  const result = await generateBatch({ responses: { create: async () => completed([{ index: 0, spelling: { status: 'uncertain', suggestion: '', reason: 'Ambiguous' }, values: { f0: 'guess', f1: 'guess' } }]) } }, 'test', { ...request, words: ['xyzpq'] })
  assert.equal(result.rows[0].values.word, 'xyzpq')
  assert.equal(result.rows[0].values.meaning, '')
  assert.equal(result.rows[0].values.example, '')
})
test('missing or contradictory spelling metadata is rejected', async () => {
  for (const spelling of [undefined, { status: 'suggested', suggestion: '', reason: '' }, { status: 'suggested', suggestion: 'resilient', reason: '' }, { status: 'correct', suggestion: 'other', reason: '' }, { status: 'uncertain', suggestion: '', reason: 1 }]) {
    await assert.rejects(() => generateBatch({ responses: { create: async () => completed([{ index: 0, spelling, values: { f0: 'meaning', f1: 'example' } }]) } }, 'test', { ...request, words: ['resilient'] }), GenerationError)
  }
})
test('automatic corrections can be saved while uncertain words require review', () => {
  const row = { id: 'flagged', originalWord: 'resilent', spelling: { status: 'suggested', suggestion: 'resilient', reason: 'Typo' }, spellingReviewed: false, values: { word: 'resilient', meaning: 'meaning' }, selected: true, saved: false }
  assert.equal(rowToNote(row, aiTemplate, 'word', 'folder', '').front, 'resilient')
  assert.throws(() => rowToNote({ ...row, spelling: { status: 'uncertain', suggestion: '', reason: '' } }, aiTemplate, 'word', 'folder', ''))
  const approved = rowToNote({ ...row, spellingReviewed: true }, aiTemplate, 'word', 'folder', '')
  assert.equal(approved.front, 'resilient')
})

test('inflected input uses the returned lemma with definitions for that lemma in one call', async () => {
  const result = await generateBatch({ responses: { create: async captured => {
    assert.ok(captured.instructions.includes('spoke/spoken/speaking -> speak'))
    assert.ok(captured.instructions.includes('effective stays effective'))
    return completed([{index:0,spelling:{status:'suggested',suggestion:'speak',reason:'Dạng gốc'},values:{f0:'nói',f1:'I speak English.'}}])
  } } }, 'test', {...request,words:['spoke']})
  const row = result.rows[0]
  assert.equal(row.originalWord,'spoke')
  assert.equal(row.values.word,'speak')
  assert.equal(row.values.example,'I speak English.')
  assert.equal(rowToNote({...row,id:'lemma',selected:true,saved:false},aiTemplate,'word','folder','').front,'speak')
})

test('word family field survives provider mapping, saving and rendering on the back', async () => {
  const related = 'effective (adj): hiệu quả\neffectively (adv): một cách hiệu quả'
  const result = await generateBatch({ responses: { create: async captured => {
    const input = JSON.parse(captured.input)
    const values = Object.fromEntries(input.fields.map(f => [f.key, f.name === 'Các dạng từ liên quan' ? related : 'meaning']))
    return completed([{index:0,spelling:{status:'correct',suggestion:'',reason:''},values}])
  } } }, 'test', {words:['effect'],sourceFieldId:'word',fields:aiTemplate.fields.map(({id,name})=>({id,name}))})
  const note=rowToNote({...result.rows[0],id:'family',selected:true,saved:false},aiTemplate,'word','folder','')
  assert.equal(note.values['Các dạng từ liên quan'],related)
  assert.ok(generateCards(note)[0].back.includes('effective (adj)'))
  assert.ok(generateCards(note)[0].back.includes('một cách hiệu quả'))
})

test('multiword vocabulary discards word-family output from the provider and on saving', async () => {
  for (const word of ['break the ice', 'take off', 'ice\tcream']) {
    const result = await generateBatch({ responses: { create: async () => completed([{index:0,spelling:{status:'correct',suggestion:'',reason:''},values:{f0:'nghĩa',f1:'example',f2:'unwanted derivative'}}]) } }, 'test', {...request,words:[word],fields:[...request.fields,{id:'wordFamily',name:'Các dạng từ liên quan'}]})
    assert.equal(result.rows[0].values.wordFamily,'')
    const note = rowToNote({id:'phrase',originalWord:word,values:{word,meaning:'nghĩa',wordFamily:'manual value'},selected:true,saved:false},aiTemplate,'word','folder','')
    assert.equal(note.values['Các dạng từ liên quan'],'')
    assert.equal(note.front,word)
  }
})
