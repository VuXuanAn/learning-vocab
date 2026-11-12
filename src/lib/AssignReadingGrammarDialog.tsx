import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Link2, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { db } from './db'
import { grammarFolderPath } from './grammar-folders'
import { saveGrammarEntry } from './grammar-storage'
import type { GrammarSource } from './reading-grammar'

export default function AssignReadingGrammarDialog({source,ownerId,onClose}:{source:GrammarSource;ownerId:string;onClose:()=>void}){
 const entries=useLiveQuery(()=>db.grammarEntries.where('ownerId').equals(ownerId).sortBy('title'),[ownerId])
 const folders=useLiveQuery(()=>db.grammarFolders.where('ownerId').equals(ownerId).toArray(),[ownerId])
 const [search,setSearch]=useState(''),[selected,setSelected]=useState('')
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const query=search.trim().toLocaleLowerCase('vi')
 const matching=entries?.filter(entry=>[entry.title,entry.structure,entry.topic,grammarFolderPath(entry.folderId,folders??[]).map(folder=>folder.name).join(' / ')].some(value=>value.toLocaleLowerCase('vi').includes(query)))
 async function assign(event:FormEvent){
  event.preventDefault()
  const entry=entries?.find(entry=>entry.id===selected)
  if(!entry||busy)return
  setBusy(true);setError('')
  try{
   const sources=[...(entry.source?[entry.source]:[]),...(entry.sources??[])]
   if(sources.some(saved=>saved.articleId===source.articleId&&saved.contentHtml===source.contentHtml&&saved.start===source.start&&saved.end===source.end)){
    toast.info('Đoạn này đã được gán ngữ pháp đã chọn.');onClose();return
   }
   await saveGrammarEntry({...entry,sources:[...(entry.sources??[]),{...source,exactSelection:true,highlights:[{start:source.start,end:source.end}]}]})
   toast.success('Đã gán ngữ pháp cho đoạn đã chọn.');onClose()
  }catch(error){setError(error instanceof Error?error.message:'Không gán được ngữ pháp.')}
  finally{setBusy(false)}
 }
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose()}}><DialogContent showCloseButton={!busy} className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-2xl"><DialogHeader className="shrink-0 pr-8"><DialogTitle>Gán ngữ pháp</DialogTitle><DialogDescription>Chọn ngữ pháp có sẵn để gán và tô vàng toàn bộ đoạn đã bôi đen.</DialogDescription></DialogHeader><form onSubmit={event=>void assign(event)} className="flex min-h-0 min-w-0 flex-1 flex-col gap-4"><blockquote className="max-h-40 shrink-0 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7">{source.quote}</blockquote><Input aria-label="Tìm ngữ pháp" autoFocus placeholder="Tìm tên, cấu trúc hoặc thư mục…" value={search} onChange={event=>setSearch(event.target.value)} disabled={busy}/><fieldset disabled={busy} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"><legend className="mb-2 text-sm font-medium">Chọn cấu trúc ngữ pháp</legend><div className="grid gap-3">{!entries?<p role="status" className="p-4 text-sm text-slate-500">Đang tải ngữ pháp…</p>:!entries.length?<p className="p-4 text-sm text-slate-500">Chưa có ngữ pháp trong kho. Dùng “Thêm ngữ pháp” để tạo mới hoặc mở <Link to="/grammar" className="text-emerald-700 underline">Grammar</Link>.</p>:!matching?.length?<p className="p-4 text-sm text-slate-500">Không tìm thấy ngữ pháp phù hợp.</p>:matching.map(entry=><label key={entry.id} className={'mb-0 grid min-w-0 cursor-pointer grid-cols-[16px_minmax(0,1fr)] items-start gap-3 rounded-xl border p-3 '+(selected===entry.id?'border-emerald-600 bg-emerald-50':'border-slate-200 hover:bg-slate-50')}><input type="radio" name="assigned-grammar" value={entry.id} checked={selected===entry.id} onChange={()=>setSelected(entry.id)} className="grammar-assignment-radio mt-1"/><span className="min-w-0 space-y-1 [overflow-wrap:anywhere]"><span className="block text-sm font-semibold">{entry.title}</span><span className="block whitespace-pre-wrap text-sm text-slate-600">{entry.structure}</span><span className="block text-xs text-slate-500">{grammarFolderPath(entry.folderId,folders??[]).map(folder=>folder.name).join(' / ')}</span></span></label>)}</div></fieldset>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex shrink-0 justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" disabled={busy||!entries?.some(entry=>entry.id===selected)}>{busy?<LoaderCircle size={16} className="animate-spin"/>:<Link2 size={16}/>}Gán ngữ pháp</Button></div></form></DialogContent></Dialog>
}
