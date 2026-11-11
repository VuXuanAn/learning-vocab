import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAddVocabulary } from './AddVocabularyDialog'

interface SelectionMenu { text:string; left:number; top:number }
const excluded='input,textarea,select,button,a,[contenteditable="true"],[role="textbox"],[role="dialog"],[data-app-sidebar],header,[data-selection-menu]'
export default function SelectionVocabularyMenu(){
 const addVocabulary=useAddVocabulary()
 const location=useLocation()
 const [menu,setMenu]=useState<SelectionMenu|null>(null)
 const activation=useRef(false)
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>|undefined
  function read(){
   if(document.querySelector('[role="dialog"]')){setMenu(null);return}
   const selection=window.getSelection()
   if(!selection||selection.isCollapsed||!selection.rangeCount){setMenu(null);return}
   const range=selection.getRangeAt(0)
   const element=(node:Node|null)=>node instanceof Element?node:node?.parentElement
   const start=element(range.startContainer),end=element(range.endContainer)
   if(!start?.closest('main')||!end?.closest('main')||start.closest(excluded)||end.closest(excluded)){setMenu(null);return}
   const text=selection.toString().trim().replace(/\s+/gu,' ')
   if(!text||text.length>200||!/[\p{L}\p{N}]/u.test(text)){setMenu(null);return}
   const rect=range.getBoundingClientRect()
   if(!rect.width&&!rect.height){setMenu(null);return}
   const width=190,height=40,gap=8
   const left=Math.max(gap,Math.min(rect.left+rect.width/2-width/2,window.innerWidth-width-gap))
   const top=rect.bottom+gap+height<window.innerHeight?rect.bottom+gap:Math.max(gap,rect.top-height-gap)
   activation.current=false
   setMenu({text,left,top})
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(read,120)}
  function hide(){clearTimeout(timer);setMenu(null)}
  function keyboard(event:KeyboardEvent){if(event.key==='Escape')hide();else if(event.shiftKey||event.key.startsWith('Arrow'))schedule()}
  document.addEventListener('selectionchange',schedule)
  document.addEventListener('pointerup',schedule)
  document.addEventListener('keyup',keyboard)
  window.addEventListener('scroll',hide,true)
  window.addEventListener('resize',hide)
  return()=>{clearTimeout(timer);document.removeEventListener('selectionchange',schedule);document.removeEventListener('pointerup',schedule);document.removeEventListener('keyup',keyboard);window.removeEventListener('scroll',hide,true);window.removeEventListener('resize',hide)}
 },[])
 useEffect(()=>setMenu(null),[location.key])
 function activate(){
  if(!menu||activation.current)return
  activation.current=true
  // Capture and open before focus/selection changes can remove the floating button.
  const text=menu.text
  addVocabulary(undefined,text)
  setMenu(null)
  window.getSelection()?.removeAllRanges()
 }
 if(!menu)return null
 const portal=document.fullscreenElement??document.body
 return createPortal(<button data-selection-menu type="button" title={'Thêm từ vựng: '+menu.text} aria-label={'Thêm từ vựng: '+menu.text} style={{left:menu.left,top:menu.top,width:190}} className="fixed z-[80] flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-700 px-3 text-sm font-medium text-white shadow-lg hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();activate()}} onClick={event=>{event.preventDefault();event.stopPropagation();activate()}}><Plus size={16}/>Thêm từ vựng</button>,portal)
}
