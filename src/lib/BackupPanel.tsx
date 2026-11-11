import StyledSelect from '@/components/ui/styled-select'
﻿import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Upload, LoaderCircle, FileJson } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { db, getActiveUserId } from './db'
import { noteLabels } from './cards'
import { folderPath } from './folders'
import { parseBackup, backupCounts, type VocabularyBackup } from './backup-format'
import { BACKUP_MAX_BYTES, exportBackup, downloadBackup, importBackup } from './backup-storage'
import { useVocabularySyncState } from './vocabulary-sync-state'
export default function BackupPanel() {
 const folders=useLiveQuery(()=>db.folders.orderBy('createdAt').toArray())
 const syncing=useVocabularySyncState(state=>state.status.phase==='syncing')
 const fileInput=useRef<HTMLInputElement>(null)
 const [scope,setScope]=useState('all')
 const [preview,setPreview]=useState<VocabularyBackup|null>(null)
 const [filename,setFilename]=useState('')
 const [progress,setProgress]=useState(true)
 const [preferences,setPreferences]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const disabled=busy||syncing
 const counts=preview?backupCounts(preview):null
 async function exportFile(){
  setBusy(true);setError('')
  try{downloadBackup(await exportBackup(scope));toast.success('Đã xuất file backup JSON.')}
  catch(error){setError(error instanceof Error?error.message:'Không thể xuất dữ liệu.')}
  finally{setBusy(false)}
 }
 async function readFile(file:File){
  setBusy(true);setError('');setPreview(null);setFilename(file.name)
  try{
   if(file.size>BACKUP_MAX_BYTES)throw new Error('File tối đa 25 MB. Hãy nhập từng thư mục riêng.')
   setPreview(parseBackup(JSON.parse((await file.text()).replace(/^\uFEFF/,''))))
  }catch(error){setError(error instanceof SyntaxError?'File JSON không hợp lệ.':(error as {name?:string})?.name==='ZodError'?'File thiếu trường hoặc sai định dạng backup. Hãy dùng file JSON xuất từ ứng dụng.':error instanceof Error?error.message:'Không đọc được file.')}
  finally{setBusy(false)}
 }
 async function confirmImport(){
  if(!preview||disabled)return
  setBusy(true);setError('')
  try{
   const userId=getActiveUserId()
   if(!userId)throw new Error('Hãy đăng nhập trước khi nhập dữ liệu.')
   const run=()=>importBackup(preview,{progress,preferences})
   const result=navigator.locks?await navigator.locks.request('vocab-rows-'+userId,run):await run()
   setPreview(null);setFilename('');toast.success('Đã nhập '+result.notes+' từ vựng vào thư mục mới. Dữ liệu sẽ tự đồng bộ lên Supabase.')
  }catch(error){setError(error instanceof Error?error.message:'Không nhập được dữ liệu. Dữ liệu cũ được giữ nguyên.')}
  finally{setBusy(false)}
 }
 return <section className="panel mt-6 space-y-5 p-6"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><FileJson size={20} className="text-emerald-700"/>Import / Export dữ liệu</h2><p className="mt-2 text-sm leading-6 text-slate-500">Backup JSON giữ nguyên thẻ cơ bản, đảo chiều, cloze, AI và tùy chỉnh HTML/CSS, cùng folder, liên kết từ và lịch ôn.</p></div>
 <div className="flex flex-wrap items-center gap-3"><StyledSelect aria-label="Phạm vi xuất backup" disabled={disabled} className="min-w-52 flex-1" value={scope} onChange={event=>setScope(event.target.value)}><option value="all">Xuất toàn bộ thư viện</option>{folders?.map(folder=><option key={folder.id} value={folder.id}>{folderPath(folder.id,folders).map(part=>part.name).join(' / ')} (gồm thư mục con)</option>)}</StyledSelect><Button type="button" variant="outline" disabled={disabled||!folders} onClick={()=>void exportFile()}><Download size={16}/>Export JSON</Button><Button type="button" disabled={disabled} onClick={()=>fileInput.current?.click()}>{busy?<LoaderCircle size={16} className="animate-spin"/>:<Upload size={16}/>}Import JSON</Button><input ref={fileInput} className="hidden" type="file" accept=".json,application/json" aria-label="Chọn file backup JSON" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void readFile(file)}}/></div>
 {syncing&&<p className="text-xs text-slate-500">Đợi đồng bộ hoàn tất trước khi import/export.</p>}
 {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
 {preview&&counts&&<div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"><div><p className="break-all text-sm font-semibold">{filename}</p><p className="mt-2 text-sm text-slate-600">{counts.folders} folder · {counts.notes} từ vựng · {counts.cards} thẻ · {counts.reviews} lịch ôn · {counts.logs} lượt trả lời</p><div className="mt-3 flex flex-wrap gap-2">{Object.entries(counts.kinds).filter(([,count])=>count>0).map(([kind,count])=><span key={kind} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs">{noteLabels[kind as keyof typeof noteLabels]}: {count}</span>)}</div></div>
 <p className="text-sm leading-6 text-slate-600">Nhập thành bản sao trong thư mục mới. Không ghi đè thẻ hiện có; nhập cùng file lần nữa sẽ tạo thêm bản sao. Giữ bản khôi phục dữ liệu trước khi nhập trên trình duyệt.</p>
 <div className="flex items-center justify-between gap-3"><label className="mb-0 text-sm" htmlFor="backup-progress">Giữ lịch ôn và lịch sử trả lời</label><Switch id="backup-progress" disabled={disabled} checked={progress} onCheckedChange={setProgress}/></div>
 {preview.preferences&&<div className="flex items-center justify-between gap-3"><label className="mb-0 text-sm" htmlFor="backup-preferences">Áp dụng cài đặt từ file</label><Switch id="backup-preferences" disabled={disabled} checked={preferences} onCheckedChange={setPreferences}/></div>}
 <div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={disabled} onClick={()=>{setPreview(null);setFilename('')}}>Hủy</Button><Button type="button" disabled={disabled} onClick={()=>void confirmImport()}>{busy&&<LoaderCircle size={16} className="animate-spin"/>}Xác nhận import</Button></div></div>}
 <p className="text-xs leading-6 text-slate-400">File tối đa 25 MB. File backup chứa dữ liệu trên thiết bị hiện tại; nếu muốn lấy bản mới nhất từ Supabase, hãy đồng bộ trước khi export. Nội dung hình/âm thanh từ URL vẫn phụ thuộc nguồn bên ngoài.</p>
 </section>
}
