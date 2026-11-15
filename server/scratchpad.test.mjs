import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {createServer} from 'vite'
import {JSDOM} from 'jsdom'
import React,{act} from 'react'
const source=stripTypeScriptTypes(readFileSync('src/lib/scratchpad-storage.ts','utf8'))
const {loadScratchpad,saveScratchpad}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))

test('scratch drafts persist independently per account, source page and selected sentence',()=>{
 const memory=new Map(),storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)}
 const quote='But the debate does not help.'
 saveScratchpad('a','/reading',quote,'<p>Subject + verb</p>',storage)
 assert.equal(loadScratchpad('a','/reading',quote,storage).html,'<p>Subject + verb</p>')
 for(const [owner,path,text] of [['b','/reading',quote],['a','/speaking',quote],['a','/reading','Other sentence']])assert.equal(loadScratchpad(owner,path,text,storage),null)
 saveScratchpad('a','/reading',quote,'<p>Revised analysis</p>',storage)
 assert.equal(memory.size,1)
 assert.throws(()=>saveScratchpad('a','/reading',quote,'lost',{setItem:()=>{throw new Error('Quota exceeded')}}),/Quota/)
 assert.equal(loadScratchpad('a','/reading',quote,storage).html,'<p>Revised analysis</p>')
})

test('scratch tags save independent roles and word types alongside formatted notes after reopening',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true})
 for(const key of ['window','document','HTMLElement','Element','Node','Text','DOMParser','MutationObserver','ShadowRoot','navigator','getComputedStyle','KeyboardEvent','MouseEvent','Event','CustomEvent','localStorage'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true})
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window)
 globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window)
 dom.window.scrollBy=()=>{}
 const rect=new dom.window.DOMRect(0,0,100,20)
 dom.window.Range.prototype.getClientRects=()=>[rect]
 dom.window.Range.prototype.getBoundingClientRect=()=>rect
 const server=await createServer({server:{middlewareMode:true,ws:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'})
 server.config.env.VITE_SUPABASE_URL='';server.config.env.VITE_SUPABASE_PUBLISHABLE_KEY='';server.config.env.VITE_SUPABASE_ANON_KEY=''
 let root
 try{
  const {createRoot}=await import('react-dom/client')
  const {ScratchpadDialog}=await server.ssrLoadModule('/src/lib/Scratchpad.tsx')
  const props={ownerId:'a',selection:{quote:'The <debate> continues.',path:'/reading/article',version:1},onClose:()=>{}}
  const render=async()=>{root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(ScratchpadDialog,props)))}
  const content=()=>document.querySelector('[aria-label="Nội dung giấy nháp"]')
  await render()
  const word=()=>document.querySelector('[aria-label="Phân tích từ debate (từ 2)"]')
  const role=()=>[...document.querySelectorAll('[aria-label="Vai trò trong câu"] [role="radio"]')].find(button=>button.textContent.endsWith('Chủ ngữ'))
  const type=()=>[...document.querySelectorAll('[aria-label="Loại từ"] [role="radio"]')].find(button=>button.textContent.endsWith('Danh từ'))
  const notesTab=()=>document.querySelector('#scratch-notes-tab')
  assert.ok(word())
  await act(async()=>word().click())
  await act(async()=>role().click())
  await act(async()=>type().click())
  assert.equal(role().getAttribute('aria-checked'),'true')
  assert.equal(type().getAttribute('aria-checked'),'true')
  assert.match(word().textContent,/Chủ ngữ/)
  await act(async()=>notesTab().click())
  assert.equal(content().textContent,'The <debate> continues.')
  await act(async()=>content().editor.commands.setContent('<p><strong>Subject:</strong> The debate</p><p><mark data-color="#fef08a" style="background-color:#fef08a">continues</mark> = main verb</p>'))
  assert.match(document.querySelector('[role="status"]').textContent,/Đã lưu/)
  await act(async()=>root.unmount())
  root=null
  await render()
  assert.match(word().textContent,/Chủ ngữ/)
  await act(async()=>word().click())
  assert.equal(role().getAttribute('aria-checked'),'true')
  assert.equal(type().getAttribute('aria-checked'),'true')
  await act(async()=>notesTab().click())
  assert.equal(content().querySelector('strong').textContent,'Subject:')
  assert.equal(content().querySelector('mark').textContent,'continues')
  assert.match(content().textContent,/main verb/)
  await act(async()=>document.querySelector('#scratch-analysis-tab').click())
  const firstWord=()=>document.querySelector('[aria-label="Phân tích từ The (từ 1)"]')
  const lastWord=()=>document.querySelector('[aria-label="Phân tích từ continues (từ 3)"]')
  const modifierClick=async(button,modifier='ctrlKey')=>act(async()=>button.dispatchEvent(new window.MouseEvent('click',{bubbles:true,[modifier]:true})))
  await act(async()=>word().click())
  await modifierClick(firstWord())
  assert.equal(word().getAttribute('aria-pressed'),'true')
  assert.equal(firstWord().getAttribute('aria-pressed'),'true')
  assert.equal(lastWord().getAttribute('aria-pressed'),'false')
  const objectRole=[...document.querySelectorAll('[aria-label="Vai trò trong câu"] [role="radio"]')].find(button=>button.textContent.endsWith('Tân ngữ'))
  await act(async()=>objectRole.click())
  assert.match(word().textContent,/Tân ngữ/)
  assert.match(firstWord().textContent,/Tân ngữ/)
  assert.doesNotMatch(lastWord().textContent,/Tân ngữ/)
  await modifierClick(firstWord())
  assert.equal(firstWord().getAttribute('aria-pressed'),'false')
  assert.equal(word().getAttribute('aria-pressed'),'true')
  assert.equal(type().getAttribute('aria-checked'),'true')
  await act(async()=>firstWord().click())
  assert.equal(word().getAttribute('aria-pressed'),'false')
  await modifierClick(word(),'metaKey')
  assert.equal(word().getAttribute('aria-pressed'),'true')
  await modifierClick(word())
  await modifierClick(firstWord())
  assert.equal(document.querySelector('[aria-pressed="true"]'),null)
  await act(async()=>root.unmount())
  root=null
  await render()
  assert.match(word().textContent,/Tân ngữ/)
  assert.match(firstWord().textContent,/Tân ngữ/)

 }finally{if(root)await act(async()=>root.unmount());await server.close();dom.window.close()}
})


test('word tags preserve contractions and repeated words have independent saved annotations',async()=>{
 const {sentenceWords,normalizeWordAnnotations,sentenceAnalysisText}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(readFileSync('src/lib/scratchpad-analysis.ts','utf8'))).toString('base64'))
 const quote="Don't stop: stop, state-of-the-art isn't easy."
 const words=sentenceWords(quote)
 assert.deepEqual(words.map(word=>word.text),["Don't",'stop','stop','state-of-the-art',"isn't",'easy'])
 assert.equal(words.map(word=>word.text+word.after).join(''),quote)
 const annotations=normalizeWordAnnotations(quote,{[words[1].id]:{role:'verb',wordType:'verb'},[words[2].id]:{role:'object',wordType:'noun'},[words[3].id]:{role:'bad-role',wordType:'adjective'},unknown:{role:'subject'}})
 assert.equal(annotations[words[1].id].role,'verb')
 assert.equal(annotations[words[2].id].role,'object')
 assert.equal(annotations[words[3].id].role,undefined)
 assert.equal(annotations.unknown,undefined)
 assert.match(sentenceAnalysisText(quote,annotations),/stop: V · Động từ/)
 assert.match(sentenceAnalysisText(quote,annotations),/stop: O · Tân ngữ/)
})


test('merging adjacent words preserves their labels and notes, rejects disjoint selections and exports a single phrase',async()=>{
 const module=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(readFileSync('src/lib/scratchpad-analysis.ts','utf8'))).toString('base64'))
 const {sentenceWords,sentenceTags,mergeSentenceTags,splitSentenceTag,normalizeWordGroups,normalizeWordAnnotations,sentenceAnalysisText}=module
 const quote='But the archaeological debate continues.'
 const words=sentenceWords(quote)
 const annotations={[words[2].id]:{role:'subject',wordType:'adjective',note:'thuộc khảo cổ'},[words[3].id]:{role:'subject',wordType:'noun',note:'cuộc tranh luận'}}
 assert.equal(mergeSentenceTags(quote,[],annotations,new Set([words[0].id,words[2].id])),null)
 const merged=mergeSentenceTags(quote,[],annotations,new Set([words[2].id,words[3].id]))
 const tags=sentenceTags(quote,merged.groups)
 assert.equal(tags[2].text,'archaeological debate')
 assert.equal(tags.length,words.length-1)
 assert.equal(tags.map(tag=>tag.text+tag.after).join(''),quote)
 assert.equal(merged.annotations[merged.id].role,'subject')
 assert.equal(merged.annotations[merged.id].wordType,undefined)
 assert.deepEqual(merged.annotations[words[2].id],annotations[words[2].id])
 const restored=normalizeWordAnnotations(quote,JSON.parse(JSON.stringify(merged.annotations)),normalizeWordGroups(quote,JSON.parse(JSON.stringify(merged.groups))))
 assert.equal(restored[merged.id].role,'subject')
 assert.match(sentenceAnalysisText(quote,restored,merged.groups),/archaeological debate: S · Chủ ngữ/)
 const split=splitSentenceTag(quote,merged.groups,merged.annotations,merged.id)
 assert.deepEqual(split.groups,[])
 assert.deepEqual(split.annotations,annotations)
 assert.deepEqual(normalizeWordGroups(quote,[{start:words[2].start,end:words[3].end},{start:words[3].start,end:words[4].end},{start:999,end:1000}]),merged.groups)
})
