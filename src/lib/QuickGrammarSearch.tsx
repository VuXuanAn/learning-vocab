import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, NotebookPen, ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { db } from './db'
import { useAuth } from './AuthProvider'
import { searchGrammar } from './grammar-search'
import { grammarFolderPath } from './grammar-folders'
import GrammarCardDialog from './GrammarCardDialog'

export default function QuickGrammarSearch() {
 const {session}=useAuth(),ownerId=session?.user.id??''
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0),[selected,setSelected]=useState('')
 const listId=useId(),input=useRef<HTMLInputElement>(null),list=useRef<HTMLDivElement>(null),portal=useRef<HTMLElement|null>(null)
 const data=useLiveQuery(async()=>({entries:await db.grammarEntries.where('ownerId').equals(ownerId).toArray(),folders:await db.grammarFolders.where('ownerId').equals(ownerId).toArray()}),[ownerId])
 const matches=useMemo(()=>searchGrammar(data?.entries??[],query),[data,query])
 const visible=matches.slice(0,50),index=Math.min(active,Math.max(0,visible.length-1))
 useEffect(()=>{
  const handle=(event:KeyboardEvent)=>{
   if(!(event.ctrlKey||event.metaKey)||event.altKey||event.shiftKey||event.isComposing||event.key.toLowerCase()!=='s')return
   event.preventDefault()
   if(event.repeat)return
   portal.current=window.document.fullscreenElement as HTMLElement|null
   setSelected('');setQuery('');setActive(0);setOpen(true)
   input.current?.focus()
  }
  window.addEventListener('keydown',handle)
  return()=>window.removeEventListener('keydown',handle)
 },[])
 useEffect(()=>{list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'})},[index,open])
 function choose(id:string){setOpen(false);setSelected(id)}
 return <>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent portalContainer={portal} showCloseButton={false} className="flex max-h-[75dvh] -translate-y-0 flex-col gap-0 overflow-hidden p-0 top-[12dvh] sm:max-w-2xl">
   <DialogTitle className="sr-only">Tìm nhanh ngữ pháp</DialogTitle><DialogDescription className="sr-only">Nhập tên, công thức hoặc nội dung. Dùng phím lên xuống để chọn, Enter để xem và Escape để đóng.</DialogDescription>
   <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3"><Search size={20} className="shrink-0 text-emerald-700"/><input ref={input} autoFocus role="combobox" aria-label="Tìm nhanh ngữ pháp" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={visible.length?listId+'-'+index:undefined} className="min-w-0 flex-1 border-0 bg-transparent p-1 text-sm outline-none" placeholder="Tìm theo tiêu đề ngữ pháp…" value={query} onChange={event=>{setQuery(event.target.value);setActive(0)}} onKeyDown={event=>{
    if(event.nativeEvent.isComposing)return
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(visible.length)setActive((index+(event.key==='ArrowDown'?1:-1)+visible.length)%visible.length)}
    if(event.key==='Enter'){event.preventDefault();if(visible[index])choose(visible[index].id)}
   }}/><button type="button" onClick={()=>setOpen(false)} aria-label="Đóng tìm kiếm" className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">Esc</button></div>
   <div className="flex shrink-0 justify-between px-4 py-2 text-xs text-slate-500"><span>{query.trim()?'Kết quả tìm kiếm':'Ngữ pháp cập nhật gần đây'}</span><span role="status" aria-live="polite">{matches.length} ngữ pháp</span></div>
   <div ref={list} id={listId} role="listbox" aria-label="Kết quả ngữ pháp" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
    {!data?<p role="status" className="p-8 text-center text-sm text-slate-500">Đang tải ngữ pháp…</p>:!visible.length?<p role="status" className="p-8 text-center text-sm text-slate-500">{query.trim()?'Không tìm thấy ngữ pháp phù hợp.':'Chưa có ngữ pháp trong kho.'}</p>:visible.map((entry,i)=><div key={entry.id} id={listId+'-'+i} role="option" aria-selected={index===i} onMouseMove={()=>setActive(i)} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(entry.id)} className={'flex cursor-pointer gap-3 rounded-lg px-3 py-3 '+(index===i?'bg-emerald-700 text-white':'text-slate-700 hover:bg-slate-50')}>
     <NotebookPen size={18} className="mt-0.5 shrink-0"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{entry.name??entry.title}</p><p className={'mt-1 truncate text-xs '+(index===i?'text-emerald-100':'text-slate-400')}>{grammarFolderPath(entry.folderId,data.folders).map(folder=>folder.name).join(' / ')}{entry.level?' · '+entry.level:''}</p></div>{index===i&&<CornerDownLeft size={16} className="mt-1 shrink-0"/>}
    </div>)}
   </div>
   <div className="flex shrink-0 flex-wrap items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500"><span className="flex items-center gap-1"><ArrowUp size={12}/><ArrowDown size={12}/>Chọn</span><span>Enter · Xem ngữ pháp</span><span>Esc · Đóng</span>{matches.length>50&&<span>Hiển thị 50 kết quả, nhập thêm để thu hẹp.</span>}</div>
  </DialogContent></Dialog>
  {selected&&<GrammarCardDialog id={selected} ownerId={ownerId} portalContainer={portal} onClose={()=>setSelected('')}/>}
 </>
}
