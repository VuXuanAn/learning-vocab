import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardList, List, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { db } from './db'
import { fillCachedWords } from './vocabulary-cache'
export default function VocabularyCacheControls({words,onChange,disabled}:{words:string[];onChange:(words:string[])=>void;disabled:boolean}){
 const cached=useLiveQuery(()=>db.vocabularyCache.orderBy('createdAt').toArray())??[]
 const [open,setOpen]=useState(false),[error,setError]=useState('')
 function fill(){
  const result=fillCachedWords(words,cached)
  onChange(result.words)
  if(result.added)toast.success('Đã thêm '+result.added+' từ từ cache. Phần dư vẫn được giữ cho lần sau.')
  else toast.info(words.length>=20?'Danh sách đã đủ 20 từ.':'Các từ trong cache đã có trong danh sách.')
 }
 async function remove(key:string){try{await db.vocabularyCache.delete(key);setError('')}catch{setError('Không xóa được từ khỏi cache.')}}
 return <><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={disabled||!cached.length||words.length>=20} onClick={fill}><ClipboardList size={15}/>Điền từ cache{cached.length?' ('+cached.length+')':''}</Button><Button type="button" size="icon" variant="ghost" aria-label="Xem danh sách cache" title="Danh sách cache" disabled={disabled} onClick={()=>setOpen(true)}><List size={16}/></Button></div><Dialog open={open} onOpenChange={setOpen}><DialogContent className="flex max-h-[80dvh] flex-col overflow-hidden sm:max-w-xl"><DialogHeader><DialogTitle>Cache từ vựng ({cached.length})</DialogTitle><DialogDescription>Từ được gom khi bôi đen nội dung, lưu riêng theo tài khoản trên thiết bị này. Mỗi lần điền tối đa 20 từ; chỉ bỏ khỏi cache sau khi lưu từ vựng thành công.</DialogDescription></DialogHeader><div className="min-h-0 overflow-y-auto"><ul className="flex flex-wrap gap-2">{cached.map(entry=><li key={entry.key} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><span className="min-w-0 break-words">{entry.text}</span><button type="button" aria-label={'Bỏ '+entry.text+' khỏi cache'} className="shrink-0 rounded p-1 hover:bg-emerald-100" onClick={()=>void remove(entry.key)}><X size={14}/></button></li>)}</ul>{!cached.length&&<p className="py-6 text-center text-sm text-slate-400">Bôi đen từ hoặc cụm từ và chọn “Thêm vào cache” để gom từ.</p>}</div>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Đóng</Button><Button type="button" disabled={disabled||!cached.length||words.length>=20} onClick={()=>{fill();setOpen(false)}}>Điền vào danh sách</Button></div></DialogContent></Dialog></>
}
