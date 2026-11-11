import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {JSDOM} from 'jsdom'
import createDOMPurify from 'dompurify'
const {window}=new JSDOM('')
globalThis.document=window.document;globalThis.Element=window.Element;globalThis.__readingPurify=createDOMPurify(window)
const url=source=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64')
const related=url(readFileSync('src/lib/related-words.ts','utf8'))
const source=readFileSync('src/lib/reading-content.ts','utf8').replace("import DOMPurify from 'dompurify'",'const DOMPurify=globalThis.__readingPurify').replace("'./related-words'",JSON.stringify(related))
const {cleanReadingHtml,detectReadingVocab,renderReadingHtml}=await import(url(source))
const note=(id,word)=>({id,kind:'basic',front:word,back:'Meaning',tags:'',createdAt:0,extra:''})
function root(html){const el=document.createElement('div');el.innerHTML=html;return el}
test('Reading HTML is sanitized before rendering; scripts, controls, handlers and unsafe URLs cannot survive',()=>{
 const safe=cleanReadingHtml('<h2>Title</h2><p onclick="evil()" style="position:fixed">Text<script>evil()</script><img src=x onerror="evil()"><a href="javascript:evil()" data-reading-note="forged">word</a><iframe src="https://bad.test"></iframe><form><input></form></p>')
 const el=root(safe)
 assert.equal(el.querySelector('script,img,iframe,input,form'),null)
 assert.equal(el.querySelector('[onclick],[style],[data-reading-note]'),null)
 assert.equal(el.querySelector('a').hasAttribute('href'),false)
 assert.equal(el.querySelector('h2').textContent,'Title')
})
test('Detect is explicit, case insensitive, whole word, longest phrase first and works over inline HTML',async()=>{
 const html='<p>SUCCESS, successful. Break <strong>the ice</strong> then break the ice.</p><p>Break</p><p>the ice</p>'
 const notes=[note('success','success'),note('phrase','break the ice'),note('break','break')]
 assert.equal(root(renderReadingHtml(html,undefined,new Set(notes.map(n=>n.id)))).querySelectorAll('[data-reading-note]').length,0)
 const detection=await detectReadingVocab(html,notes)
 assert.deepEqual(detection.matches.map(match=>match.noteId),['success','phrase','phrase','break'])
 const el=root(renderReadingHtml(html,detection,new Set(notes.map(n=>n.id))))
 assert.equal(el.textContent,root(html).textContent)
 assert.equal(el.querySelectorAll('[data-reading-note="phrase"]').length,3)
 assert.ok(el.querySelector('strong [data-reading-note="phrase"]'))
})
test('Editing content invalidates old matches, deleted vocab is no longer linked, existing links and code remain untouched',async()=>{
 const html='<p>cat catch <a href="https://example.com">cat</a> <code>cat</code> cat.</p>'
 const detection=await detectReadingVocab(html,[note('cat','cat')])
 assert.equal(detection.matches.length,2)
 assert.equal(root(renderReadingHtml(html+'more',detection,new Set(['cat']))).querySelectorAll('[data-reading-note]').length,0)
 assert.equal(root(renderReadingHtml(html,detection,new Set())).querySelectorAll('[data-reading-note]').length,0)
 assert.equal(root(renderReadingHtml(html,detection,new Set(['cat']))).querySelectorAll('[data-reading-note]').length,2)
})
test('Detection supports cancellation without leaving partial links',async()=>{
 const controller=new AbortController();controller.abort()
 await assert.rejects(()=>detectReadingVocab('<p>word</p>',[note('word','word')],controller.signal))
})
