import { latestNoteRatings, learningStatusOptions, validLearningFilter } from '../lib/note-learning-status'
import StyledSelect from '@/components/ui/styled-select'
import { groupRelatedNotes } from '../lib/card-groups'
﻿import { Fragment, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Eye, Pencil, Plus, Search, Trash2, ChevronLeft, ChevronRight, ChevronDown, Layers, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { db } from '../lib/db'
import { generateCards, type Note } from '../lib/cards'
import { folderPath } from '../lib/folders'
import { noteWord } from '../lib/related-words'
import { managedNotes, noteMeaning, deleteNote } from '../lib/card-manager'
import { useAddVocabulary } from '../lib/AddVocabularyDialog'
import NoteEditor from '../lib/NoteEditor'
import LinkedCardDialog from '../lib/LinkedCardDialog'

export default function CardManagerPage() {
  const root = useRef<HTMLElement>(null)
  const [params, setParams] = useSearchParams()
  const folderId = params.get('folder') || 'all'
  const learningFilter=validLearningFilter(params.get('rating'))
  const folders = useLiveQuery(() => db.folders.orderBy('createdAt').toArray())
  const notes = useLiveQuery(() => db.notes.orderBy('createdAt').reverse().toArray())
  const reviews=useLiveQuery(()=>db.reviews.toArray())
  const latestRatings=latestNoteRatings(reviews??[])
  const statusFor=(id:string)=>latestRatings.get(id)?.status??'new'
  const statusInfo=(id:string)=>learningStatusOptions.find(option=>option.value===statusFor(id))!
  const addVocabulary = useAddVocabulary()
  const [search, setSearch] = useState('')
  const [includeChildren, setIncludeChildren] = useState(true)
  const [page, setPage] = useState(1)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Note | null>(null)
  const [deleting, setDeleting] = useState<Note | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const folder = folders?.find(row => row.id === folderId)
  const scoped = managedNotes(notes ?? [], folders ?? [], folderId, includeChildren, search)
  const filtered=learningFilter==='all'?scoped:scoped.filter(note=>statusFor(note.id)===learningFilter)
  const statusCounts=new Map(learningStatusOptions.map(option=>[option.value,scoped.filter(note=>statusFor(note.id)===option.value).length]))
  function selectStatus(value:string){setParams(previous=>{const next=new URLSearchParams(previous);if(value==='all')next.delete('rating');else next.set('rating',value);return next});setPage(1)}
  const groups = groupRelatedNotes(notes ?? [], filtered)
  const pageCount = Math.max(1, Math.ceil(groups.length / 20))
  const currentPage = Math.min(page, pageCount)
  const visible = groups.slice((currentPage - 1) * 20, currentPage * 20)
  function toggleGroup(id: string) { setCollapsed(previous => { const next = new Set(previous); if(next.has(id))next.delete(id);else next.add(id);return next }) }
  const loaded = !!notes && !!folders && !!reviews
  const changeFolder = (id: string) => {
    setParams(previous => { const next = new URLSearchParams(previous); next.set('folder', id); next.delete('note'); return next })
    setPage(1)
  }
  function view(note: Note) {
    setParams(previous => { const next = new URLSearchParams(previous); next.set('note', note.id); return next })
  }
  async function remove() {
    if (!deleting || busy) return
    setBusy(true); setDeleteError('')
    try { await deleteNote(deleting.id); setDeleting(null); toast.success('Đã xóa thẻ và lịch ôn liên quan.') }
    catch (error) { setDeleteError(error instanceof Error ? error.message : 'Không thể xóa thẻ.') }
    finally { setBusy(false) }
  }
  return <main ref={root} className="workspace-page card-manager-page gap-4 px-4 py-5 sm:px-6">
    <nav aria-label="Đường dẫn quản lý thẻ" className="flex shrink-0 items-center gap-2 text-sm text-slate-500"><Link to="/folders" className="hover:text-emerald-700">Bộ thẻ</Link><ChevronRight size={14}/><span>Quản lý thẻ</span></nav>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Quản lý thẻ</h1><p className="mt-2 text-sm text-slate-500">{folderId === 'all' ? 'Tất cả thư mục' : folder ? folderPath(folder.id, folders ?? []).map(row => row.name).join(' / ') : 'Thư mục không còn tồn tại'}</p></div><Button type="button" disabled={!loaded || folderId !== 'all' && !folder} onClick={() => addVocabulary(folderId === 'all' ? undefined : folderId)}><Plus size={17}/>Thêm từ vựng</Button></div>
    <section aria-label="Thống kê từ vựng" className="shrink-0"><div className="grid grid-cols-3 gap-2 lg:grid-cols-6"><button type="button" aria-pressed={learningFilter==='all'} onClick={()=>selectStatus('all')} className={'rounded-xl border p-3 text-left transition sm:p-4 '+(learningFilter==='all'?'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600/10':'border-slate-200 bg-white hover:border-emerald-300')}><p className="text-xs font-medium text-slate-500">Tổng số từ</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">{loaded?scoped.length:'—'}</p></button>{learningStatusOptions.map(option=><button type="button" key={option.value} aria-pressed={learningFilter===option.value} onClick={()=>selectStatus(option.value)} className={'rounded-xl border p-3 text-left transition sm:p-4 '+(learningFilter===option.value?'border-emerald-600 ring-1 ring-emerald-600/10 ':'border-transparent hover:border-slate-300 ')+option.color}><p className="text-xs font-medium">{option.label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{loaded?statusCounts.get(option.value):'—'}</p></button>)}</div><p className="mt-2 text-[11px] text-slate-400">Theo thư mục và từ khóa đang chọn. Mỗi từ tính một lần, theo lượt đánh giá gần nhất. Bấm một ô để lọc danh sách.</p></section>
    <section className="panel flex min-h-0 flex-1 flex-col overflow-hidden"><div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-100 p-4"><div className="relative min-w-52 flex-1"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><Input aria-label="Tìm thẻ" className="pl-10" placeholder="Tìm từ vựng, nghĩa hoặc nhãn…" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }}/></div><StyledSelect aria-label="Lọc thư mục" className="w-full sm:w-64" value={folderId} onChange={event => changeFolder(event.target.value)}><option value="all">Tất cả thư mục</option>{folders?.map(row => <option key={row.id} value={row.id}>{folderPath(row.id, folders).map(part => part.name).join(' / ')}</option>)}</StyledSelect><StyledSelect aria-label="Lọc trạng thái học" className="w-full sm:w-52" value={learningFilter} onChange={event=>selectStatus(event.target.value)}><option value="all">Tất cả trạng thái ({scoped.length})</option>{learningStatusOptions.map(option=><option key={option.value} value={option.value}>{option.label} ({statusCounts.get(option.value)})</option>)}</StyledSelect>{folderId !== 'all' && <div className="flex items-center gap-2"><Switch id="include-subfolders" checked={includeChildren} onCheckedChange={value => {setIncludeChildren(value);setPage(1)}}/><label htmlFor="include-subfolders" className="mb-0 text-xs font-normal">Gồm thư mục con</label></div>}</div>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain"><Table><TableHeader className="sticky top-0 z-10 bg-white"><TableRow><TableHead className="pl-5">Từ vựng</TableHead><TableHead>Nghĩa</TableHead><TableHead>Thư mục</TableHead><TableHead>Trạng thái gần nhất</TableHead><TableHead className="text-center">Số thẻ</TableHead><TableHead className="pr-5 text-right">Thao tác</TableHead></TableRow></TableHeader><TableBody>{!loaded ? <TableRow><TableCell colSpan={6} className="p-10 text-center text-slate-500">Đang tải thẻ…</TableCell></TableRow> : !visible.length ? <TableRow><TableCell colSpan={5} className="p-10 text-center text-slate-500">{search ? 'Không tìm thấy thẻ phù hợp.' : 'Chưa có thẻ trong thư mục này.'}</TableCell></TableRow> : visible.map(group => <Fragment key={group.id}>{group.total > 1 && <TableRow className="bg-emerald-50/60 hover:bg-emerald-50"><TableCell colSpan={5} className="px-5 py-2.5"><button type="button" className="flex w-full items-center gap-2 text-left text-sm text-emerald-800" aria-expanded={!!search || !collapsed.has(group.id)} onClick={() => toggleGroup(group.id)}>{!search && collapsed.has(group.id) ? <ChevronRight size={15}/> : <ChevronDown size={15}/>}<Layers size={15}/><span className="font-semibold">Nhóm: {group.label}</span><span className="rounded-full bg-white px-2 py-0.5 text-xs text-emerald-700">{group.notes.length === group.total ? group.total : group.notes.length + '/' + group.total} từ</span></button></TableCell></TableRow>}{(group.total === 1 || !!search || !collapsed.has(group.id)) && group.notes.map(note => <TableRow key={note.id}><TableCell className={group.total > 1 ? "max-w-64 whitespace-normal py-4 pl-12" : "max-w-64 whitespace-normal py-4 pl-5"}><button type="button" className="break-words text-left font-semibold text-emerald-700 hover:underline" onClick={() => view(note)}>{noteWord(note) || note.front}</button>{note.values?.['Phiên âm IPA'] && <p className="mt-1 text-xs text-slate-400">{note.values['Phiên âm IPA']}</p>}</TableCell><TableCell className="max-w-80 whitespace-normal"><p className="line-clamp-3 break-words text-sm text-slate-600">{noteMeaning(note) || '—'}</p></TableCell><TableCell className="max-w-48 whitespace-normal text-xs text-slate-500">{folders?.find(folder => folder.id === note.folderId)?.name || '—'}</TableCell><TableCell><span title={latestRatings.has(note.id)?'Đánh giá lúc '+new Date(latestRatings.get(note.id)!.at).toLocaleString('vi-VN'):'Chưa có lượt đánh giá'} className={'inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium '+statusInfo(note.id).color}>{statusInfo(note.id).label}</span></TableCell><TableCell className="text-center text-xs text-slate-500">{generateCards(note).length}</TableCell><TableCell className="pr-5"><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="icon" title="Xem thẻ" aria-label={'Xem ' + (noteWord(note) || 'thẻ')} onClick={() => view(note)}><Eye size={16}/></Button><Button type="button" variant="ghost" size="icon" title="Sửa thẻ" aria-label={'Sửa ' + (noteWord(note) || 'thẻ')} disabled={note.readOnly} onClick={() => setEditing(note)}><Pencil size={16}/></Button><Button type="button" variant="ghost" size="icon" className="text-red-600 hover:bg-red-50" title="Xóa thẻ" aria-label={'Xóa ' + (noteWord(note) || 'thẻ')} disabled={note.readOnly} onClick={() => {setDeleting(note);setDeleteError('')}}><Trash2 size={16}/></Button></div></TableCell></TableRow>)}</Fragment>)}</TableBody></Table></div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-500"><span title="Nếu một từ có nhiều thẻ, trạng thái lấy từ lượt đánh giá gần nhất trong các thẻ đó.">{filtered.length} từ vựng · {filtered.reduce((sum,note) => sum + generateCards(note).length, 0)} thẻ</span><div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" aria-label="Trang trước" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16}/></Button><span className="text-xs">{currentPage} / {pageCount}</span><Button type="button" variant="outline" size="icon" aria-label="Trang sau" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16}/></Button></div></div>
    </section>
    <LinkedCardDialog portalContainer={root}/>
    <Dialog open={!!editing} onOpenChange={open => {if(!open && !busy)setEditing(null)}}><DialogContent showCloseButton={!busy} className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-3xl"><DialogHeader className="border-b px-6 py-5 pr-12"><DialogTitle>Chỉnh sửa từ vựng</DialogTitle><DialogDescription>Lưu nội dung, giữ nguyên lịch ôn.</DialogDescription></DialogHeader>{editing && <NoteEditor key={editing.id} note={editing} onBusy={setBusy} onClose={() => setEditing(null)}/>}</DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={open => {if(!open && !busy)setDeleting(null)}}><DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>Xóa thẻ?</DialogTitle><DialogDescription>Xóa “{deleting ? noteWord(deleting) || deleting.front : ''}” cùng toàn bộ thẻ, lịch ôn và lịch sử trả lời của từ này. Thao tác này không thể hoàn tác trong ứng dụng.</DialogDescription></DialogHeader>{deleteError && <p role="alert" className="text-sm text-red-600">{deleteError}</p>}<div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Hủy</Button><Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}>{busy ? <LoaderCircle size={16} className="animate-spin"/> : <Trash2 size={16}/>}Xóa thẻ</Button></div></DialogContent></Dialog>
  </main>
}
