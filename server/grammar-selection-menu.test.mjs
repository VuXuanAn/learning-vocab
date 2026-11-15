import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {JSDOM} from 'jsdom'
import React,{act} from 'react'

test('grammar actions appear for single-word selections in Shadowing, other pages and read-only popups',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true})
 for(const key of ['window','document','HTMLElement','Element','Node','Text','DOMParser','MutationObserver','ShadowRoot','navigator','getComputedStyle','KeyboardEvent','MouseEvent','Event','CustomEvent'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true})
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window)
 globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window)
 dom.window.Range.prototype.getBoundingClientRect=()=>new dom.window.DOMRect(100,100,80,20)
 const server=await createServer({server:{middlewareMode:true,ws:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'})
 let root
 try{
  const {createRoot}=await import('react-dom/client')
  const {MemoryRouter}=await import('react-router-dom')
  const {default:Menu}=await server.ssrLoadModule('/src/lib/SelectionVocabularyMenu.tsx')
  root=createRoot(document.getElementById('root'))
  const fixtures=React.createElement('main',null,
   React.createElement('div',{'data-shadowing-lesson':'lesson'},React.createElement('p',{id:'shadowing'},'freed')),
   React.createElement('p',{id:'other'},'useful'),
   React.createElement('div',{role:'dialog'},React.createElement('p',{id:'popup'},'word')),
   React.createElement('div',{contentEditable:true,suppressContentEditableWarning:true},React.createElement('p',{id:'editing'},'draft')))
  await act(async()=>root.render(React.createElement(MemoryRouter,null,fixtures,React.createElement(Menu))))
  const received=[]
  window.addEventListener('grammar:selection',event=>received.push(event.detail))
  async function select(id){
   const range=document.createRange();range.selectNodeContents(document.getElementById(id))
   window.getSelection().removeAllRanges();window.getSelection().addRange(range)
   await act(async()=>{document.dispatchEvent(new window.Event('selectionchange'));await new Promise(resolve=>setTimeout(resolve,160))})
  }
  for(const id of ['shadowing','other','popup']){
   await select(id)
   const actions=[...document.querySelectorAll('[data-selection-menu] button')]
   assert.ok(actions.some(button=>button.textContent==='Thêm ngữ pháp'),id)
   assert.ok(actions.some(button=>button.textContent==='Giấy nháp phân tích'),id)
   const assign=actions.find(button=>button.textContent==='Gán ngữ pháp')
   assert.ok(assign,id)
   await act(async()=>assign.click())
   assert.equal(received.at(-1).mode,'assign')
   assert.equal(received.at(-1).range.toString(),document.getElementById(id).textContent)
  }
  const scratchEvents=[]
  window.addEventListener('scratchpad:open',event=>scratchEvents.push(event.detail))
  await select('other')
  const scratch=[...document.querySelectorAll('[data-selection-menu] button')].find(button=>button.textContent==='Giấy nháp phân tích')
  await act(async()=>scratch.click())
  assert.equal(scratchEvents[0].text,'useful')
  await select('editing')
  assert.equal(document.querySelector('[data-selection-menu]'),null)
 }finally{if(root)await act(async()=>root.unmount());await server.close();dom.window.close()}
})
