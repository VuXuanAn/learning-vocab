import { useEffect, useRef, useState } from 'react'
import { Languages, LoaderCircle, Pencil, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { translationChunks } from './reading-translation'
import { editReadingTranslation, saveReadingTranslation } from './reading-storage'
import type { ReadingArticle } from './reading-types'

export default function ReadingTranslation({article,onSync}:{article:ReadingArticle;onSync:()=>Promise<void>}){
 const [progress,setProgress]=useState(''),[error,setError]=useState('')
 const [draft,setDraft]=useState<string|null>(null),[saving,setSaving]=useState(false)
 const editingArticle=useRef<ReadingArticle|null>(null)
 const abort=useRef<AbortController|null>(null)
 useEffect(()=>()=>abort.current?.abort(),[article.id,article.contentHtml])
 async function translate(){
  if(abort.current)return
  const controller=new AbortController();abort.current=controller;setError('')
  try{
   const chunks=translationChunks(article.contentHtml),translated:string[]=[]
   if(!chunks.length)throw new Error('Bài đọc chưa có nội dung để dịch.')
   for(let index=0;index<chunks.length;index++){
    setProgress(`Đang dịch ${index+1}/${chunks.length}…`)
    const send=()=>fetch('/api/ai/translate-reading',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:chunks[index]}),signal:controller.signal})
    let response=await send()
    if(response.status===429&&response.headers.has('Retry-After')){
     const seconds=Math.min(60,Math.max(1,Number(response.headers.get('Retry-After'))||60))
     setProgress(`Đang chờ giới hạn AI, tiếp tục phần ${index+1}/${chunks.length} sau ${seconds} giây…`)
     await new Promise<void>((resolve,reject)=>{
      const cancel=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'))}
      const timer=setTimeout(()=>{controller.signal.removeEventListener('abort',cancel);resolve()},seconds*1000)
      if(controller.signal.aborted)cancel();else controller.signal.addEventListener('abort',cancel,{once:true})
     })
     response=await send()
    }
    const payload=await response.json().catch(()=>null)
    if(!response.ok)throw new Error(payload?.error??'Không kết nối được dịch vụ dịch AI.')
    if(typeof payload?.translation!=='string'||!payload.translation.trim())throw new Error('AI trả về bản dịch trống. Hãy thử lại.')
    translated.push(payload.translation.trim())
   }
   if(controller.signal.aborted)return
   await saveReadingTranslation(article.id,article.ownerId,article.contentHtml,translated.join('\n\n'))
   setProgress('Đang lưu Supabase…')
   try{await onSync();if(!controller.signal.aborted)toast.success('Đã dịch toàn bài và lưu bản dịch lên Supabase.')}
   catch{if(!controller.signal.aborted)toast.warning('Bản dịch đã lưu trên máy, đang chờ đồng bộ Supabase. Bấm Làm mới để thử lại.')}
  }catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Không dịch được bài đọc.')}
  finally{if(abort.current===controller){abort.current=null;setProgress('')}}
 }
 async function saveEdit(){
  if(draft===null||!editingArticle.current||saving)return
  setSaving(true);setError('')
  try{
   await editReadingTranslation(editingArticle.current,draft)
   setDraft(null);editingArticle.current=null
   try{await onSync();toast.success('Đã lưu bản dịch lên Supabase.')}
   catch{toast.warning('Bản dịch đã lưu trên máy, đang chờ đồng bộ Supabase. Bấm Làm mới để thử lại.')}
  }catch(error){setError(error instanceof Error?error.message:'Không lưu được bản dịch.')}
  finally{setSaving(false)}
 }
 return <section data-reading-pane="translation" className="panel flex min-h-0 min-w-0 flex-col overflow-hidden">
  <div className="reading-pane-header"><h3 className="font-semibold">Dịch</h3><div className="flex shrink-0 items-center gap-2">
   {draft===null?<>{article.translation&&<Button size="sm" variant="outline" disabled={!!progress||saving} onClick={()=>{editingArticle.current=article;setDraft(article.translation!.text);setError('')}}><Pencil size={15}/>Chỉnh sửa</Button>}<Button size="sm" disabled={!!progress||saving} onClick={()=>void translate()}>{progress?<LoaderCircle size={15} className="animate-spin"/>:<Languages size={15}/>}Dịch bằng AI</Button></>:<><Button size="sm" variant="outline" disabled={saving} onClick={()=>{setDraft(null);editingArticle.current=null;setError('')}}>Hủy</Button><Button size="sm" disabled={saving||!draft.trim()} onClick={()=>void saveEdit()}>{saving?<LoaderCircle size={15} className="animate-spin"/>:<Save size={15}/>}Lưu</Button></>}
  </div></div>
  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-5" tabIndex={draft===null?0:undefined} aria-label="Bản dịch tiếng Việt">
   {progress&&<p role="status" className="mb-3 text-sm text-emerald-700">{progress}</p>}
   {error&&<p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
   {draft!==null?<textarea aria-label="Chỉnh sửa bản dịch" autoFocus disabled={saving} maxLength={1000000} className="min-h-40 flex-1 resize-none whitespace-pre-wrap leading-8" value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Nhập bản dịch; nhấn Enter để xuống dòng…"/>:article.translation?<p className="whitespace-pre-wrap break-words leading-8 text-slate-600" lang="vi">{article.translation.text}</p>:<p className="text-sm leading-7 text-slate-400">Bấm Dịch bằng AI để dịch toàn bộ bài đọc sang tiếng Việt và tự động lưu bản dịch.</p>}
  </div>
  <p className="reading-pane-footer text-xs text-slate-400">{draft!==null?'Nhấn Enter để xuống dòng. Bấm Lưu để lưu nội dung và cách ngắt đoạn.':article.translation?<>{new Date(article.translation.createdAt).toLocaleString('vi-VN')} · {article.metadataSynced?'Đã lưu Supabase':'Đã lưu trên máy · Chờ đồng bộ'}</>:'Bản dịch sẽ được tự động lưu sau khi dịch xong.'}</p>
 </section>
}
