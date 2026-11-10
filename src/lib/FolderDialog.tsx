import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { db } from './db'
import type { VocabularyFolder } from './folders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function FolderDialog({ open, onOpenChange, folder, defaultParentId = '', onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; folder?: VocabularyFolder; defaultParentId?: string; onSaved: (id: string) => void }) {
  const folders = useLiveQuery(() => db.folders.orderBy('createdAt').toArray())
  const [name, setName] = useState(folder?.name ?? '')
  const [parentId, setParentId] = useState(folder?.parentId ?? defaultParentId)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Hãy nhập tên thư mục.'); return }
    setBusy(true); setError('')
    try {
      const id = folder?.id ?? crypto.randomUUID()
      const nameKey = trimmed.toLocaleLowerCase('vi')
      if (folder) await db.folders.update(id, { name: trimmed, nameKey })
      else await db.transaction('rw', db.folders, async () => {
        if (parentId && !await db.folders.get(parentId)) throw new Error('missing-parent')
        await db.folders.add({ id, name: trimmed, nameKey, parentId, createdAt: Date.now() })
      })
      onSaved(id); onOpenChange(false); toast.success(folder ? 'Đã đổi tên thư mục.' : 'Đã tạo thư mục.')
    } catch (cause) { setError(cause instanceof Error && cause.name === 'ConstraintError' ? 'Tên thư mục đã tồn tại. Hãy chọn tên khác.' : 'Không thể lưu thư mục. Vui lòng thử lại.') }
    finally { setBusy(false) }
  }
  return <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next) }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{folder ? 'Đổi tên thư mục' : 'Tạo thư mục mới'}</DialogTitle><DialogDescription>{folder ? 'Cập nhật tên để dễ tìm bộ thẻ của bạn.' : 'Sắp xếp từ vựng theo chủ đề hoặc mục tiêu học tập.'}</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-5"><div className="space-y-2"><Label htmlFor="dialog-folder-name">Tên thư mục <span className="text-red-600">*</span></Label><Input id="dialog-folder-name" autoFocus maxLength={80} disabled={busy} value={name} aria-invalid={!!error} aria-describedby={error ? 'folder-error' : undefined} onChange={event => { setName(event.target.value); setError('') }} placeholder="Ví dụ: TOEIC, Du lịch, B1…" /></div><div className="space-y-2"><Label htmlFor="dialog-folder-parent">Thư mục cha</Label><Select value={parentId || 'root'} disabled={busy || !!folder} onValueChange={value => setParentId(!value || value === 'root' ? '' : value)}><SelectTrigger id="dialog-folder-parent" className="w-full"><SelectValue>{parentId ? folders?.find(item => item.id === parentId)?.name ?? 'Thư mục cha' : 'Không có — thư mục gốc'}</SelectValue></SelectTrigger><SelectContent><SelectItem value="root">Không có — thư mục gốc</SelectItem>{folders?.filter(item => item.id !== folder?.id).map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>{error && <p id="folder-error" role="alert" className="text-sm text-red-600">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Hủy</Button><Button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : folder ? 'Lưu thay đổi' : 'Tạo thư mục'}</Button></DialogFooter></form></DialogContent></Dialog>
}

