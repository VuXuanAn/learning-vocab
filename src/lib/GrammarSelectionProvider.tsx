import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { removeGrammarHighlight } from './grammar-storage'
import { removeVocabHighlight, type VocabHighlight } from './remove-vocab-highlight'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { db } from './db'
import { useAuth } from './AuthProvider'
import type { GrammarSource } from './reading-grammar'
import { grammarHighlightRanges } from './reading-grammar'
import { grammarSelectionRoot, grammarSelectionSource, grammarSelectionBlocks } from './grammar-selection'
import { cleanReadingHtml, readingRange } from './reading-content'
import { shadowingHtml } from './shadowing-storage'
import AssignReadingGrammarDialog from './AssignReadingGrammarDialog'
import ReadingGrammarDialog from './ReadingGrammarDialog'
import GrammarCardDialog from './GrammarCardDialog'

interface GrammarHover {vocab?:VocabHighlight;id:string;source:GrammarSource;title:string;left:number;top:number;key:string}

export default function GrammarSelectionProvider({children}:{children:ReactNode}){
 const {session}=useAuth(),ownerId=session?.user.id??''
 const location=useLocation()
 const path=location.pathname+location.search
 const entries=useLiveQuery(()=>db.grammarEntries.where('ownerId').equals(ownerId).toArray(),[ownerId])
 const [selection,setSelection]=useState<{source:GrammarSource;mode:'create'|'assign'}|null>(null)
 const [card,setCard]=useState('')
 const [hover,setHover]=useState<GrammarHover|null>(null)
 const hoverRef=useRef<GrammarHover|null>(null)
 const [removing,setRemoving]=useState(false)
 const portal=useRef<HTMLElement|null>(null)
 useEffect(()=>{
  let active=true
  async function select(event:Event){
   const {range,mode}=(event as CustomEvent<{range:Range;mode:'create'|'assign'}>).detail
   const root=grammarSelectionRoot(range)
   if(!root)return
   try{
    portal.current=document.fullscreenElement as HTMLElement|null
    const articleId=root.dataset.readingArticle,lessonId=root.dataset.shadowingLesson
    let source:GrammarSource|null
    if(articleId){
     const article=await db.readingArticles.get(articleId)
     if(!active||!article||article.ownerId!==ownerId||article.deletedAt)return
     source=grammarSelectionSource(root,range,{kind:'reading',id:article.id,title:article.title,html:article.contentHtml,path})
    }else if(lessonId){
     const lesson=await db.shadowingLessons.get(lessonId)
     if(!active||!lesson||lesson.ownerId!==ownerId)return
     source=grammarSelectionSource(root,range,{kind:'shadowing',id:lesson.id,title:lesson.title,html:shadowingHtml(lesson.referenceText),path})
    }else source=grammarSelectionSource(root,range,{kind:'page',title:document.querySelector('main h1')?.textContent??document.title, path})
    if(!active)return
    if(!source){toast.error('Hãy chọn từ hoặc đoạn văn trong cùng một vùng nội dung, tối đa 10.000 ký tự.');return}
    setSelection({source,mode})
   }catch{toast.error('Chưa mở được ngữ pháp cho đoạn đã chọn. Hãy thử lại.')}
  }
  window.addEventListener('grammar:selection',select)
  return()=>{active=false;window.removeEventListener('grammar:selection',select)}
 },[ownerId,path])
 useEffect(()=>{
  const ranges:{range:Range;id:string;source:GrammarSource}[]=[]
  let frame=0
  let hideTimer:ReturnType<typeof setTimeout>|undefined
  function refresh(){
   ranges.length=0
   const sources=(entries??[]).flatMap(entry=>[...(entry.source?[entry.source]:[]),...(entry.sources??[])].filter(source=>source.sourceKind==='page'&&source.sourcePath===path).map(source=>({source,id:entry.id})))
   const roots=[...document.querySelectorAll<HTMLElement>(grammarSelectionBlocks)].filter(root=>!root.closest('[contenteditable="true"],[data-selection-menu],[data-grammar-tooltip]'))
   for(const root of roots){
    if(!sources.length)break
    const html=cleanReadingHtml(root.innerHTML)
    for(const {source,id} of sources){
     if(source.contentHtml!==html)continue
     for(const highlight of grammarHighlightRanges(source)){
      const range=readingRange(html,root,highlight.start,highlight.end)
      if(range)ranges.push({range,id,source})
     }
    }
   }
   if(typeof Highlight!=='undefined'&&globalThis.CSS?.highlights)CSS.highlights.set('grammar-source',new Highlight(...ranges.map(row=>row.range)))
  }
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(refresh)}
  function hide(){clearTimeout(hideTimer);hideTimer=undefined;hoverRef.current=null;setHover(null)}
  function locate(event:MouseEvent|FocusEvent){
   const target=event.target instanceof Element?event.target:null
   const link=target?.closest<HTMLElement>('a[data-reading-grammar]')??target?.closest<HTMLElement>('[data-reading-grammar]')
   if(link){
    const entry=entries?.find(entry=>entry.id===link.dataset.readingGrammar)
    const source=entry&&[...(entry.source?[entry.source]:[]),...(entry.sources??[])][Number(link.dataset.grammarSourceIndex)]
    if(entry&&source)return {id:entry.id,source,rect:link.getBoundingClientRect()}
   }
   const vocabLink=target?.closest<HTMLElement>('[data-reading-note]')
   const content=vocabLink?.closest<HTMLElement>('[data-reading-article],[data-shadowing-lesson]')
   if(vocabLink&&content){
    const kind=content.dataset.shadowingLesson?'shadowing' as const:'reading' as const
    const sourceId=content.dataset.shadowingLesson??content.dataset.readingArticle!
    const start=Number(vocabLink.dataset.readingStart),end=Number(vocabLink.dataset.readingEnd)
    const noteId=vocabLink.dataset.readingNote!
    if(Number.isInteger(start)&&Number.isInteger(end)&&end>start){
     const source:GrammarSource={sourceKind:kind,articleId:sourceId,articleTitle:'',contentHtml:'',quote:vocabLink.dataset.readingWord??vocabLink.textContent??'',start,end,highlights:[]}
     return {id:noteId,source,rect:vocabLink.getBoundingClientRect(),vocab:{kind,sourceId,start,end,noteId}}
    }
   }
   if(event instanceof MouseEvent){
    const row=ranges.find(({range})=>[...range.getClientRects()].some(rect=>event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom))
    if(row)return {...row,rect:row.range.getBoundingClientRect()}
   }
   return null
  }
  function hoverTarget(event:MouseEvent|FocusEvent){
   if((event.target as Element)?.closest?.('[data-grammar-tooltip]')){clearTimeout(hideTimer);hideTimer=undefined;return}
   const hit=locate(event)
   if(!hit){if(!hideTimer)hideTimer=setTimeout(hide,180);return}
   clearTimeout(hideTimer);hideTimer=undefined
   if(window.getSelection()?.toString().trim()){hide();return}
   const key=hit.id+':'+hit.source.articleId+':'+hit.source.start+':'+hit.source.end
   if(hoverRef.current?.key===key)return
   const left=Math.max(8,Math.min(hit.rect.left,window.innerWidth-328))
   const top=Math.max(8,Math.min(hit.rect.bottom+6,window.innerHeight-140))
   const next:GrammarHover={id:hit.id,source:hit.source,vocab:'vocab' in hit?hit.vocab:undefined,title:'vocab' in hit?'Từ vựng đã dò':entries?.find(entry=>entry.id===hit.id)?.title??'Ngữ pháp',left,top,key}
   hoverRef.current=next;setHover(next)
  }
  function keyboard(event:KeyboardEvent){if(event.key==='Escape')hide()}
  function click(event:MouseEvent){
   if((event.target as Element)?.closest?.('[data-grammar-tooltip]'))return
   if(window.getSelection()?.toString().trim())return
   const link=(event.target as Element).closest<HTMLElement>('[data-reading-grammar]')
   const id=link?.dataset.readingGrammar??ranges.find(({range})=>[...range.getClientRects()].some(rect=>event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom))?.id
   if(!id||!entries?.some(entry=>entry.id===id))return
   event.preventDefault();event.stopPropagation()
   portal.current=document.fullscreenElement as HTMLElement|null
   setCard(id)
  }
  schedule()
  const observer=new MutationObserver(schedule)
  observer.observe(document.body,{childList:true,subtree:true,characterData:true})
  document.addEventListener('click',click,true)
  document.addEventListener('pointermove',hoverTarget)
  document.addEventListener('focusin',hoverTarget)
  document.addEventListener('keydown',keyboard)
  window.addEventListener('scroll',hide,true)
  window.addEventListener('resize',hide)
  return()=>{clearTimeout(hideTimer);document.removeEventListener('pointermove',hoverTarget);document.removeEventListener('focusin',hoverTarget);document.removeEventListener('keydown',keyboard);window.removeEventListener('scroll',hide,true);window.removeEventListener('resize',hide);cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('click',click,true);globalThis.CSS?.highlights?.delete('grammar-source')}
 },[entries,path])
 async function removeHighlight(){
  if(!hover||removing)return
  setRemoving(true)
  try{
   if(hover.vocab)await removeVocabHighlight(hover.vocab,ownerId)
   else await removeGrammarHighlight(hover.id,ownerId,hover.source)
   hoverRef.current=null;setHover(null)
   toast.success('Đã bỏ highlight. Bạn có thể bôi đen để gán ngữ pháp khác.')
  }catch(error){toast.error(error instanceof Error?error.message:'Chưa bỏ được highlight.')}
  finally{setRemoving(false)}
 }
 return <>{children}{hover&&createPortal(<div data-grammar-tooltip role="group" aria-label={hover.vocab?'Từ vựng đã dò':'Ngữ pháp đã gán'} style={{left:hover.left,top:hover.top,width:320,maxWidth:'calc(100vw - 16px)'}} className="fixed z-[90] rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-xl" onPointerDown={event=>event.stopPropagation()}><p className="text-sm font-semibold">{hover.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{hover.source.quote}</p><div className="mt-3 flex gap-2">{!hover.vocab&&<button type="button" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100" onClick={()=>{portal.current=document.fullscreenElement as HTMLElement|null;setCard(hover.id);hoverRef.current=null;setHover(null)}}>Xem ngữ pháp</button>}<button type="button" disabled={removing} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100" onClick={()=>void removeHighlight()}>{removing?'Đang bỏ…':'Bỏ highlight'}</button></div></div>,document.fullscreenElement??document.body)}{selection?.mode==='assign'&&<AssignReadingGrammarDialog portalContainer={portal} source={selection.source} ownerId={ownerId} onClose={()=>setSelection(null)}/>} {selection?.mode==='create'&&<ReadingGrammarDialog portalContainer={portal} source={selection.source} ownerId={ownerId} onClose={()=>setSelection(null)}/>} {card&&<GrammarCardDialog id={card} ownerId={ownerId} portalContainer={portal} onClose={()=>setCard('')}/>}</>
}
