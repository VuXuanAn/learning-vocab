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
const grammarUrl=url(readFileSync('src/lib/reading-grammar.ts','utf8'))
const similarity=url(readFileSync('src/lib/reading-similarity.ts','utf8'))
const source=readFileSync('src/lib/reading-content.ts','utf8').replace("import DOMPurify from 'dompurify'",'const DOMPurify=globalThis.__readingPurify').replace("'./related-words'",JSON.stringify(related)).replace("'./reading-similarity'",JSON.stringify(similarity)).replace("'./reading-grammar'",JSON.stringify(grammarUrl))
const {cleanReadingHtml,detectReadingVocab,renderReadingHtml,readingSelection,highlightReadingGrammar}=await import(url(source))
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

const {translationChunks}=await import(url(readFileSync('src/lib/reading-translation.ts','utf8').replace("'./reading-content'",JSON.stringify(url(source)))))
test('Translation includes links, code, tables and every chunk of long passages within API limits',()=>{
 const chunks=translationChunks('<h2>Title</h2><p>Hello <a href="https://example.com">link</a><br>New line <code>code</code></p><table><tr><td>Left</td><td>Right</td></tr></table><p>'+('word 😀 '.repeat(2500))+'</p>')
 assert.ok(chunks.length>1)
 assert.ok(chunks.every(chunk=>chunk.length<=6000))
 const text=chunks.join(' ')
 assert.ok(text.includes('Hello link\nNew line code'))
 assert.ok(text.includes('Left\tRight'))
 assert.equal((text.match(/word 😀/g)??[]).length,2500)
 assert.equal(translationChunks('<p> </p>').length,0)
 assert.ok(!translationChunks('<p>hello<script>evil()</script></p>')[0].includes('evil'))
})

test('Inflections and typos require suggestions while exact matches link immediately',async()=>{
 const notes=[note('pin','pinpoint'),note('run','run'),note('study','study'),note('write','write'),note('child','child'),note('wander','wander'),note('planet','planet'),note('plant','plant')]
 const result=await detectReadingVocab('<p>pinpoint Pinpointing pinpoiting running studied written children wandered planit cat</p>',notes)
 assert.deepEqual(result.matches.map(match=>match.noteId),['pin'])
 const candidates=word=>result.suggestions.find(row=>row.word===word)?.candidates.map(item=>item.noteId)
 assert.ok(candidates('Pinpointing').includes('pin'))
 assert.ok(candidates('pinpoiting').includes('pin'))
 assert.ok(candidates('running').includes('run'))
 assert.ok(candidates('studied').includes('study'))
 assert.ok(candidates('written').includes('write'))
 assert.ok(candidates('children').includes('child'))
 assert.ok(candidates('wandered').includes('wander'))
 assert.ok(candidates('planit').includes('planet'))
 assert.ok(candidates('planit').includes('plant'))
 assert.equal(candidates('cat'),undefined)
 assert.equal(result.suggestions.some(row=>row.word==='pinpoint'),false)
 assert.equal(root(renderReadingHtml(result.html,result,new Set(notes.map(row=>row.id)))).querySelectorAll('[data-reading-note]').length,1)
})
test('Suggestions group occurrences with correct offsets, exclude exact phrases and protected markup, and preserve confirmed choices',async()=>{
 const html='<p>Pinpointing, <strong>pinpointing</strong>. Break the ice. <a href="https://example.com">pinpointing</a><code>pinpointing</code></p>'
 const notes=[note('pin','pinpoint'),note('phrase','break the ice'),note('ice','iced')]
 const first=await detectReadingVocab(html,notes)
 assert.equal(first.suggestions.length,1)
 const row=first.suggestions[0]
 assert.equal(row.occurrences.length,2)
 const confirmed=row.occurrences.map(occurrence=>({...occurrence,noteId:'pin',word:'pinpoint',confirmed:true}))
 const previous={...first,matches:[...first.matches,...confirmed]}
 const rendered=root(renderReadingHtml(html,previous,new Set(['pin','phrase'])))
 assert.equal(rendered.querySelectorAll('[data-reading-note="pin"]').length,2)
 assert.ok(rendered.querySelector('strong [data-reading-note="pin"]'))
 const next=await detectReadingVocab(html,notes,undefined,previous)
 assert.equal(next.suggestions.length,0)
 assert.equal(next.matches.filter(match=>match.confirmed).length,2)
 const removed=await detectReadingVocab(html,[note('phrase','break the ice')],undefined,previous)
 assert.equal(removed.matches.some(match=>match.noteId==='pin'),false)
 const changed=await detectReadingVocab('<p>Other text</p>',notes,undefined,previous)
 assert.equal(changed.matches.some(match=>match.confirmed),false)
})

const {grammarTokens,grammarPattern}=await import(url(readFileSync('src/lib/reading-grammar.ts','utf8')))
test('Grammar selection maps rendered vocabulary links and inline HTML to stable offsets',async()=>{
 const html='<p>Gossip freed <strong>our ancestors</strong> from sitting around.</p>'
 const detection=await detectReadingVocab(html,[note('freed','freed')])
 const displayed=root(renderReadingHtml(html,detection,new Set(['freed'])))
 const range=document.createRange();range.setStart(displayed.querySelector('a').firstChild,0)
 const last=displayed.querySelector('p').lastChild
 range.setEnd(last,' from'.length)
 const selection=readingSelection(html,displayed,range)
 assert.equal(selection.quote,'freed our ancestors from')
 const tokens=grammarTokens(selection.quote),chosen=new Set([0,3])
 assert.equal(grammarPattern(selection.quote,chosen),'freed … from')
 const source={...selection,articleId:'article',articleTitle:'Reading',contentHtml:html,highlights:tokens.filter((_,index)=>chosen.has(index)).map(token=>({start:selection.start+token.start,end:selection.start+token.end}))}
 const entry={id:'grammar',structure:'free … from',source}
 const highlighted=root(highlightReadingGrammar(displayed.innerHTML,html,[entry]))
 assert.equal(highlighted.textContent,displayed.textContent)
 assert.deepEqual([...highlighted.querySelectorAll('mark')].map(mark=>mark.textContent),['freed','from'])
 assert.ok(highlighted.querySelector('a[data-reading-grammar="grammar"] mark'))
 assert.equal(highlighted.querySelectorAll('a[data-reading-grammar]').length,1)
 assert.equal(highlighted.querySelector('a[data-reading-grammar]').textContent,'freed our ancestors from')
 assert.equal(highlighted.querySelector('a a'),null)
 assert.equal(highlighted.querySelector('strong').textContent,'our ancestors')
 assert.equal(highlighted.querySelector('mark').dataset.readingGrammar,'grammar')
 assert.equal(highlighted.querySelector('mark').title,'free … from')
 // A second selection still maps after existing highlights have split text nodes.
 const again=document.createRange();again.selectNodeContents(highlighted.querySelector('p'))
 assert.ok(readingSelection(html,highlighted,again).quote.startsWith('Gossip freed'))
 assert.equal(root(highlightReadingGrammar(renderReadingHtml(html+'<p>Changed</p>',undefined,new Set()),html+'<p>Changed</p>',[entry])).querySelector('mark'),null)
})
test('Grammar highlights preserve nested formatting, trim selection edges and exclude mismatched source or quotes',()=>{
 const html='<p>  freed <em>our ancestors</em> from  </p>',displayed=root(renderReadingHtml(html,undefined,new Set()))
 const range=document.createRange();range.selectNodeContents(displayed.querySelector('p'))
 const selected=readingSelection(html,displayed,range)
 assert.equal(selected.quote,'freed our ancestors from')
 const source={...selected,articleId:'article',contentHtml:html,highlights:[{start:selected.start,end:selected.end}]}
 const output=root(highlightReadingGrammar(displayed.innerHTML,html,[{id:'grammar',structure:'freed our ancestors from',source}]))
 assert.equal(output.textContent,displayed.textContent)
 assert.equal(output.querySelector('em mark').textContent,'our ancestors')
 assert.equal(root(highlightReadingGrammar(displayed.innerHTML,html,[{id:'grammar',source:{...source,quote:'wrong'}}])).querySelector('mark'),null)
 const other=root('<p>different</p>'),foreign=document.createRange();foreign.selectNodeContents(other)
 assert.equal(readingSelection(html,displayed,foreign),null)
})

test('Grammar highlights only the structural words when old selections cover an entire phrase',()=>{
 const html='<p>freed our ancestors from</p>',displayed=renderReadingHtml(html,undefined,new Set()),element=root(displayed),range=document.createRange()
 range.selectNodeContents(element.querySelector('p'))
 const selection=readingSelection(html,element,range),tokens=grammarTokens(selection.quote)
 const source={...selection,articleId:'article',contentHtml:html,highlights:tokens.map(token=>({start:selection.start+token.start,end:selection.start+token.end}))}
 for(const structure of ['free … from','free ... from','free from']){
  const result=root(highlightReadingGrammar(displayed,html,[{id:'grammar',structure,source}]))
  assert.deepEqual([...result.querySelectorAll('mark')].map(mark=>mark.textContent),['freed','from'])
  assert.equal(result.textContent,element.textContent)
 }
})
test('Grammar keyword selection respects inflections and order without fuzzy matches',async()=>{
 const {grammarKeywordIndices}=await import(grammarUrl)
 assert.deepEqual([...grammarKeywordIndices('freed our ancestors from','free … from')],[0,3])
 assert.deepEqual([...grammarKeywordIndices('takes his time to learn','take … to')],[0,3])
 assert.deepEqual([...grammarKeywordIndices('running slowly toward home','run … toward')],[0,2])
 assert.equal(grammarKeywordIndices('freed our ancestors from','flee … from').size,0)
 assert.equal(grammarKeywordIndices('from our ancestors freed','free … from').size,0)
})

test('Grammar keyword span is one accessible link while only the keywords are yellow',()=>{
 const html='<p>Before freed our ancestors from sitting around.</p>',element=root(renderReadingHtml(html,undefined,new Set()))
 const range=document.createRange(),text=element.querySelector('p').firstChild
 range.setStart(text,7);range.setEnd(text,31)
 const selected=readingSelection(html,element,range)
 const source={...selected,contentHtml:html,highlights:[{start:selected.start,end:selected.start+5},{start:selected.end-4,end:selected.end}]}
 const result=root(highlightReadingGrammar(element.innerHTML,html,[{id:'grammar',folderId:'folder',structure:'free … from',source}]))
 const links=result.querySelectorAll('a.reading-grammar-link')
 assert.equal(links.length,1)
 assert.equal(links[0].textContent,'freed our ancestors from')
 assert.equal(links[0].getAttribute('href'),'/grammar?folder=folder&grammar=grammar')
 assert.deepEqual([...links[0].querySelectorAll('mark')].map(mark=>mark.textContent),['freed','from'])
 assert.equal(result.textContent,element.textContent)
 assert.equal(result.querySelector('mark a'),null)
 const again=document.createRange();again.selectNodeContents(links[0])
 assert.equal(readingSelection(html,result,again).quote,'freed our ancestors from')
})

test('Manual assignments highlight the entire selected passage and preserve links to the same grammar across articles',()=>{
 const html='<p>They are thought to have arrived.</p>'
 const quote='are thought to have arrived'
 const source={articleId:'first',articleTitle:'First',contentHtml:html,start:6,end:6+quote.length,quote,exactSelection:true,highlights:[{start:6,end:6+quote.length}]}
 const entry={id:'grammar',folderId:'folder',structure:'be thought to',sources:[source,{...source,articleId:'second',start:1,end:5,quote:'They',highlights:[{start:1,end:5}]}]}
 const first=root(highlightReadingGrammar(html,html,[entry],'first'))
 assert.equal(first.querySelector('mark').textContent,quote)
 assert.equal(first.querySelectorAll('mark').length,1)
 assert.equal(first.querySelector('a').getAttribute('href'),'/grammar?folder=folder&grammar=grammar')
 const second=root(highlightReadingGrammar(html,html,[entry],'second'))
 assert.equal(second.querySelector('mark').textContent,'They')
 assert.equal(root(highlightReadingGrammar(html,html,[entry],'other')).querySelector('mark'),null)
})
