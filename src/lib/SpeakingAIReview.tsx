import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { db } from './db'
import { supabase } from './supabase'
import { useAuth } from './AuthProvider'
import { aiSpeakingReviewSchema, audioBase64, audioMime, storedSpeakingReview, speakingScores10, speakingOverall10 } from './speaking-review'
import type { SpeakingRecording } from './speaking'
export default function SpeakingAIReview({recording,loadAudio,disabled,onBusy}:{recording:SpeakingRecording;loadAudio:()=>Promise<Blob>;disabled:boolean;onBusy:(busy:boolean)=>void}){
 const {session}=useAuth()
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const controller=useRef<AbortController|null>(null)
 useEffect(()=>()=>controller.current?.abort(),[])
 async function review(){
  if(busy||disabled)return
  if(!recording.referenceText.trim()){setError('Bản ghi này chưa có đoạn văn gốc để đối chiếu. Hãy mở bài học và ghi lại với đoạn văn.');return}
  const account=db,abort=new AbortController();controller.current=abort;setBusy(true);onBusy(true);setError('')
  const timer=window.setTimeout(()=>abort.abort(),90000)
  try{
   const blob=await loadAudio()
   if(abort.signal.aborted)return
   const data=await audioBase64(blob)
   const response=await fetch('/api/ai/review-speaking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({referenceText:recording.referenceText,audio:{mimeType:audioMime(blob.type||recording.mimeType),data}}),signal:abort.signal})
   if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Backend chưa hỗ trợ review. Hãy khởi động lại backend.')
   const payload=await response.json()
   if(!response.ok)throw new Error(payload.error||'Không review được bản ghi.')
   const report=aiSpeakingReviewSchema.parse({...payload,referenceText:recording.referenceText})
   if(abort.signal.aborted)return
   const current=await account.speakingRecordings.get(recording.id)??recording
   await account.speakingRecordings.put({...current,aiReview:report,metadataSynced:false})
   if(recording.driveFileId&&recording.metadataSynced&&supabase&&session){
    const {data:saved,error}=await supabase.from('speaking_recordings').update({ai_review:report}).eq('id',recording.id).eq('user_id',session.user.id).select('id').maybeSingle()
    if(error||!saved)setError(error&&['42703','PGRST204'].includes(error.code)?'Review đã lưu trên máy. Chạy migration 009_speaking_ai_review.sql rồi bấm Lưu lịch sử để gửi lên Supabase.':'Review đã lưu trên máy; chưa gửi lên cloud. Kiểm tra mạng/quyền tài khoản rồi bấm Lưu lịch sử để thử lại.')
    else await account.speakingRecordings.update(recording.id,{metadataSynced:true})
   }
  }catch(error){if(!abort.signal.aborted)setError((error as {name?:string})?.name==='ZodError'?'Kết quả AI chưa hợp lệ. Chưa ghi đè review cũ.':error instanceof Error?error.message:'Không review được bản ghi.');else setError('Đã dừng chờ hoặc hết thời gian review. Bản ghi vẫn được giữ.')}finally{window.clearTimeout(timer);setBusy(false);onBusy(false);controller.current=null}
 }
 const report=storedSpeakingReview(recording.aiReview)
 const result=report?.review
 const scores=report?speakingScores10(report):null
 const overall=report?speakingOverall10(report):null
 return <div className="mt-4 space-y-3 border-t border-slate-100 pt-4"><div className="flex flex-wrap items-center gap-3"><Button type="button" size="sm" variant="outline" disabled={disabled||busy} onClick={()=>void review()}>{busy?<LoaderCircle size={15} className="animate-spin"/>:<Sparkles size={15}/>} {busy?'Đang nghe và review…':report?'AI review lại':'AI review'}</Button>{busy&&<Button type="button" size="sm" variant="ghost" onClick={()=>controller.current?.abort()}>Dừng chờ</Button>}<p className="text-xs text-slate-400">Bấm để gửi bản ghi và đoạn văn cho Gemini. Điểm là nhận xét tham khảo.</p></div>{error&&<p role="alert" className="text-xs leading-6 text-amber-700">{error}</p>}{result&&<div className="space-y-4 rounded-xl bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-emerald-800">AI review{overall!==null&&<span className="ml-3 rounded-full bg-emerald-100 px-3 py-1">Tổng điểm: {overall}/10</span>}</h4><span className="text-[11px] text-slate-400">{new Date(report.createdAt).toLocaleString('vi-VN')} · {report.model}</span></div><div><h5 className="mb-1 text-sm font-medium">Nhận xét</h5><p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{result.summary}</p></div>{result.evaluable&&<div className="grid grid-cols-3 gap-2">{[['pronunciation','Phát âm'],['fluency','Trôi chảy'],['completeness','Đọc đầy đủ']].map(([key,label])=><div key={key} className="rounded-lg bg-white p-3 text-center"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-emerald-800">{scores?.[key as keyof typeof scores]??'—'}<span className="text-xs font-normal text-slate-400"> /10</span></p></div>)}</div>}{result.issues.length>0&&<div className="space-y-2"><h5 className="text-sm font-medium">Những điểm cần cải thiện</h5>{result.issues.map((issue,index)=><div key={index} className="rounded-lg border border-slate-200 bg-white p-3 text-sm"><p className="font-medium text-slate-700">{issue.expected||'Phần đọc thêm'}{issue.timestampSeconds!==null&&<span className="ml-2 text-xs text-slate-400">~{issue.timestampSeconds}s</span>}</p>{issue.heard&&<p className="mt-1 text-xs text-slate-400">AI nghe: {issue.heard}</p>}<p className="mt-1 leading-6 text-slate-600">{issue.feedback}</p></div>)}</div>}{result.practiceTips.length>0&&<div><h5 className="mb-2 text-sm font-medium">Gợi ý luyện tập</h5><ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-600">{result.practiceTips.map((tip,index)=><li key={index}>{tip}</li>)}</ul></div>}{result.transcript&&<details className="text-sm text-slate-500"><summary className="cursor-pointer">Nội dung AI nghe được</summary><p className="mt-2 whitespace-pre-wrap leading-7">{result.transcript}</p></details>}{result.warnings.map((warning,index)=><p key={index} className="text-xs leading-6 text-amber-700">{warning}</p>)}<p className="text-[11px] leading-6 text-slate-400">Tổng điểm là trung bình các tiêu chí chấm được, theo thang 10. Điểm AI không phải thang chấm phát âm chuẩn hóa. Bài này chưa có audio mẫu để so sánh trực tiếp ngữ điệu.</p></div>}</div>
}
