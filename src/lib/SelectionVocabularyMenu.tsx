import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Plus, Volume2, ListPlus } from 'lucide-react'
import { toast } from 'sonner'
import { addCachedWord } from './vocabulary-cache'
import { useAddVocabulary } from './AddVocabularyDialog'

interface SelectionMenu { text:string; left:number; top:number }
const excluded='input,textarea,select,button,[contenteditable="true"],[role="textbox"],[role="dialog"],[data-app-sidebar],header,[data-selection-menu]'
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
   const width=220,height=140,gap=8
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
 function activate(action:'add'|'speak'|'cache'){
  if(!menu||activation.current)return
  activation.current=true
  // Capture and open before focus/selection changes can remove the floating button.
  const text=menu.text
  if(action==='add')addVocabulary(undefined,text)
  else if(action==='cache')void addCachedWord(text).then(added=>toast[added?'success':'info'](added?'Đã thêm vào cache từ vựng.':'Từ này đã có trong cache.')).catch(error=>toast.error(error instanceof Error?error.message:'Không lưu được cache.'))
  else if('speechSynthesis' in window&&'SpeechSynthesisUtterance' in window){
   window.speechSynthesis.cancel()
   const voice=new SpeechSynthesisUtterance(text);voice.lang='en-US';voice.rate=1
   voice.onerror=event=>{if(!['canceled','interrupted'].includes(event.error))toast.error('Chưa phát được âm thanh. Hãy thử lại.')}
   window.speechSynthesis.speak(voice)
  }
  setMenu(null)
  window.getSelection()?.removeAllRanges()
 }
 if(!menu)return null
 const portal=document.fullscreenElement??document.body
 const actions=[{id:'add',label:'Thêm từ vựng',icon:Plus},{id:'speak',label:'Phát âm',icon:Volume2},{id:'cache',label:'Thêm vào cache',icon:ListPlus}] as const
 return createPortal(<div data-selection-menu role="group" aria-label={'Thao tác với: '+menu.text} style={{left:menu.left,top:menu.top,width:220,maxWidth:'calc(100vw - 16px)'}} className="fixed z-[80] rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-xl shadow-slate-900/15">{actions.map(action=><button key={action.id} type="button" disabled={action.id==='speak'&&!('speechSynthesis' in window&&'SpeechSynthesisUtterance' in window)} className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600" onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();activate(action.id)}} onClick={event=>{event.preventDefault();event.stopPropagation();activate(action.id)}}><action.icon size={16} className="shrink-0 text-emerald-700"/>{action.label}</button>)}</div>,portal)
}
