import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const source=readFileSync('src/lib/grammar-json.ts','utf8').replace("'zod'",JSON.stringify(import.meta.resolve('zod')))
const {parseGrammarJson,grammarJsonTemplate}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'))
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
