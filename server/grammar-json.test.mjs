import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const source=readFileSync('src/lib/grammar-json.ts','utf8').replace("'zod'",JSON.stringify(import.meta.resolve('zod')))
const {parseGrammarJson,parseGrammarImport,grammarJsonTemplate}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'))
test('Downloaded template imports every field and preserves paired examples and optional empty rows',()=>{
 assert.deepEqual(parseGrammarJson(JSON.stringify(grammarJsonTemplate)),grammarJsonTemplate)
 const input={...grammarJsonTemplate,usages:[...grammarJsonTemplate.usages,{id:10,content:''}]}
 assert.deepEqual(parseGrammarJson('\uFEFF'+JSON.stringify(input)),input)
 const parsed=parseGrammarJson(JSON.stringify({...input,id:'foreign',ownerId:'foreign',folderId:'foreign'}))
 assert.equal(parsed.ownerId,undefined);assert.equal(parsed.folderId,undefined);assert.equal(parsed.id,undefined)
 assert.equal(Object.hasOwn(grammarJsonTemplate,'category'),false)
 assert.equal(Object.hasOwn(parseGrammarJson(JSON.stringify({...input,category:'tenses'})),'category'),false)
})
test('Malformed JSON and invalid structures are rejected before editing the form',()=>{
 for(const text of ['{', 'null','[]','{}'])assert.throws(()=>parseGrammarJson(text))
 for(const patch of [{level:'A9'},{structures:[]},{structures:[{id:1,type:'',formula:''}]},{usages:[{id:1,content:'a'},{id:1,content:'b'}]},{examples:[{id:1,en:'',vi:'translation'}]},{structures:[{id:'1',type:'',formula:'S + V'}]}])assert.throws(()=>parseGrammarJson(JSON.stringify({...grammarJsonTemplate,...patch})))
 assert.throws(()=>parseGrammarJson(' '.repeat(1500001)))
})


test('AI imports accept free formatted HTML, preserve legacy imports and ignore account fields',()=>{
 const rich={name:'Work out',contentHtml:'<h2>Cách dùng</h2><p style="color: #047857">Ví dụ tự do.</p>'}
 assert.deepEqual(parseGrammarImport(JSON.stringify({...rich,id:'foreign',ownerId:'other',folderId:'other'})),rich)
 assert.deepEqual(parseGrammarImport(JSON.stringify(grammarJsonTemplate)),grammarJsonTemplate)
 for(const patch of [{name:''},{name:'x'.repeat(161)},{contentHtml:''},{contentHtml:42}])assert.throws(()=>parseGrammarImport(JSON.stringify({...rich,...patch})))
 assert.throws(()=>parseGrammarImport(' '.repeat(1500001)))
})
test('AI prompt documents the actual rich import envelope and supports a prefilled topic',async()=>{
 const promptSource=readFileSync('src/lib/grammar-import-prompt.ts','utf8')
 const {grammarImportPrompt}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(promptSource)).toString('base64'))
 const prompt=grammarImportPrompt('Get to + V')
 assert.ok(prompt.includes('Get to + V'))
 for(const term of ['name','contentHtml','font-size','text-align','taskList','colspan','rowspan'])assert.ok(prompt.includes(term))
 const sample=prompt.slice(prompt.lastIndexOf('\n{')+1)
 assert.ok(parseGrammarImport(sample).contentHtml.includes('<h2>'))
 assert.ok(grammarImportPrompt('').includes('[ĐIỀN CHỦ ĐỀ NGỮ PHÁP]'))
})
