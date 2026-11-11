import { reviewCounts } from '../lib/review'
import { useAddVocabulary } from '../lib/AddVocabularyDialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import FolderActions from '../lib/FolderActions'
import FolderDialog from '../lib/FolderDialog'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronRight, FolderPlus, Plus } from 'lucide-react'
import { db } from '../lib/db'
import { generateCards } from '../lib/cards'
import { filterNotesByFolder, folderRows } from '../lib/folders'

export default function HomePage() {
  const addVocabulary = useAddVocabulary()
  const [addingFolder, setAddingFolder] = useState(false)
  const folders = useLiveQuery(() => db.folders.orderBy('createdAt').toArray())
  const notes = useLiveQuery(() => db.notes.toArray())
  const saved = useLiveQuery(() => db.reviews.toArray())
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer) }, [])
  const records = new Map((saved ?? []).map(record => [record.id, record]))
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const stats = (id: string) => reviewCounts(filterNotesByFolder(notes ?? [], id, folders).flatMap(note => generateCards(note).map(card => card.id)), records, now)
  const count = (id: string) => stats(id).new
  const rows = folderRows(folders ?? [], collapsed)
  function toggle(id: string) { setCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  return <main className="workspace-page vocab-folders-page gap-4 px-4 py-5 sm:px-6">
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">THƯ VIỆN CÁ NHÂN</p><h1 className="mt-2 text-3xl font-bold">Bộ thẻ</h1><p className="mt-2 text-sm text-slate-500">Chọn một thư mục để bắt đầu ôn tập.</p></div><Button type="button" onClick={() => setAddingFolder(true)}><FolderPlus size={17} />Thêm folder</Button></div>
    <section className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Danh sách bộ thẻ">
      <div className="min-w-full"><Table className="w-full min-w-96 border-collapse text-sm"><TableHeader className="sticky top-0 z-10 bg-white"><TableRow className="border-b border-slate-200 text-left"><TableHead className="px-5 py-4 font-semibold">Bộ thẻ</TableHead><TableHead className="w-16 px-2 py-4 text-center">Mới</TableHead><TableHead className="w-16 px-2 py-4 text-center">Học</TableHead><TableHead className="w-20 whitespace-nowrap px-2 py-4 text-center">Đến hạn</TableHead><TableHead className="w-12 px-2"><FolderActions /></TableHead></TableRow></TableHeader><TableBody>
        {!folders || !notes || !saved ? <TableRow><TableCell colSpan={5} className="p-8 text-center text-slate-500">Đang tải bộ thẻ…</TableCell></TableRow> : <>
          {rows.map(({ folder, depth, hasChildren }) => <TableRow key={folder.id} className="group hover:bg-slate-100"><TableCell className="py-2.5 pr-2" style={{ paddingLeft: 16 + depth * 22 }}><div className="flex items-center gap-1"><button type="button" className={`shrink-0 rounded p-1 text-slate-400 hover:text-emerald-700 ${hasChildren ? '' : 'invisible'}`} disabled={!hasChildren} aria-label={`${collapsed.has(folder.id) ? 'Mở' : 'Thu gọn'} ${folder.name}`} aria-expanded={hasChildren ? !collapsed.has(folder.id) : undefined} onClick={() => toggle(folder.id)}>{collapsed.has(folder.id) ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button><Link className="break-words py-1 font-medium text-slate-800 hover:text-emerald-700 hover:underline" to={`/review?folder=${encodeURIComponent(folder.id)}`}>{folder.name}</Link></div></TableCell><TableCell className={`px-2 text-center tabular-nums ${count(folder.id) ? 'text-blue-600' : 'text-slate-400'}`}>{count(folder.id)}</TableCell><TableCell className="px-2 text-center tabular-nums text-amber-600">{stats(folder.id).learning}</TableCell><TableCell className="px-2 text-center tabular-nums text-emerald-600">{stats(folder.id).due}</TableCell><TableCell className="px-2"><FolderActions folder={folder} onCreated={() => setCollapsed(previous => { const next = new Set(previous); next.delete(folder.id); return next })} /></TableCell></TableRow>)}

          <TableRow className="border-t border-slate-200 bg-slate-50 font-semibold"><TableCell className="px-5 py-4">Tổng cộng</TableCell><TableCell className="text-center text-blue-600">{count('all')}</TableCell><TableCell className="text-center text-amber-600">{stats('all').learning}</TableCell><TableCell className="text-center text-emerald-600">{stats('all').due}</TableCell><TableCell /></TableRow>
        </>}
      </TableBody></Table></div>
      {folders?.length === 0 && <p className="border-t border-slate-100 px-6 py-6 text-center text-sm text-slate-500">Chưa có thư mục. Bấm “Thêm folder” để tạo bộ thẻ đầu tiên.</p>}
    </section>
    <p className="shrink-0 text-xs leading-6 text-slate-500">Số thẻ ở thư mục cha bao gồm các thư mục con. Mới là thẻ chưa học; Học là thẻ đang học hoặc học lại; Đến hạn là thẻ cần ôn theo lịch FSRS.</p>
    <div className="flex shrink-0 flex-wrap justify-center gap-3"><button type="button" onClick={() => addVocabulary()} className="secondary"><Plus size={17} />Thêm từ vựng</button><Link to="/review" className="primary">Ôn tập tất cả</Link></div>
    {addingFolder && <FolderDialog open onOpenChange={setAddingFolder} onSaved={() => setAddingFolder(false)} />}
  </main>
}
