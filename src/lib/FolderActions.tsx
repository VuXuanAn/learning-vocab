import { useNavigate } from 'react-router-dom'
import { useAddVocabulary } from './AddVocabularyDialog'
import { db } from './db'
import { useState } from 'react'
import { FolderPlus, Pencil, Settings2, Trash2, List } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu'
import FolderDialog from './FolderDialog'
import { deleteEmptyFolder } from './folder-storage'
import type { VocabularyFolder } from './folders'

export default function FolderActions({ folder, onCreated }: { folder?: VocabularyFolder; onCreated?: () => void }) {
  const addVocabulary = useAddVocabulary()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<'create' | 'rename' | null>(null)
  const [busy, setBusy] = useState(false)
  async function reverse(checked: boolean) {
    if (!folder || busy) return
    setBusy(true)
    try { await db.folders.update(folder.id, { reverseCards: checked }); toast.success(checked ? 'Đã bật đảo mặt cho bộ thẻ.' : 'Đã về chiều học ban đầu.') }
    catch { toast.error('Không thể lưu chiều học.') }
    finally { setBusy(false) }
  }
  async function remove() {
    if (!folder || busy) return
    setBusy(true)
    try {
      await deleteEmptyFolder(folder.id)
      toast.success('Đã xóa thư mục. Thư mục con được giữ lại.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Không thể xóa thư mục.') }
    finally { setBusy(false) }
  }
  return <>
    <DropdownMenu><DropdownMenuTrigger disabled={busy} aria-label={folder ? `Thao tác với ${folder.name}` : 'Thao tác bộ thẻ'} render={<Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg" />}><Settings2 size={16} /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuItem onClick={() => navigate('/cards?folder=' + encodeURIComponent(folder?.id ?? 'all'))}><List size={16}/>Quản lý thẻ</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem onClick={() => setDialog('create')}><FolderPlus size={16} />{folder ? 'Tạo thư mục con' : 'Tạo thư mục gốc'}</DropdownMenuItem>{folder && <><DropdownMenuItem onClick={() => addVocabulary(folder.id)}><FolderPlus size={16} />Thêm từ vựng</DropdownMenuItem><DropdownMenuItem onClick={() => setDialog('rename')}><Pencil size={16} />Đổi tên</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuCheckboxItem checked={!!folder.reverseCards} onCheckedChange={checked => void reverse(checked)}>Đảo mặt trước/sau</DropdownMenuCheckboxItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={() => void remove()}><Trash2 size={16} />Xóa thư mục</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>
    {dialog && <FolderDialog key={`${dialog}-${folder?.id ?? 'root'}`} open onOpenChange={open => { if (!open) setDialog(null) }} folder={dialog === 'rename' ? folder : undefined} defaultParentId={folder?.id} onSaved={() => { if (dialog === 'create') onCreated?.() }} />}
  </>
}
