import VocabularyCacheControls from './VocabularyCacheControls'
import { removeCachedWords } from './vocabulary-cache'
import WordTagInput from './WordTagInput'
import VocabularyFooter from './VocabularyFooter'
import { saveNotesToFolder } from './folder-storage'
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sparkles, LoaderCircle, Trash2, Check, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { aiTemplate, rowToNote, hasWordFamily, needsSpellingReview, type SpellingCheck, type BatchRow } from './ai-batch'
import { generateCards } from './cards'
import { db } from './db'

export default function BatchAIGenerator({ folderId, onBusy, initialWords=[] }: { folderId: string; initialWords?: string[]; onBusy: (busy: boolean) => void }) {
  const folders = useLiveQuery(() => db.folders.toArray())
  const template = aiTemplate
  const sourceField = aiTemplate.fields[0].id
  const [inputVersion, setInputVersion] = useState(0)
  useEffect(() => {
    if (!inputVersion) return
    const frame = requestAnimationFrame(() => {
      const input = document.getElementById('batch-words')
      input?.scrollIntoView({ block: 'nearest' })
      input?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [inputVersion])
  const [words, setWords] = useState<string[]>(()=>initialWords.slice(0,20))
  const [tags, setTags] = useState('')
  const [rows, setRows] = useState<BatchRow[]>([])
  const [usage, setUsage] = useState<{ inputTokens: number; outputTokens: number } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => { controller.current?.abort() }, [])
  const selected = rows.filter(row => row.selected && !row.saved)
  const unsaved = rows.filter(row => !row.saved)
  const hasFolder = !!folderId && !!folders?.some(folder => folder.id === folderId)
  const busy = generating || saving
  const limitError = words.length > 20 ? 'Tối đa 20 từ mỗi lần tạo.' : words.some(word => word.length > 200) ? 'Mỗi từ/cụm từ tối đa 200 ký tự.' : words.length * template.fields.length > 200 ? 'Tối đa 200 ô mỗi lần. Hãy giảm số từ hoặc số trường.' : template.fields.length < 2 || template.fields.length > 20 ? 'Mẫu cần có từ 2 đến 20 trường.' : ''

  async function generate() {
    if (!words.length || limitError || busy) return
    if (!hasFolder) { setError('Hãy chọn thư mục trước khi tạo từ vựng.'); return }
    setGenerating(true); onBusy(true); setError('')
    const abort = new AbortController()
    controller.current = abort
    const timer = window.setTimeout(() => abort.abort(), 60_000)
    try {
      const response = await fetch('/api/ai/generate-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal, body: JSON.stringify({ words, sourceFieldId: sourceField, fields: template.fields.map(field => ({ id: field.id, name: field.name })) }) })
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Backend chưa sẵn sàng. Hãy chạy npm run dev.')
      const data = await response.json() as { error?: string; rows?: { index: number; originalWord: string; spelling: SpellingCheck; values: Record<string, string> }[]; usage?: { inputTokens: number; outputTokens: number } }
      if (!response.ok) throw new Error(data.error || 'Không thể tạo danh sách.')
      if (!Array.isArray(data.rows) || data.rows.length !== words.length || data.rows.some((row, index) => row.index !== index || row.originalWord !== words[index] || !row.spelling || !['correct', 'suggested', 'uncertain'].includes(row.spelling.status) || !row.values || template.fields.some(field => typeof row.values[field.id] !== 'string'))) throw new Error('Bảng AI trả về không đúng cấu trúc.')
      if (abort.signal.aborted) return
      setRows(data.rows.map(row => ({ id: crypto.randomUUID(), values: row.values, originalWord: row.originalWord, spelling: row.spelling, spellingReviewed: row.spelling.status !== 'uncertain', selected: row.spelling.status !== 'uncertain', saved: false })))
      setUsage(data.usage ?? null)
      toast.success(`Đã tạo ${data.rows.length} từ bằng một request. Hãy kiểm tra bảng trước khi lưu.`)
    } catch (cause) {
      setError(abort.signal.aborted ? 'Đã dừng hoặc hết thời gian tạo. Kết quả trước đó vẫn được giữ.' : cause instanceof TypeError ? 'Không kết nối được backend. Hãy kiểm tra npm run dev.' : cause instanceof Error ? cause.message : 'Không thể tạo nội dung.')
    } finally { window.clearTimeout(timer); controller.current = null; setGenerating(false); onBusy(false) }
  }
  async function saveSelected() {
    if (!selected.length || busy) return
    if (!hasFolder) { setError('Hãy chọn thư mục trước khi lưu.'); return }
    if (selected.some(needsSpellingReview)) { setError('Hãy xác nhận các từ được gợi ý sửa hoặc chưa chắc chắn trước khi lưu.'); return }
    const missing = selected.find(row => template.fields.some(field => field.required && !row.values[field.id]?.trim()) || !row.values[sourceField]?.trim())
    if (missing) { setError('Hãy điền từ vựng và các trường có dấu * ở những dòng đã chọn.'); return }
    const notes = selected.map(row => rowToNote(row, template, sourceField, folderId, tags))
    if (notes.some(note => { const card = generateCards(note)[0]; return !card?.front.trim() || !card.back.trim() })) { setError('Một số dòng chưa có đủ nội dung hai mặt thẻ. Hãy kiểm tra lại.'); return }
    setSaving(true); onBusy(true); setError('')
    try {
      await saveNotesToFolder(notes, folderId)
      try{await removeCachedWords(selected.map(row=>row.originalWord||row.values[sourceField]||''))}catch{toast.warning('Đã lưu từ vựng; chưa xóa được các từ tương ứng khỏi cache.')} 
      setWords([])
      setRows([])
      setTags('')
      setUsage(null)
      setError('')
      setInputVersion(previous => previous + 1)
      toast.success(`Đã lưu ${notes.length} từ vựng.`)
    } catch { setError('Không thể lưu. Hãy kiểm tra thư mục hoặc quyền lưu dữ liệu của trình duyệt.') }
    finally { setSaving(false); onBusy(false) }
  }
  function confirmSpelling(rowId: string) {
    setRows(previous => previous.map(row => row.id === rowId ? { ...row, spellingReviewed: true, selected: true } : row))
  }
  function editCell(rowId: string, fieldId: string, value: string) {
    setRows(previous => previous.map(row => row.id === rowId ? { ...row, values: { ...row.values, [fieldId]: value },  } : row))
  }
  return <section className="space-y-5"><VocabularyFooter><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-500">{hasFolder ? selected.length + ' từ đang chọn' : 'Bạn cần chọn một thư mục.'}</span><Button type="button" disabled={busy || !hasFolder || !selected.length} onClick={() => void saveSelected()}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}Lưu {selected.length} từ đã chọn</Button></div></VocabularyFooter>
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><Label htmlFor="batch-words" className="mb-0">Danh sách từ vựng</Label><VocabularyCacheControls words={words} onChange={setWords} disabled={busy}/></div><WordTagInput key={inputVersion} id="batch-words" words={words} onChange={setWords} disabled={busy} /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-6 text-slate-500">Đã thêm {words.length}/20 từ vựng.</p><div className="flex gap-2"><Button type="button" disabled={busy || !hasFolder || !words.length || !!limitError} onClick={() => void generate()}>{generating ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}{generating ? 'Đang tạo…' : rows.length ? 'Tạo lại bảng' : 'AI gen'}</Button>{generating && <Button type="button" variant="outline" onClick={() => controller.current?.abort()}>Dừng</Button>}</div></div><p className="mt-2 text-xs text-slate-500">Một lần gọi AI cho cả danh sách; dùng chung hướng dẫn và cấu trúc trường. Tối đa 20 từ/lần. Chưa tự lưu.</p>{rows.length > 0 && <p className="mt-2 text-xs text-amber-700">“Tạo lại bảng” sẽ thay kết quả đang xem. Chỉnh sửa trực tiếp trong bảng không gọi AI.</p>}{limitError && <p role="alert" className="mt-2 text-sm text-red-600">{limitError}</p>}</div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {rows.length > 0 && <><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Kiểm tra kết quả <span className="font-normal text-slate-500">({rows.length} từ)</span></h2><p className="mt-1 text-xs text-slate-500">Từ đã được sửa chính tả và đưa về dạng gốc. Bạn có thể chỉnh sửa nội dung trước khi lưu.</p></div><Button type="button" variant="outline" disabled={busy} onClick={() => { setRows([]); setUsage(null); setError('') }}>Xóa kết quả</Button></div><div className="overflow-hidden rounded-xl border border-slate-200"><Table><TableHeader><TableRow><TableHead className="w-10"><input aria-label="Chọn tất cả từ chưa lưu" type="checkbox" className="h-4 w-4 p-0" disabled={busy || !unsaved.some(row => !needsSpellingReview(row))} checked={unsaved.some(row => !needsSpellingReview(row)) && selected.length === unsaved.filter(row => !needsSpellingReview(row)).length} onChange={event => setRows(previous => previous.map(row => row.saved || needsSpellingReview(row) ? row : { ...row, selected: event.target.checked }))} /></TableHead>{template.fields.map(field => <TableHead key={field.id} className="min-w-40">{field.name}{field.required ? ' *' : ''}</TableHead>)}<TableHead className="w-12" /></TableRow></TableHeader><TableBody>{rows.map((row, rowIndex) => <TableRow key={row.id} className={row.saved ? 'bg-emerald-50/50' : ''}><TableCell className="align-top pt-4">{row.saved ? <span title="Đã lưu"><Check size={17} className="text-emerald-700" /><span className="sr-only">Đã lưu</span></span> : <input type="checkbox" className="h-4 w-4 p-0" aria-label={`Chọn dòng ${rowIndex + 1}`} checked={row.selected} disabled={busy || needsSpellingReview(row)} onChange={event => setRows(previous => previous.map(item => item.id === row.id ? { ...item, selected: event.target.checked } : item))} />}</TableCell>{template.fields.map(field => <TableCell key={field.id} className="min-w-40 p-2 align-top">{field.id === 'wordFamily' && (!hasWordFamily(row.values[sourceField] ?? '') || !!row.originalWord && !hasWordFamily(row.originalWord)) ? <span className="block p-2 text-sm text-slate-400" title="Không áp dụng cho cụm từ">—</span> : <textarea aria-label={`${field.name}, dòng ${rowIndex + 1}`} className="min-w-36 rounded-md bg-transparent p-2 text-sm" rows={3} disabled={busy || row.saved} value={row.values[field.id] ?? ''} onChange={event => editCell(row.id, field.id, event.target.value)} />}{field.id === sourceField && needsSpellingReview(row) && <div className="mt-2 space-y-2"><p className="text-xs text-amber-700">Chưa xác định được từ. Hãy kiểm tra và điền nội dung.</p><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => confirmSpelling(row.id)}>Đã kiểm tra</Button></div>}</TableCell>)}<TableCell className="align-top pt-3"><Button type="button" variant="ghost" size="icon" disabled={busy || row.saved} aria-label={`Xóa dòng ${rowIndex + 1}`} onClick={() => setRows(previous => previous.filter(item => item.id !== row.id))}><Trash2 size={16} /></Button></TableCell></TableRow>)}</TableBody></Table></div><div className="flex flex-wrap items-end justify-between gap-4"><div className="min-w-52 flex-1 space-y-2"><Label htmlFor="batch-tags">Nhãn chung (tùy chọn)</Label><Input id="batch-tags" disabled={busy} value={tags} onChange={event => setTags(event.target.value)} placeholder="toeic, unit 1…" /></div></div>{usage && <p className="text-xs text-slate-400">Lượt tạo vừa rồi: {usage.inputTokens} token đầu vào · {usage.outputTokens} token đầu ra.</p>}</>}
  </section>
}

