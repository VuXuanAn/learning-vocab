import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {JSDOM} from 'jsdom'
import React,{act} from 'react'
const source=stripTypeScriptTypes(readFileSync('src/components/ui/select-portal.ts','utf8'))
const {selectPortalContainer}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
test('normal dropdown portal uses undefined instead of null so Base UI can mount',()=>{
 assert.equal(selectPortalContainer(undefined,null),undefined)
 const fullscreen={id:'fullscreen'},explicit={id:'custom'}
 assert.equal(selectPortalContainer(undefined,fullscreen),fullscreen)
 assert.equal(selectPortalContainer(explicit,fullscreen),explicit)
 assert.equal(selectPortalContainer(null,fullscreen),null)
})
test('Base UI portal renders dropdown content with the normal and fullscreen containers',async()=>{
 const dom=new JSDOM('<div id="app"></div><div id="fullscreen"></div>',{url:'http://localhost'})
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.HTMLElement=dom.window.HTMLElement;globalThis.Element=dom.window.Element;globalThis.Node=dom.window.Node;globalThis.IS_REACT_ACT_ENVIRONMENT=true
 const {createRoot}=await import('react-dom/client')
 const {FloatingPortal}=await import(new URL('../node_modules/@base-ui/react/floating-ui-react/components/FloatingPortal.js',import.meta.url))
 const root=createRoot(document.getElementById('app'))
 try{
  await act(async()=>root.render(React.createElement(FloatingPortal,{container:selectPortalContainer(undefined,null)},React.createElement('div',{'data-menu':'folder'},'Create folder'))))
  assert.equal(document.querySelector('[data-menu="folder"]').textContent,'Create folder')
  const fullscreen=document.getElementById('fullscreen')
  await act(async()=>root.render(React.createElement(FloatingPortal,{container:selectPortalContainer(undefined,fullscreen)},React.createElement('div',{'data-menu':'folder'},'Create folder'))))
  assert.ok(fullscreen.querySelector('[data-menu="folder"]'))
 }finally{await act(async()=>root.unmount());dom.window.close()}
})
