import { useState } from 'react'
import { Check, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { confirmReadingMatches } from './reading-storage'
import type { ReadingArticle, ReadingMatch } from './reading-types'
import type { ReadingSuggestion } from './reading-similarity'
export interface ReadingMatchReviewData {articleId:string;ownerId:string;detection:NonNullable<ReadingArticle['detection']>;suggestions:ReadingSuggestion[]}
export default function ReadingMatchReview({data,onClose,onSync,onConfirm}:{data:ReadingMatchReviewData;onClose:()=>void;onSync:()=>Promise<void>;onConfirm?:(matches:ReadingMatch[])=>Promise<void>}){
 const [choices,setChoices]=useState<Record<number,string>>({}),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const selected=data.suggestions.filter((_,index)=>!!choices[index]).length
 async function save(){
  setBusy(true);setError('')
  try{
   const matches:ReadingMatch[]=data.suggestions.flatMap((row,index)=>{
    const candidate=row.candidates.find(item=>item.noteId===choices[index])
    return candidate?row.occurrences.map(occurrence=>({...occurrence,noteId:candidate.noteId,word:candidate.word,confirmed:true})):[]
   })
   await (onConfirm?onConfirm(matches):confirmReadingMatches(data.articleId,data.ownerId,data.detection,matches))
   onClose()
   try{await onSync();toast.success('Đã lưu các liên kết bạn xác nhận lên Supabase.')}
   catch{toast.warning('Đã lưu xác nhận trên máy, đang chờ đồng bộ Supabase.')}
  }catch(error){setError(error instanceof Error?error.message:'Không lưu được kết quả xác nhận.')}
  finally{setBusy(false)}
 }
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose()}}><DialogContent showCloseButton={!busy} className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-3xl"><DialogHeader className="shrink-0 pr-8"><DialogTitle>Xác nhận từ gần giống</DialogTitle><DialogDescription>Các từ khớp chính xác đã được liên kết và lưu. Chọn thẻ phù hợp cho từng từ bên dưới, hoặc bỏ qua nếu không đúng. Lựa chọn áp dụng cho mọi lần xuất hiện của từ đó trong bài.</DialogDescription></DialogHeader><div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto pr-1">{data.suggestions.map((row,index)=><fieldset key={index} disabled={busy} className="min-w-0 rounded-xl border border-slate-200 p-4"><legend className="max-w-full break-words px-2 font-semibold text-slate-800">{row.word} <span className="text-xs font-normal text-slate-400">· {row.occurrences.length} vị trí</span></legend><p className="mb-3 [overflow-wrap:anywhere] rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-500">…{row.occurrences[0].context}…</p><div className="space-y-2">{row.candidates.map(candidate=><label key={candidate.noteId} className={'mb-0 grid min-w-0 cursor-pointer grid-cols-[16px_minmax(0,1fr)] items-start gap-3 rounded-lg border p-3 '+(choices[index]===candidate.noteId?'border-emerald-400 bg-emerald-50':'border-slate-200')}><input type="radio" name={'reading-match-'+index} value={candidate.noteId} checked={choices[index]===candidate.noteId} onChange={()=>setChoices(previous=>({...previous,[index]:candidate.noteId}))} className="reading-match-radio mt-1"/><span className="min-w-0 [overflow-wrap:anywhere]"><span className="font-semibold text-emerald-800">{candidate.word}</span><span className="ml-2 text-xs text-slate-500">{candidate.reason}</span>{candidate.meaning&&<span className="mt-1 block break-words text-sm text-slate-600">{candidate.meaning}</span>}</span></label>)}<label className="mb-0 grid min-w-0 cursor-pointer grid-cols-[16px_minmax(0,1fr)] items-center gap-3 px-3 py-2 text-sm font-normal text-slate-500"><input type="radio" name={'reading-match-'+index} checked={!choices[index]} onChange={()=>setChoices(previous=>({...previous,[index]:''}))} className="reading-match-radio"/><span>Bỏ qua từ này</span></label></div></fieldset>)}</div>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t pt-4"><span className="text-sm text-slate-500">Đã chọn {selected}/{data.suggestions.length} từ</span><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Bỏ qua phần còn lại</Button><Button disabled={busy||!selected} onClick={()=>void save()}>{busy?<LoaderCircle size={15} className="animate-spin"/>:<Check size={15}/>}Xác nhận và lưu</Button></div></div></DialogContent></Dialog>
}
