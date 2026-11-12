import { grammarEntryHtml } from './grammar-html'
import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Highlighter, LoaderCircle, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import StyledSelect from '@/components/ui/styled-select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { db } from './db'
import { grammarTokens, grammarPattern, grammarKeywordIndices, type GrammarSource } from './reading-grammar'
import { grammarFolderPath } from './grammar-folders'
import { saveGrammarEntry, saveGrammarFolder } from './grammar-storage'
import GrammarFields from './GrammarFields'
import type { GrammarEntry } from './grammar-types'
export default function ReadingGrammarDialog({source,ownerId,onClose}:{source:GrammarSource;ownerId:string;onClose:()=>void}){
 const folders=useLiveQuery(()=>db.grammarFolders.where('ownerId').equals(ownerId).sortBy('createdAt'),[ownerId])
 const tokens=grammarTokens(source.quote)
 const [chosen,setChosen]=useState(()=>new Set<number>())
 const [structure,setStructure]=useState(''),[manual,setManual]=useState(false)
 const [folderId,setFolderId]=useState(''),[folderName,setFolderName]=useState('')
 const [draft,setDraft]=useState<GrammarEntry>(()=>{const now=new Date().toISOString();return {id:crypto.randomUUID(),ownerId,folderId:'',title:'',topic:'',structure:'',usage:'',example:source.quote,translation:'',notes:'',createdAt:now,updatedAt:now}})
 const [generating,setGenerating]=useState(false)
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 function choose(next:Set<number>){setChosen(next);if(!manual)setStructure(grammarPattern(source.quote,next).slice(0,5000))}
 async function createFolder(){
  if(!folderName.trim())return;setBusy(true);setError('')
  try{const now=new Date().toISOString(),saved=await saveGrammarFolder({id:crypto.randomUUID(),ownerId,name:folderName,nameKey:'',createdAt:now,updatedAt:now});setFolderId(saved.id);setFolderName('')}
  catch(error){setError(error instanceof Error?error.message:'Không tạo được thư mục.')}
  finally{setBusy(false)}
 }
 async function save(event:FormEvent){
  event.preventDefault();if(generating||!chosen.size||!structure.trim())return;setBusy(true);setError('')
  try{
   const now=new Date().toISOString()
   await saveGrammarEntry({...draft,contentHtml:grammarEntryHtml(draft),structure,folderId:folderId||folders?.[0]?.id||'',updatedAt:now,source:{...source,highlights:tokens.filter((_,index)=>chosen.has(index)).map(token=>({start:source.start+token.start,end:source.start+token.end}))}})
   toast.success('Đã lưu ngữ pháp và phần tô vàng trong bài đọc.');onClose()
  }catch(error){setError(error instanceof Error?error.message:'Không lưu được ngữ pháp.')}
  finally{setBusy(false)}
 }
 let cursor=0
 const preview=tokens.map((token,index)=>{const gap=source.quote.slice(cursor,token.start);cursor=token.end;return <span key={index}>{gap}<button type="button" aria-pressed={chosen.has(index)} aria-label={(chosen.has(index)?'Bỏ tô vàng ':'Tô vàng ')+token.text} onClick={()=>{const next=new Set(chosen);if(next.has(index))next.delete(index);else next.add(index);choose(next)}} className={'rounded px-0.5 py-1 font-medium transition focus-visible:outline-2 focus-visible:outline-amber-600 '+(chosen.has(index)?'bg-yellow-200 text-slate-900':'text-slate-500 hover:bg-slate-100')}>{token.text}</button></span>})
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose()}}><DialogContent showCloseButton={!busy} className="grammar-dialog flex h-[94dvh] max-h-[94dvh] flex-col overflow-hidden w-[calc(100vw-2rem)] sm:max-w-6xl"><DialogHeader className="shrink-0 pr-8"><DialogTitle>Thêm ngữ pháp từ bài đọc</DialogTitle><DialogDescription>Chỉ chọn các từ thuộc cấu trúc ngữ pháp để tô vàng, bỏ qua phần chen giữa. Các từ ở giữa có thể giữ nguyên, ví dụ “freed … from”.</DialogDescription></DialogHeader><form className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden" onSubmit={event=>void save(event)}><div className="flex min-h-0 flex-1 flex-col overflow-hidden"><fieldset disabled={busy} className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden"><details id="grammar-reading-setup" className="grammar-reading-setup relative shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer truncate text-sm font-medium">Thiết lập tô vàng · {chosen.size}/{tokens.length} từ{structure?' · '+structure:''}</summary><div className="grammar-reading-setup-popover space-y-4"><section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><Highlighter size={16} className="text-amber-600"/>Chọn từ để tô vàng</h3><div className="flex gap-2"><Button type="button" size="xs" variant="ghost" onClick={()=>choose(new Set(tokens.map((_,index)=>index)))}>Chọn tất cả</Button><Button type="button" size="xs" variant="ghost" onClick={()=>choose(new Set())}>Bỏ chọn</Button></div></div><div className="whitespace-pre-wrap break-words rounded-xl border border-amber-200 bg-amber-50/30 p-4 text-sm leading-8">{preview}{source.quote.slice(cursor)}</div><p className="text-xs text-slate-500">Bấm từng từ để bật/tắt màu vàng. Đã chọn {chosen.size}/{tokens.length} từ.</p></section><div className="space-y-2"><Label htmlFor="reading-grammar-pattern">Cấu trúc ngữ pháp *</Label><Input id="reading-grammar-pattern" required maxLength={5000} value={structure} onChange={event=>{setManual(true);setStructure(event.target.value);setChosen(grammarKeywordIndices(source.quote,event.target.value))}} placeholder="free … from"/><p className="text-xs text-slate-500">Nhập “free … from” để tự chọn “freed” và “from”. Bạn vẫn có thể bấm từng từ để điều chỉnh.</p></div><Button type="button" variant="outline" size="sm" onClick={event=>{const details=event.currentTarget.closest('details');if(details)details.open=false}}>Xong thiết lập</Button></div></details><GrammarFields folderControl={<div className="space-y-2"><Label htmlFor="reading-grammar-folder">Thư mục Grammar *</Label><StyledSelect id="reading-grammar-folder" required value={folderId||folders?.[0]?.id||''} onChange={event=>setFolderId(event.target.value)}>{!folders?.length&&<option value="">Tạo thư mục bên dưới để lưu</option>}{folders?.map(folder=><option key={folder.id} value={folder.id}>{grammarFolderPath(folder.id,folders).map(item=>item.name).join(' / ')}</option>)}</StyledSelect><div className="flex gap-2"><Input aria-label="Tên thư mục Grammar mới" maxLength={100} placeholder="Tên thư mục mới…" value={folderName} onChange={event=>setFolderName(event.target.value)}/><Button type="button" variant="outline" disabled={!folderName.trim()||busy} onClick={()=>void createFolder()}><Plus size={15}/>Tạo</Button></div></div>} onGenerating={setGenerating} disabled={busy} value={draft} onChange={setDraft}/></fieldset></div>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex shrink-0 flex-wrap justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" disabled={busy||generating||!chosen.size||!structure.trim()||!folders?.length}>{busy?<LoaderCircle size={15} className="animate-spin"/>:<Highlighter size={15}/>}Lưu và tô vàng</Button></div></form></DialogContent></Dialog>
}
