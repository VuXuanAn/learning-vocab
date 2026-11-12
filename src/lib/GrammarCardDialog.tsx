import type { RefObject } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { db } from './db'

export default function GrammarCardDialog({id,ownerId,onClose,portalContainer}:{id:string;ownerId:string;onClose:()=>void;portalContainer:RefObject<HTMLElement|null>}){
 const record=useLiveQuery(async()=>{
  const entry=await db.grammarEntries.get(id)
  return {entry:entry?.ownerId===ownerId?entry:undefined}
 },[id,ownerId])
 const entry=record?.entry
 return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent portalContainer={portalContainer} className="flex max-h-[90dvh] flex-col overflow-hidden p-0 sm:max-w-3xl"><DialogHeader className="shrink-0 border-b px-6 py-5 pr-12"><DialogTitle>{entry?.title??'Thẻ ngữ pháp'}</DialogTitle><DialogDescription>Xem cấu trúc, cách dùng và ví dụ đã lưu.</DialogDescription></DialogHeader>{!record?<p role="status" className="p-8 text-center text-slate-500">Đang mở thẻ ngữ pháp…</p>:!entry?<p role="status" className="p-8 text-center text-slate-500">Ngữ pháp không còn tồn tại trên thiết bị này.</p>:<article aria-label="Thẻ ngữ pháp" className="min-h-0 space-y-6 overflow-y-auto overscroll-contain p-6"><section><h2 className="mb-3 text-sm font-semibold text-emerald-700">Cấu trúc</h2><pre className="whitespace-pre-wrap break-words rounded-xl border border-emerald-100 bg-emerald-50/50 p-5 font-mono text-sm leading-7 text-emerald-950">{entry.structure}</pre></section><section><h2 className="mb-3 font-semibold">Cách dùng</h2><p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{entry.usage||'Chưa thêm cách dùng.'}</p></section><section><h2 className="mb-3 font-semibold">Ví dụ</h2><div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-5"><p lang="en" className="whitespace-pre-wrap break-words leading-7 text-slate-800">{entry.example||'Chưa thêm ví dụ.'}</p>{entry.translation&&<p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-500">{entry.translation}</p>}</div></section><section><h2 className="mb-3 font-semibold">Ghi nhớ</h2><p className="whitespace-pre-wrap break-words border-l-2 border-amber-300 pl-4 text-sm leading-7 text-slate-600">{entry.notes||'Chưa thêm ghi nhớ.'}</p></section></article>}</DialogContent></Dialog>
}
