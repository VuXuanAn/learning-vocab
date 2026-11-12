import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {JSDOM} from 'jsdom'
import React,{act} from 'react'

test('Grammar editor retains formatting across modes, imports external content and locks editing while saving',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true})
 for(const key of ['window','document','HTMLElement','Element','Node','Text','DOMParser','MutationObserver','ShadowRoot','navigator','getComputedStyle','KeyboardEvent','MouseEvent'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true})
 globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window)
 globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window)
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 dom.window.scrollBy=()=>{}
 // jsdom has no layout; provide geometry only for ProseMirror's scroll-to-selection.
 const rect=new dom.window.DOMRect(0,0,100,20)
 dom.window.Range.prototype.getClientRects=()=>[rect]
 dom.window.Range.prototype.getBoundingClientRect=()=>rect
 const server=await createServer({server:{middlewareMode:true,ws:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'})
 let root,setDraft,setDisabled,draft
 const originalFetch=globalThis.fetch
 try{
  const {createRoot}=await import('react-dom/client')
  const {default:Fields}=await server.ssrLoadModule('/src/lib/GrammarFields.tsx')
  function Form(){
   const [value,change]=React.useState({id:'entry',title:'Get to + V',structure:'',usage:'',example:'',translation:'',notes:'',contentHtml:'<p>Get to meet people.</p>'})
   const [disabled,lock]=React.useState(false)
   draft=value;setDraft=change;setDisabled=lock
   return React.createElement('fieldset',{disabled},React.createElement(Fields,{value,onChange:change,disabled}))
  }
  root=createRoot(document.getElementById('root'))
  await act(async()=>root.render(React.createElement(Form)))
  const find=text=>[...document.querySelectorAll('button')].find(button=>button.textContent===text)
  const content=()=>document.querySelector('[aria-label="Nội dung ngữ pháp"]')
  const openTools=async()=>{if(find('Mở công cụ'))await act(async()=>find('Mở công cụ').click())}
  assert.equal(document.querySelector('.grammar-format-options').hidden,true)
  await openTools()
  assert.equal(document.querySelector('.grammar-format-options').hidden,false)
  assert.equal(find('Ẩn công cụ').getAttribute('aria-expanded'),'true')
  await act(async()=>find('Ẩn công cụ').click())
  assert.equal(document.querySelector('.grammar-format-options').hidden,true)
  await openTools()

  assert.equal(content().getAttribute('contenteditable'),'true')
  assert.equal(content().textContent,'Get to meet people.')
  let editor=content().editor
  await act(async()=>{editor.commands.setTextSelection({from:1,to:4});document.querySelector('button[aria-label="In đậm (Ctrl+B)"]').click()})
  assert.match(draft.contentHtml,/<strong>Get<\/strong>/)
  assert.equal(document.querySelector('button[aria-label="In đậm (Ctrl+B)"]').getAttribute('aria-pressed'),'true')
  await act(async()=>editor.chain().setTextSelection({from:1,to:4}).setFontFamily('Georgia').setFontSize('24px').setColor('#dc2626').setHighlight({color:'#fef08a'}).setTextAlign('center').updateAttributes('paragraph',{lineHeight:'1.5'}).run())
  await act(async()=>document.querySelector('button[aria-label="Tăng thụt lề"]').click())
  assert.equal(content().querySelector('p').style.textAlign,'center')
  assert.equal(content().querySelector('p').style.marginLeft,'2em')
  assert.equal(content().querySelector('span').style.fontSize,'24px')
  assert.equal(find('HTML'),undefined)
  const raw=document.createElement('div');raw.innerHTML=draft.contentHtml
  assert.equal(raw.querySelector('strong').textContent,'Get')
  assert.equal(raw.querySelector('p').style.lineHeight,'1.5')
  await act(async()=>find('Xem trước').click())
  assert.equal(document.querySelector('[aria-label="Xem trước nội dung ngữ pháp"] strong').textContent,'Get')
  await act(async()=>find('Soạn thảo').click())
  await openTools()
  assert.equal(content().querySelector('strong').textContent,'Get')
  editor=content().editor
  await act(async()=>{editor.commands.setTextSelection(1);document.querySelector('button[aria-label="Danh sách đánh số"]').click()})
  assert.ok(content().querySelector('ol'))
  await act(async()=>document.querySelector('button[aria-label="Checklist"]').click())
  assert.ok(content().querySelector('ul[data-type="taskList"]'))
  await act(async()=>content().editor.commands.updateAttributes('taskItem',{checked:true}))
  await act(async()=>find('Xem trước').click())
  assert.equal(document.querySelector('[aria-label="Xem trước nội dung ngữ pháp"] li').getAttribute('data-checked'),'true')
  await act(async()=>find('Soạn thảo').click())
  await openTools()
  assert.equal(content().querySelector('li').getAttribute('data-checked'),'true')
  await act(async()=>setDraft(value=>({...value,contentHtml:'<h2>Imported</h2><p>New example</p>'})))
  assert.equal(content().querySelector('h2').textContent,'Imported')
  assert.ok(!content().querySelector('ol'))
  await act(async()=>document.querySelector('button[aria-label="Chèn bảng"]').click())
  assert.equal(content().querySelectorAll('table tr').length,3)
  assert.match(draft.contentHtml,/<table/)
  const tableEditor=content().editor,cells=[]
  tableEditor.state.doc.descendants((node,pos)=>{if(node.type.name==='tableHeader'||node.type.name==='tableCell')cells.push(pos)})
  await act(async()=>tableEditor.commands.setCellSelection({anchorCell:cells[0],headCell:cells[1]}))
  await act(async()=>find('Gộp ô').click())
  assert.equal(content().querySelector('th').getAttribute('colspan'),'2')
  await act(async()=>find('Tách ô').click())
  assert.equal(content().querySelectorAll('tr')[0].children.length,3)
  await act(async()=>setDisabled(true))
  assert.equal(content().getAttribute('contenteditable'),'false')
  assert.equal(document.querySelector('button[aria-label="Chèn bảng"]').disabled,true)
  await act(async()=>setDisabled(false))
  assert.equal(content().getAttribute('contenteditable'),'true')
  await act(async()=>content().editor.commands.setImage({src:'https://example.com/grammar.png',alt:'Grammar diagram',width:320,height:180}))
  assert.ok(content().querySelector('img'))
  await act(async()=>find('Xem trước').click())
  assert.equal(document.querySelector('[aria-label="Xem trước nội dung ngữ pháp"] img').getAttribute('width'),'320')
  await act(async()=>find('Soạn thảo').click())
  await openTools()
  assert.equal(content().querySelector('img').alt,'Grammar diagram')
  await act(async()=>content().editor.commands.clearContent())
  assert.equal(draft.contentHtml,'')
  const prompt=document.querySelector('#grammar-import-prompt')
  assert.ok(prompt.readOnly)
  assert.ok(prompt.value.includes('contentHtml'))
  const promptSection=document.querySelector('[aria-label="Prompt AI và import ngữ pháp"]')
  assert.ok(promptSection.compareDocumentPosition(content())&dom.window.Node.DOCUMENT_POSITION_FOLLOWING)
  const title=document.querySelector('#grammar-name')
  await act(async()=>{
   Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(title,'Câu điều kiện loại 2')
   title.dispatchEvent(new dom.window.Event('input',{bubbles:true}))
  })
  assert.ok(prompt.value.startsWith('Hãy soạn một bài ngữ pháp tiếng Anh về: Câu điều kiện loại 2.'))
  let copiedPrompt=''
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{copiedPrompt=value}}})
  await act(async()=>find('Sao chép prompt AI').click())
  assert.equal(copiedPrompt,prompt.value)

  await act(async()=>find('Import JSON').click())
  const input=document.querySelector('#grammar-json-input')
  const setInput=Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set
  await act(async()=>{
   setInput.call(input,JSON.stringify({name:'Work out',contentHtml:'<h2 style="text-align: center">Cách dùng</h2><p><strong>Work out</strong> a solution.</p>'}))
   input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))
  })
  assert.equal(find('Điền vào nội dung').disabled,false)
  await act(async()=>find('Điền vào nội dung').click())
  assert.equal(draft.title,'Work out')
  assert.equal(content().querySelector('h2').textContent,'Cách dùng')
  assert.equal(content().querySelector('h2').style.textAlign,'center')
  assert.equal(content().querySelector('strong').textContent,'Work out')
  assert.equal(find('HTML'),undefined)
  let finishGeneration,requestBody
  globalThis.fetch=async(_url,options)=>{requestBody=JSON.parse(options.body);return new Promise(resolve=>{finishGeneration=resolve})}
  await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Tạo bằng AI').click())
  assert.equal(requestBody.title,'Work out')
  assert.ok(requestBody.prompt.includes('Ưu tiên')||requestBody.prompt.includes('ưu tiên'))
  assert.ok(requestBody.prompt.includes('Không đánh số'))
  assert.equal(document.querySelector('#grammar-name').disabled,true)
  assert.equal(content().getAttribute('contenteditable'),'false')
  assert.ok(find('Dừng tạo'))
  await act(async()=>setDraft(value=>({...value,folderId:'new-folder'})))
  await act(async()=>finishGeneration(new Response(JSON.stringify({name:'Work out',contentHtml:'<h2>AI result</h2><table><tr><td>Example</td></tr></table><script>evil()</script>'}),{status:200,headers:{'Content-Type':'application/json'}})))
  assert.equal(content().querySelector('h2').textContent,'AI result')
  assert.ok(content().querySelector('table'))
  assert.equal(content().querySelector('script'),null)
  assert.equal(draft.folderId,'new-folder')
  const beforeFailure=draft.contentHtml
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'Quota test error'}),{status:429,headers:{'Content-Type':'application/json'}})
  await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Tạo bằng AI').click())
  assert.equal(draft.contentHtml,beforeFailure)
  assert.ok([...document.querySelectorAll('[role="alert"]')].some(node=>node.textContent==='Quota test error'))
  globalThis.fetch=async(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}))
  await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Tạo bằng AI').click())
  await act(async()=>find('Dừng tạo').click())
  assert.equal(draft.contentHtml,beforeFailure)
  assert.equal(document.querySelector('#grammar-name').disabled,false)

 }finally{
  if(root)await act(async()=>root.unmount())
  globalThis.fetch=originalFetch
  await server.close();dom.window.close()
 }
})
