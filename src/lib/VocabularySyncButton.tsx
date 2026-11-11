import { useState } from 'react'
import { ArrowDownUp, ChevronDown, CloudDownload, CloudUpload, History, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useVocabularySyncState } from './vocabulary-sync-state'
import type { RowSyncMode } from './row-sync'
const modes = [
  { mode: 'upload', label: 'Tải lên Supabase', icon: CloudUpload, description: 'Gửi từ vựng và lịch ôn trên máy lên tài khoản. Giữ dữ liệu đang có trên máy và dữ liệu khác đã có trên server.' },
  { mode: 'download', label: 'Tải từ Supabase về máy', icon: CloudDownload, description: 'Thay thư viện trên máy bằng dữ liệu server. Bản local trước khi tải được giữ để khôi phục.' },
  { mode: 'merge', label: 'Đồng bộ hai chiều', icon: ArrowDownUp, description: 'Gửi thay đổi trên máy và nhận thay đổi từ server. Các trường khác nhau được hợp nhất.' },
] as const
export default function VocabularySyncButton() {
  const { status, pending, ready, firstSync, lastSyncAt, canRestore, sync, restore } = useVocabularySyncState()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<RowSyncMode | 'restore'>('upload')
  const [restoring, setRestoring] = useState(false)
  if (!ready) return null
  const busy = status.phase === 'syncing' || restoring
  const statusLabel = busy ? 'Đang đồng bộ' : status.phase === 'error' ? 'Đồng bộ chưa thành công' : pending ? 'Có thay đổi chưa gửi' : status.phase === 'saved' ? 'Đã đồng bộ' : 'Dữ liệu lưu trên máy'
  const syncTitle = 'Đồng bộ thủ công · ' + statusLabel + (lastSyncAt ? ' · Lần gần nhất: ' + new Date(lastSyncAt).toLocaleString('vi-VN') : '')
  function choose(next: RowSyncMode | 'restore') { setMode(next); setOpen(true) }
  async function confirm() {
    if (mode !== 'restore') { setOpen(false); sync(mode); return }
    setRestoring(true)
    try { await restore(); setOpen(false); toast.success('Đã khôi phục dữ liệu local. Bấm Đồng bộ để gửi lên server.') }
    catch { toast.error('Không thể khôi phục dữ liệu local.') }
    finally { setRestoring(false) }
  }
  return <><div className="flex shrink-0 items-center rounded-full border border-slate-200/80 bg-slate-50/70">
    <Button type="button" variant="ghost" className="h-9 gap-2 rounded-l-full rounded-r-none px-2.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:pl-3.5" disabled={busy} onClick={() => sync('merge')} title={syncTitle} aria-label={'Đồng bộ: ' + statusLabel}>
      <span className="relative flex items-center">{busy ? <LoaderCircle size={16} className="animate-spin"/> : <ArrowDownUp size={16}/>}
        {!busy && (pending || status.phase === 'error') && <span aria-hidden="true" className={`absolute -right-1 -top-1 size-2 rounded-full ring-2 ring-white ${status.phase === 'error' ? 'bg-red-500' : 'bg-amber-500'}`}/>}
      </span>
      <span className="hidden text-xs font-medium lg:inline">Đồng bộ</span>
    </Button>
    <DropdownMenu><DropdownMenuTrigger disabled={busy} aria-label="Tùy chọn đồng bộ" title="Tùy chọn đồng bộ" render={<Button type="button" variant="ghost" size="icon" className="h-9 w-6 rounded-l-none rounded-r-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"/>}><ChevronDown size={12}/></DropdownMenuTrigger><DropdownMenuContent align="end" sideOffset={10} className="w-64 rounded-xl p-1.5">
      <div className="px-3 py-2"><p className="text-xs font-medium text-slate-700">{statusLabel}</p>{lastSyncAt && <p className="mt-1 text-xs text-slate-400">{new Date(lastSyncAt).toLocaleString('vi-VN')}</p>}</div><DropdownMenuSeparator/>
      {modes.map(item => <DropdownMenuItem className="gap-2.5 rounded-lg px-3 py-2.5" key={item.mode} onClick={() => choose(item.mode)}><item.icon size={16}/>{item.label}</DropdownMenuItem>)}
      {canRestore && <><DropdownMenuSeparator/><DropdownMenuItem className="gap-2.5 rounded-lg px-3 py-2.5" onClick={() => choose('restore')}><History size={16}/>Khôi phục bản local trước đó</DropdownMenuItem></>}
    </DropdownMenuContent></DropdownMenu>
    <span role="status" className="sr-only">{statusLabel}</span>
  </div><Dialog open={open} onOpenChange={value => { if (!restoring) setOpen(value) }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{mode === 'restore' ? 'Khôi phục dữ liệu trên máy' : firstSync ? 'Đồng bộ lần đầu' : 'Chọn cách đồng bộ'}</DialogTitle><DialogDescription>{mode === 'restore' ? 'Thay dữ liệu local hiện tại bằng bản được giữ trước khi tải cloud hoặc import gần nhất. Bấm Đồng bộ sau khi khôi phục để gửi thay đổi lên Supabase.' : 'Thay đổi được lưu trên thiết bị. Chỉ gửi và nhận dữ liệu khi bạn bấm Đồng bộ. Chọn cách đồng bộ cho lần này.'}</DialogDescription></DialogHeader>
    {mode !== 'restore' && <div role="radiogroup" aria-label="Hướng đồng bộ" className="space-y-3">{modes.map(item => <label key={item.mode} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${mode === item.mode ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}><input type="radio" name="sync-mode" value={item.mode} checked={mode === item.mode} onChange={() => setMode(item.mode)} className="mt-1"/><span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-sm font-normal leading-6 text-slate-500">{item.description}</span></span></label>)}</div>}
    <DialogFooter><Button type="button" variant="outline" disabled={restoring} onClick={() => setOpen(false)}>Hủy</Button><Button type="button" disabled={busy} onClick={() => void confirm()}>{mode === 'restore' ? 'Khôi phục local' : modes.find(item => item.mode === mode)?.label}</Button></DialogFooter>
  </DialogContent></Dialog></>
}
