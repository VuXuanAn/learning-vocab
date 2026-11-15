import { useEffect, useRef, useState, type RefObject } from 'react'
import { Copy, NotebookPen } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from './AuthProvider'
import SentenceAnalysis from './SentenceAnalysis'
import { normalizeWordAnnotations, normalizeWordGroups, sentenceAnalysisText, type WordAnnotation, type WordGroup } from './scratchpad-analysis'
import GrammarTextEditor from './GrammarTextEditor'
import { cleanGrammarHtml, grammarHtmlText } from './grammar-html'
import { loadScratchpad, saveScratchpad } from './scratchpad-storage'

interface ScratchSelection { quote:string;path:string;version:number }
export default function Scratchpad(){
 const {session}=useAuth()
 const [selection,setSelection]=useState<ScratchSelection|null>(null)
 const portal=useRef<HTMLElement|null>(null)
 useEffect(()=>{
  function open(event:Event){
   const text=(event as CustomEvent<{text:string}>).detail?.text?.trim()
   if(!text||text.length>10000)return
   portal.current=document.fullscreenElement as HTMLElement|null
   setSelection(previous=>({quote:text,path:window.location.pathname+window.location.search,version:(previous?.version??0)+1}))
  }
  window.addEventListener('scratchpad:open',open)
  return()=>window.removeEventListener('scratchpad:open',open)
 },[])
 return selection&&<ScratchpadDialog key={selection.version} ownerId={session?.user.id??''} selection={selection} portal={portal} onClose={()=>setSelection(null)}/>
}
const initialHtml=(quote:string)=>'<p>'+quote.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')+'</p><p></p>'
export function ScratchpadDialog({ownerId,selection,portal,onClose}:{ownerId:string;selection:ScratchSelection;portal?:RefObject<HTMLElement|null>;onClose:()=>void}){
 const [initial]=useState(()=>{
  try{const saved=loadScratchpad(ownerId,selection.path,selection.quote);const groups=normalizeWordGroups(selection.quote,saved?.groups);return {html:saved?cleanGrammarHtml(saved.html):initialHtml(selection.quote),groups,annotations:normalizeWordAnnotations(selection.quote,saved?.annotations,groups),status:saved?'saved' as const:'new' as const}}
  catch{return {html:initialHtml(selection.quote),annotations:{},groups:[],status:'error' as const}}
 })
 const [html,setHtml]=useState(initial.html)
 const [annotations,setAnnotations]=useState<Record<string,WordAnnotation>>(initial.annotations)
 const [groups,setGroups]=useState<WordGroup[]>(initial.groups)
 const [tab,setTab]=useState<'analysis'|'notes'>('analysis')
 const [status,setStatus]=useState<'saved'|'new'|'error'>(initial.status)
 function persist(value:string,words:Record<string,WordAnnotation>,nextGroups=groups){
  try{saveScratchpad(ownerId,selection.path,selection.quote,value,localStorage,words,nextGroups);setStatus('saved')}
  catch{setStatus('error')}
 }
 function update(value:string){setHtml(value);persist(value,annotations)}
 function updateAnnotations(value:Record<string,WordAnnotation>){setAnnotations(value);persist(html,value)}
 function updateGroups(value:WordGroup[],words:Record<string,WordAnnotation>){setGroups(value);setAnnotations(words);persist(html,words,value)}
 async function copy(){
  try{const notes=grammarHtmlText(html)
   const content=sentenceAnalysisText(selection.quote,annotations,groups)+(notes&&notes!==selection.quote?'\n\nGhi chú:\n'+notes:'')
   await navigator.clipboard.writeText(content);toast.success('Đã sao chép nội dung giấy nháp.')}
  catch{toast.error('Chưa sao chép được. Bạn có thể chọn nội dung và dùng Ctrl + C.')}
 }
 return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent portalContainer={portal} className="scratchpad-dialog flex h-[85dvh] max-h-[90dvh] flex-col gap-3 overflow-hidden sm:max-w-4xl"><DialogHeader className="shrink-0 pr-8"><DialogTitle className="flex items-center gap-2"><NotebookPen size={19} className="text-emerald-700"/>Giấy nháp phân tích</DialogTitle><DialogDescription>Bấm từng tag để chọn loại từ và vai trò trong câu. Nhãn và ghi chú được tự lưu.</DialogDescription></DialogHeader><div role="tablist" aria-label="Chế độ giấy nháp" className="flex shrink-0 gap-1 self-start rounded-lg bg-slate-100 p-1"><button type="button" id="scratch-analysis-tab" role="tab" aria-selected={tab==='analysis'} aria-controls="scratch-analysis-panel" onClick={()=>setTab('analysis')} className={'rounded-md px-3 py-2 text-sm font-medium '+(tab==='analysis'?'bg-white text-emerald-800 shadow-sm':'text-slate-500')}>Phân tích từng từ</button><button type="button" id="scratch-notes-tab" role="tab" aria-selected={tab==='notes'} aria-controls="scratch-notes-panel" onClick={()=>setTab('notes')} className={'rounded-md px-3 py-2 text-sm font-medium '+(tab==='notes'?'bg-white text-emerald-800 shadow-sm':'text-slate-500')}>Ghi chú tự do</button></div>
  {tab==='analysis'?<div id="scratch-analysis-panel" role="tabpanel" aria-labelledby="scratch-analysis-tab" className="flex min-h-0 flex-1 flex-col"><SentenceAnalysis quote={selection.quote} annotations={annotations} groups={groups} onChange={updateAnnotations} onGroupsChange={updateGroups}/></div>:<div id="scratch-notes-panel" role="tabpanel" aria-labelledby="scratch-notes-tab" className="scratchpad-paper flex min-h-0 flex-1 flex-col"><GrammarTextEditor value={html} onChange={update} label="Nội dung giấy nháp" editorId="scratchpad-content"/></div>}
  <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t pt-3"><p role={status==='error'?'alert':'status'} className={'text-xs '+(status==='error'?'text-red-600':'text-slate-500')}>{status==='error'?'Chưa lưu được trên trình duyệt. Hãy sao chép nội dung trước khi đóng.':status==='saved'?'Đã lưu trên trình duyệt này · Chọn lại cùng câu để mở tiếp.':'Bản nháp mới · Tự lưu trên trình duyệt này khi chỉnh sửa.'}</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={()=>void copy()}><Copy size={15}/>Sao chép</Button><Button type="button" onClick={onClose}>Đóng</Button></div></div></DialogContent></Dialog>
}
