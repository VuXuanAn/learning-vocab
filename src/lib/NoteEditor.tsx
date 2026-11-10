import { useState, type FormEvent } from 'react'
import { Save, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Note } from './cards'
import { aiTemplate } from './ai-batch'
import { saveNoteEdits } from './note-edit'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
export default function NoteEditor({ note, onClose, onBusy }: { note: Note; onClose: (saved: boolean) => void; onBusy?: (busy: boolean) => void }) {
  const [draft, setDraft] = useState<Note>(() => ({ ...note, values: { ...note.values } }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fields = note.kind === 'ai' ? aiTemplate.fields : note.template?.fields
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return
    setBusy(true); onBusy?.(true); setError('')
    try { await saveNoteEdits(note, draft); toast.success('Đã cập nhật từ vựng.'); onClose(true) }
    catch (error) { setError(error instanceof Error ? error.message : 'Không thể lưu thay đổi.') }
    finally { setBusy(false); onBusy?.(false) }
  }
  return <form onSubmit={event => void save(event)} className="space-y-5 p-6" aria-label="Chỉnh sửa từ vựng"><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">{fields ? fields.map((field, index) => <div key={field.id} className="space-y-2"><Label htmlFor={'edit-' + field.id}>{field.name}{field.required ? ' *' : ''}</Label><textarea id={'edit-' + field.id} autoFocus={index === 0} required={field.required} rows={3} value={draft.values?.[field.name] ?? ''} onChange={event => setDraft(previous => ({ ...previous, values: { ...previous.values, [field.name]: event.target.value } }))}/></div>) : ['front', 'back'].map((field, index) => <div key={field} className="space-y-2"><Label htmlFor={'edit-' + field}>{index === 0 ? 'Mặt trước *' : 'Mặt sau'}</Label><textarea id={'edit-' + field} autoFocus={index === 0} required={index === 0 || note.kind !== 'cloze'} rows={4} value={draft[field as 'front' | 'back']} onChange={event => setDraft(previous => ({ ...previous, [field]: event.target.value }))}/></div>)}<div className="space-y-2"><Label htmlFor="edit-extra">Ghi chú</Label><textarea id="edit-extra" rows={2} value={draft.extra} onChange={event => setDraft(previous => ({ ...previous, extra: event.target.value }))}/></div><div className="space-y-2"><Label htmlFor="edit-tags">Nhãn</Label><textarea id="edit-tags" rows={2} value={draft.tags} onChange={event => setDraft(previous => ({ ...previous, tags: event.target.value }))}/></div></fieldset>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-3 border-t pt-4"><Button type="button" variant="outline" disabled={busy} onClick={() => onClose(false)}>Hủy</Button><Button type="submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="animate-spin"/> : <Save size={16}/>}Lưu thay đổi</Button></div></form>
}
