import GrammarContent from './GrammarContent'
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
 return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent portalContainer={portalContainer} className="flex max-h-[90dvh] flex-col overflow-hidden p-0 sm:max-w-3xl"><DialogHeader className="shrink-0 border-b px-6 py-5 pr-12"><DialogTitle>{entry?.title??'Thẻ ngữ pháp'}</DialogTitle><DialogDescription>Xem cấu trúc, cách dùng và ví dụ đã lưu.</DialogDescription></DialogHeader>{!record?<p role="status" className="p-8 text-center text-slate-500">Đang mở thẻ ngữ pháp…</p>:!entry?<p role="status" className="p-8 text-center text-slate-500">Ngữ pháp không còn tồn tại trên thiết bị này.</p>:<article aria-label="Thẻ ngữ pháp" className="min-h-0 space-y-6 overflow-y-auto overscroll-contain p-6"><GrammarContent entry={entry}/></article>}</DialogContent></Dialog>
}
