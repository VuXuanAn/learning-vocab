import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {JSDOM} from 'jsdom'
import React,{act} from 'react'

test('grammar hover shows a removable assignment and removing it preserves the card and other sources',{timeout:30000},async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true})
 for(const key of ['window','document','HTMLElement','Element','Node','Text','DOMParser','MutationObserver','ShadowRoot','navigator','getComputedStyle','KeyboardEvent','MouseEvent','FocusEvent','Event','CustomEvent'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true})
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window)
 globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window)
 const server=await createServer({server:{middlewareMode:true,ws:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'})
 server.config.env.VITE_SUPABASE_URL=''
 server.config.env.VITE_SUPABASE_PUBLISHABLE_KEY=''
 server.config.env.VITE_SUPABASE_ANON_KEY=''
 let root,db
 try{
  const {createRoot}=await import('react-dom/client')
  const {MemoryRouter}=await import('react-router-dom')
  const {default:Provider}=await server.ssrLoadModule('/src/lib/GrammarSelectionProvider.tsx')
  ;({db}=await server.ssrLoadModule('/src/lib/db.ts'))
  const source={sourceKind:'shadowing',articleId:crypto.randomUUID(),articleTitle:'Practice',contentHtml:'<p>free from</p>',quote:'free from',start:1,end:10,highlights:[{start:1,end:5},{start:6,end:10}]}
  const other={...source,articleId:crypto.randomUUID()}
  const id=crypto.randomUUID()
  await db.grammarEntries.put({id,ownerId:'',folderId:crypto.randomUUID(),title:'Free from',source,sources:[other],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})
  root=createRoot(document.getElementById('root'))
  await act(async()=>root.render(React.createElement(MemoryRouter,null,React.createElement(Provider,null,React.createElement('main',null,React.createElement('a',{'data-reading-grammar':id,'data-grammar-source-index':'0',href:'#'},'free from'))))))
  async function until(check){
   for(let index=0;index<60;index++){
    if(await check())return
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,25))})
   }
   assert.fail('Timed out waiting for tooltip state')
  }
  const anchor=document.querySelector('a')
  await until(async()=>{await act(async()=>anchor.dispatchEvent(new window.MouseEvent('pointermove',{bubbles:true,clientX:10,clientY:10})));return !!document.querySelector('[data-grammar-tooltip]')})
  assert.match(document.querySelector('[data-grammar-tooltip]').textContent,/Free from/)
  assert.ok([...document.querySelectorAll('[data-grammar-tooltip] button')].some(button=>button.textContent==='Xem ngữ pháp'))
  const remove=[...document.querySelectorAll('[data-grammar-tooltip] button')].find(button=>button.textContent==='Bỏ highlight')
  await act(async()=>remove.click())
  await until(async()=>!(await db.grammarEntries.get(id)).source)
  const saved=await db.grammarEntries.get(id)
  assert.equal(saved.title,'Free from')
  assert.deepEqual(saved.sources,[other])
  assert.equal(document.querySelector('[data-grammar-tooltip]'),null)
  const folderId=crypto.randomUUID(),lessonId=crypto.randomUUID()
  await db.shadowingFolders.put({id:folderId,ownerId:'',name:'Work',nameKey:'work',createdAt:new Date().toISOString()})
  await db.notes.put({id:'catch-note',kind:'basic',front:'catch',back:'A catch',createdAt:0})
  const first={start:1,end:6,noteId:'catch-note',word:'catch'},second={...first,start:7,end:12}
  await db.shadowingLessons.put({id:lessonId,ownerId:'',folderId,title:'Catch',referenceText:'catch catch',detection:{html:'<p>catch catch</p>',matches:[first,second],createdAt:new Date().toISOString()},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})
  await act(async()=>root.render(React.createElement(MemoryRouter,null,React.createElement(Provider,null,React.createElement('main',null,React.createElement('div',{'data-shadowing-lesson':lessonId},React.createElement('a',{'data-reading-note':'catch-note','data-reading-start':'1','data-reading-end':'6','data-reading-word':'catch',href:'#'},'catch')))))))
  const vocab=document.querySelector('a')
  await until(async()=>{await act(async()=>vocab.dispatchEvent(new window.MouseEvent('pointermove',{bubbles:true,clientX:10,clientY:10})));return document.querySelector('[data-grammar-tooltip]')?.textContent.includes('Từ vựng đã dò')})
  const removeVocab=[...document.querySelectorAll('[data-grammar-tooltip] button')].find(button=>button.textContent==='Bỏ highlight')
  await act(async()=>removeVocab.click())
  await until(async()=>(await db.shadowingLessons.get(lessonId)).detection.matches.length===1)
  assert.deepEqual((await db.shadowingLessons.get(lessonId)).detection.matches,[second])
  assert.ok(await db.notes.get('catch-note'))

 }finally{if(root)await act(async()=>root.unmount());if(db)await db.delete();await server.close();dom.window.close()}
})
