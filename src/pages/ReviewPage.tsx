import LinkedCardDialog from '../lib/LinkedCardDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import NoteEditor from '../lib/NoteEditor'
import type { Note } from '../lib/cards'
import AIVocabularyCard from '../lib/AIVocabularyCard'
import { Switch } from '@/components/ui/switch'
import { studyCard } from '../lib/study-direction'
import { reviewShortcut } from '../lib/review-shortcuts'
import { useSettings } from '../lib/settings'
import { useAddVocabulary } from '../lib/AddVocabularyDialog'
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Fragment, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, Brain, Clock, Maximize, Minimize, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '../lib/db'
import { generateCards, noteLabels } from '../lib/cards'
import { filterNotesByFolder, folderPath } from '../lib/folders'
import { formatInterval, isDue, isLearning, nextReview, reviewGrades, type Grade } from '../lib/review'
import { saveReview } from '../lib/review-storage'
import CardHtml from '../lib/CardHtml'
import SpeakButton from '../lib/SpeakButton'

type Session = { ids: string[]; total: number; attempts: number; directions: Record<string, boolean> }
export default function ReviewPage() {
  const [params] = useSearchParams()
  const folderId = params.get('folder') ?? 'all'
  return <ReviewContent key={folderId} folderId={folderId} />
}
function ReviewContent({ folderId }: { folderId: string }) {
  const studyRoot = useRef<HTMLElement>(null)
  const [focusMode, setFocusMode] = useState(false)
  useEffect(() => {
    const root = studyRoot.current
    const change = () => setFocusMode(document.fullscreenElement === root)
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !document.fullscreenElement && !document.querySelector('[role="dialog"], [role="alertdialog"]')) setFocusMode(false) }
    let focusTimer: ReturnType<typeof setTimeout> | undefined
    const restoreKeyboard = () => {
      focusTimer = setTimeout(() => {
        if (document.activeElement instanceof HTMLIFrameElement && root?.contains(document.activeElement) && !document.querySelector('[role="dialog"], [role="alertdialog"]')) root.focus({ preventScroll: true })
      }, 0)
    }
    window.addEventListener('blur', restoreKeyboard)
    document.addEventListener('fullscreenchange', change)
    window.addEventListener('keydown', escape)
    return () => {
      clearTimeout(focusTimer)
      window.removeEventListener('blur', restoreKeyboard)
      document.removeEventListener('fullscreenchange', change)
      window.removeEventListener('keydown', escape)
      if (root && document.fullscreenElement === root) void document.exitFullscreen().catch(() => {})
    }
  }, [])
  useEffect(() => {
    if (!focusMode) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [focusMode])
  async function toggleFullscreen() {
    if (focusMode) {
      if (document.fullscreenElement === studyRoot.current) await document.exitFullscreen().catch(() => {})
      setFocusMode(false)
    } else {
      setFocusMode(true)
      try { await studyRoot.current?.requestFullscreen?.() } catch { /* Keep focus layout when browser fullscreen is unavailable. */ }
    }
  }
  async function openVocabulary() {
    if (document.fullscreenElement === studyRoot.current) await document.exitFullscreen().catch(() => {})
    setFocusMode(false)
    addVocabulary(folderId)
  }
  const autoVoice = useSettings(state => state.autoVoice)
  const addVocabulary = useAddVocabulary()
  const folders = useLiveQuery(() => db.folders.toArray())
  const notes = useLiveQuery(() => db.notes.orderBy('createdAt').toArray())
  const saved = useLiveQuery(() => db.reviews.toArray())
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  const [session, setSession] = useState<Session | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [editingBusy, setEditingBusy] = useState(false)
  const [editing, setEditing] = useState<{note: Note; cardId: string} | null>(null)
  const [unlockedTurn, setUnlockedTurn] = useState('')
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const records = new Map((saved ?? []).map(record => [record.id, record]))
  const selectedFolder = folders?.find(folder => folder.id === folderId)
  const reversedFor = (noteFolderId?: string) => session ? session.directions[noteFolderId ?? ''] ?? false : folderId === 'all' ? !!folders?.find(folder => folder.id === noteFolderId)?.reverseCards : !!selectedFolder?.reverseCards
  const all = filterNotesByFolder(notes ?? [], folderId, folders).flatMap(note => generateCards(note).map(card => ({ note, card: studyCard(note, card, reversedFor(note.folderId)) })))
  const available = all.filter(item => isDue(records.get(item.card.id), now) || isLearning(records.get(item.card.id)))
  const byId = new Map(all.map(item => [item.card.id, item]))
  const queue = (session?.ids ?? []).flatMap(id => byId.has(id) ? [byId.get(id)!] : [])
  const item = editing ? queue.find(candidate => candidate.card.id === editing.cardId) : queue.find(candidate => isDue(records.get(candidate.card.id), now))
  const reviewTurn = item ? `${item.card.id}:${session?.attempts ?? 0}` : ''
  const hasSeenAnswer = !!item && unlockedTurn === reviewTurn
  function flipCard() {
    if (!item || editing || saving || inFlight.current) return
    setUnlockedTurn(reviewTurn)
    setRevealed(previous => !previous)
  }
  const nextWaiting = queue.map(candidate => records.get(candidate.card.id)?.due.getTime() ?? now).sort((a,b) => a-b)[0]
  const nextUpcoming = all.map(candidate => records.get(candidate.card.id)?.due.getTime()).filter((due): due is number => due !== undefined && due > now).sort((a,b) => a-b)[0]
  const record = item ? records.get(item.card.id) : undefined
  const reversed = item ? reversedFor(item.note.folderId) : false
  const template = item?.note.template
  const speechField = template?.fields.find(field => field.id === template.speech?.fieldId)
  const speechText = speechField ? item?.note.values?.[speechField.name] ?? '' : !template && item?.note.kind !== 'cloze' ? item?.note.front ?? '' : ''
  const path = folderPath(folderId, folders ?? [])
  const loading = !notes || !folders || !saved
  const completed = session ? session.total - queue.length : 0
  async function changeDirection(checked: boolean) {
    if (!selectedFolder || session) return
    try { await db.folders.update(selectedFolder.id, { reverseCards: checked }); setRevealed(false); setUnlockedTurn('') }
    catch { toast.error('Không thể lưu chiều học của bộ thẻ.') }
  }
  function start() { setSession({ ids: available.map(item => item.card.id), total: available.length, attempts: 0, directions: Object.fromEntries((folders ?? []).map(folder => [folder.id, reversedFor(folder.id)])) }); setRevealed(false) }
  async function answer(grade: Grade) {
    if (!hasSeenAnswer || !item || editing || inFlight.current) return
    inFlight.current = true; setSaving(true)
    try {
      const next = await saveReview(item.card.id, item.note.id, grade, record?.revision ?? 0)
      setSession(previous => previous ? { ...previous, ids: [...previous.ids.filter(id => id !== item.card.id), ...(isLearning(next) ? [item.card.id] : [])], attempts: previous.attempts + 1 } : null)
      setRevealed(false); setNow(Date.now())
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Không thể lưu lịch ôn. Vui lòng thử lại.') }
    finally { inFlight.current = false; setSaving(false) }
  }
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const element = event.target instanceof HTMLElement ? event.target : null
      const action = reviewShortcut(event, { hasCard: !!item, hasSeenAnswer, busy: saving || !!editing || inFlight.current, editing: !!element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]'), dialog: !!document.querySelector('[role="dialog"], [role="alertdialog"]') })
      if (action === null) return
      event.preventDefault()
      if (action === 'speak') { studyRoot.current?.querySelector<HTMLButtonElement>('[data-study-speech="true"]:not(:disabled)')?.click() }
      else if (action === 'flip') flipCard()
      else void answer(action)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })
  const fullscreenButton = <button type="button" className="secondary h-10 w-40 shrink-0 whitespace-nowrap" aria-pressed={focusMode} onClick={() => void toggleFullscreen()}>{focusMode ? <Minimize size={17} /> : <Maximize size={17} />}{focusMode ? 'Thu nhỏ (Esc)' : 'Toàn màn hình'}</button>
  return <main ref={studyRoot} tabIndex={-1} data-focus-mode={focusMode ? 'true' : undefined} className={focusMode ? 'fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[#f6f8f7] px-4 py-20 sm:px-10' : 'mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8'}>
    <div className={focusMode ? 'mx-auto my-auto w-full max-w-5xl shrink-0' : ''}>
    {focusMode && !session && <div className="fixed right-4 top-4 z-50 sm:right-8">{fullscreenButton}</div>}
    <Breadcrumb aria-label="Đường dẫn ôn tập" className={focusMode ? 'hidden' : 'mb-4'}><BreadcrumbList><BreadcrumbItem><BreadcrumbLink render={<Link to="/folders" />}>Bộ thẻ</BreadcrumbLink></BreadcrumbItem>{path.map(folder => <Fragment key={folder.id}><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbLink render={<Link to={`/review?folder=${encodeURIComponent(folder.id)}`} />}>{folder.name}</BreadcrumbLink></BreadcrumbItem></Fragment>)}<BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>Ôn tập</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
    <div className={focusMode || session ? 'sr-only' : 'flex flex-wrap items-center justify-between gap-4'}><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Ôn tập từ vựng</h1>{!focusMode && !session && fullscreenButton}</div>
    {selectedFolder && !focusMode && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4"><div><label htmlFor="reverse-study" className="mb-1">Đảo mặt trước/sau</label><p className="text-xs text-slate-500">{selectedFolder.reverseCards ? 'Học từ nghĩa → từ vựng' : 'Học theo chiều ban đầu'}{session ? ' · Kết thúc phiên để đổi chiều học.' : ''}</p></div><Switch id="reverse-study" checked={session ? session.directions[selectedFolder.id] ?? false : !!selectedFolder.reverseCards} disabled={!!session} onCheckedChange={checked => void changeDirection(checked)} /></div>}
    {loading ? <p role="status" className="mt-8 text-slate-500">Đang tải thẻ và lịch ôn…</p> : !session ? <section className="panel mt-8 p-8 text-center sm:p-12"><Brain size={40} className="mx-auto text-emerald-700" /><h2 className="mt-5 text-2xl font-bold">{available.length ? `${available.length} thẻ cần học` : all.length ? 'Đã ôn xong các thẻ đến hạn' : 'Thêm từ đầu tiên của bạn'}</h2><p className="mt-3 text-slate-500">{available.length ? 'Gồm thẻ mới, thẻ đến hạn và thẻ đang học lại.' : nextUpcoming ? `Lịch tiếp theo: ${new Date(nextUpcoming).toLocaleString('vi-VN')}` : 'Tạo và lưu từ vựng trước khi bắt đầu ôn tập.'}</p>{available.length ? <button type="button" className="primary mx-auto mt-7" onClick={start}>Bắt đầu ôn tập <ArrowRight size={18} /></button> : <button type="button" onClick={() => void openVocabulary()} className="primary mx-auto mt-7">Thêm từ vựng <ArrowRight size={18} /></button>}</section> : !queue.length ? <section className="panel mt-8 p-10 text-center" aria-live="polite"><Check size={40} className="mx-auto text-emerald-700" /><h2 className="mt-4 text-2xl font-bold">Hoàn thành phiên ôn tập!</h2><p className="mt-3 text-slate-500">Đã hoàn thành {completed} thẻ sau {session.attempts} lượt trả lời. Lịch tiếp theo đã được lưu.</p><button type="button" className="secondary mx-auto mt-6" onClick={() => { setSession(null); setRevealed(false) }}>Xem lịch ôn</button></section> : <section data-review-active={item ? 'true' : undefined} className={focusMode ? 'space-y-4' : 'mt-6 space-y-4'}>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-slate-500">Hoàn thành <strong className="text-emerald-700">{completed}/{session.total}</strong> thẻ · {session.attempts} lượt trả lời</span><div className="flex flex-wrap items-center gap-2">{fullscreenButton}<button type="button" disabled={saving || !!editing} className="secondary h-10 w-40 shrink-0 whitespace-nowrap" onClick={() => { setSession(null); setRevealed(false) }}>Kết thúc phiên</button></div></div>
      <progress className="block h-1.5 w-full appearance-none overflow-hidden rounded-full border-0 bg-slate-200 accent-emerald-600 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-emerald-600 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-emerald-600" max={session.total || 1} value={completed} aria-label="Tiến độ ôn tập" />
      {!item ? <div className="panel p-10 text-center"><Clock size={32} className="mx-auto text-emerald-700" /><h2 className="mt-4 text-xl font-semibold">Chờ lượt ôn tiếp theo</h2><p className="mt-3 text-slate-500">{queue.length} thẻ đang học lại. Thẻ tiếp theo sau {formatInterval(new Date(nextWaiting), now)}.</p><p className="mt-2 text-xs text-slate-400">Thẻ tự xuất hiện khi đến hạn. Bạn có thể kết thúc phiên và quay lại sau.</p></div> : <article className="panel overflow-hidden"><div className="flex justify-between border-b border-slate-100 px-6 py-4 text-xs text-slate-500"><span>{template?.name ?? noteLabels[item.note.kind]}</span><div className="flex items-center gap-3"><span>{reversed ? 'ĐẢO CHIỀU · ' : ''}{revealed ? 'ĐÁP ÁN' : 'MẶT TRƯỚC'}</span><button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40" disabled={saving || !!editing} onClick={() => setEditing({note: item.note, cardId: item.card.id})}><Pencil size={15}/>Chỉnh sửa</button></div></div>
        <div aria-live="polite" key={`${item.card.id}-${session.attempts}`}>
          {item.note.kind === 'ai' ? <AIVocabularyCard note={item.note} revealed={revealed} reversed={reversed} autoVoice={autoVoice}/> : template?.format === 'html' ? <div className="p-4"><CardHtml template={template} content={revealed ? item.card.back : item.card.front} title={revealed ? 'Đáp án ôn tập' : 'Câu hỏi ôn tập'} /></div> : <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center" style={template ? { textAlign: template.align, color: template.color, fontSize: template.fontSize } : undefined}><p className="w-full whitespace-pre-wrap break-words text-3xl font-semibold">{item.card.front}</p>{revealed && <p className="mt-7 w-full whitespace-pre-wrap break-words border-t border-slate-200 pt-7 text-xl text-emerald-800">{item.card.back}</p>}</div>}
          {revealed && item.card.extra && <p className="whitespace-pre-wrap break-words px-8 pb-6 text-sm leading-7 text-slate-500">{item.card.extra}</p>}
          {item.note.kind !== 'ai' && speechText.trim() && (!reversed || revealed) && <div className="px-6 pb-5"><SpeakButton studyShortcut text={speechText} lang={template?.speech?.lang} rate={template?.speech?.rate} autoPlay={autoVoice} /></div>}
        </div>
        <div className="border-t border-slate-100 bg-slate-50 p-5">{!hasSeenAnswer ? <button type="button" aria-keyshortcuts="Space" className="primary w-full" onClick={flipCard}>Hiện đáp án <kbd className="ml-2 rounded border border-white/40 px-1.5 text-xs">Space</kbd></button> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{reviewGrades.map(({ grade, label, color }) => <button key={grade} type="button" aria-keyshortcuts={String(grade)} disabled={saving} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${color}`} onClick={() => void answer(grade)}><kbd className="mr-2 rounded border border-current/20 px-1.5 text-xs">{grade}</kbd>{label}<span className="mt-1 block text-xs font-normal">{formatInterval(nextReview(record, grade, new Date(now)).card.due, now)}</span></button>)}</div>}</div>
      </article>}
      <p className="text-center text-xs leading-6 text-slate-500">Phím tắt: 1 Quên · 2 Khó · 3 Tốt · 4 Dễ (sau lần lật đầu tiên). Space để lật qua lại hai mặt. S để nghe phát âm. Esc thoát toàn màn hình.</p>
    </section>}

    </div>
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !editingBusy) setEditing(null) }}><DialogContent portalContainer={studyRoot} showCloseButton={!editingBusy} className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-3xl"><DialogHeader className="border-b px-6 py-5 pr-12"><DialogTitle>Chỉnh sửa từ vựng</DialogTitle><DialogDescription>Lưu nội dung và tiếp tục học. Lịch ôn hiện tại được giữ nguyên.</DialogDescription></DialogHeader>{editing && <NoteEditor key={editing.note.id} note={editing.note} onBusy={setEditingBusy} onClose={saved => { setEditing(null); if (saved) { setRevealed(false); setUnlockedTurn('') } }}/>}</DialogContent></Dialog>
    <LinkedCardDialog portalContainer={studyRoot}/>
  </main>
}
