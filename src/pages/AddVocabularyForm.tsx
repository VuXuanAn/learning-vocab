import StyledSelect from '@/components/ui/styled-select'
import VocabularyFolderSelect from '../lib/VocabularyFolderSelect'
import VocabularyFooter from '../lib/VocabularyFooter'
import { saveNotesToFolder } from '../lib/folder-storage'
import BatchAIGenerator from '../lib/BatchAIGenerator'
import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, RotateCcw, ArrowRight, Check, Eye } from 'lucide-react'
import { toast } from 'sonner'
import SpeakButton from '../lib/SpeakButton'
import CardHtml from '../lib/CardHtml'
import TemplateEditor from '../lib/TemplateEditor'
import type { CardTemplate } from '../lib/templates'
import { db } from '../lib/db'
import { generateCards, noteLabels, type Note, type NoteKind } from '../lib/cards'

export default function AddVocabularyForm({ initialFolderId = '', initialWords = [] }: { initialFolderId?: string; initialWords?: string[] }) {
  const [folderId, setFolderId] = useState(initialFolderId)
  const folders = useLiveQuery(() => db.folders.filter(folder => folder.permission !== 'viewer').toArray())
  const [showEditor, setShowEditor] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<CardTemplate | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const templates = useLiveQuery(() => db.templates.toArray())
  const [kind, setKind] = useState<NoteKind>('ai')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [extra, setExtra] = useState('')
  const [tags, setTags] = useState('english, vocabulary')
  const [revealed, setRevealed] = useState(false)
  const [cardIndex, setCardIndex] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const draft: Note = { id: 'preview', folderId: folderId === 'all' ? '' : folderId, kind, front, back, extra, tags, createdAt: 0, template: selectedTemplate ?? undefined, values }
  const cards = generateCards(draft)
  const previewTemplate = selectedTemplate
  const speechField = previewTemplate?.fields.find(field => field.id === previewTemplate.speech?.fieldId)
  const speechText = speechField ? draft.values?.[speechField.name] ?? '' : !previewTemplate && draft.kind !== 'cloze' ? draft.front : ''
  const cardStyle = previewTemplate ? { textAlign: previewTemplate.align, fontSize: previewTemplate.fontSize, color: previewTemplate.color, width: '100%' } : undefined
  const card = cards[Math.min(cardIndex, cards.length - 1)]

  function resetPreview() { setRevealed(false); setCardIndex(0) }
  function selectTemplate(template: CardTemplate) {
    setSelectedTemplate(template); setKind('custom'); setValues({}); setExtra(''); resetPreview()
  }
  function changeKind(next: NoteKind) {
    if (next === 'custom') return
    setSelectedTemplate(null)
    setKind(next); setFront(''); setBack('')
    setExtra(''); resetPreview()
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!folderId || !folders?.some(folder => folder.id === folderId)) { toast.error('Hãy chọn thư mục trước khi lưu.'); return }
    if (kind === 'custom' && (!selectedTemplate || selectedTemplate.fields.some(field => field.required && !values[field.name]?.trim()))) { toast.error('Hãy nhập đầy đủ các trường bắt buộc.'); return }
    if (kind === 'custom' && (!generateCards(draft)[0]?.front.trim() || !generateCards(draft)[0]?.back.trim())) { toast.error('Hai mặt thẻ cần có nội dung.'); return }
    if (kind !== 'custom' && (!front.trim() || (kind !== 'cloze' && !back.trim()))) { toast.error('Hãy nhập đủ mặt trước và mặt sau.'); return }
    if (!generateCards(draft).length) { toast.error('Dùng cú pháp {{c1::từ cần ẩn}} để tạo thẻ điền chỗ trống.'); return }
    setSaving(true)
    try {
      const note = { ...draft, id: crypto.randomUUID(), front: kind === 'custom' ? Object.values(values).find(value => value.trim()) ?? '' : front.trim(), back: back.trim(), createdAt: Date.now() }
      await saveNotesToFolder([note], folderId)
      toast.success(`Đã lưu ghi chú và tạo ${generateCards(note).length} thẻ.`)
      setFront(''); setBack(''); setExtra(''); setValues({}); resetPreview()
    } catch { toast.error('Không thể lưu. Hãy kiểm tra quyền lưu dữ liệu của trình duyệt.') }
    finally { setSaving(false) }
  }
  const kindControl = (<div><div className="mb-2 flex items-center justify-between"><label className="mb-0" htmlFor="kind">Kiểu thẻ</label><button type="button" disabled={generating || saving} className="text-sm font-semibold text-emerald-700" onClick={() => setShowEditor(true)}>+ Tạo kiểu mới</button></div><StyledSelect id="kind" disabled={generating || saving} value={kind === 'custom' ? selectedTemplate?.id : kind} onChange={event => { const template = templates?.find(item => item.id === event.target.value); if (template) selectTemplate(template); else changeKind(event.target.value as NoteKind) }}>{Object.entries(noteLabels).filter(([value]) => value !== 'custom').map(([value, label]) => <option key={value} value={value}>{label}</option>)}{templates?.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</StyledSelect></div>)
  const folderControl = (<div><label htmlFor="note-folder">Lưu vào thư mục *</label><VocabularyFolderSelect id="note-folder" disabled={generating || saving} value={folderId} folders={folders??[]} onChange={value=>{setFolderId(value);resetPreview()}}/>{folders?.length === 0 && <p className="mt-2 text-xs text-amber-700">Chưa có thư mục. Hãy tạo thư mục ở trang Bộ thẻ trước.</p>}</div>)
  if (kind === 'ai') return <div className="space-y-5">{showEditor && <TemplateEditor onClose={() => setShowEditor(false)} onSaved={template => { selectTemplate(template); setShowEditor(false) }} />}<div className="grid items-start gap-4 sm:grid-cols-2">{kindControl}{folderControl}</div><BatchAIGenerator initialWords={initialWords} folderId={folderId} onBusy={setGenerating} /></div>
  return (
    <div>
        {showEditor && <TemplateEditor onClose={() => setShowEditor(false)} onSaved={template => { selectTemplate(template); setShowEditor(false) }} />}
        <div className="grid items-start gap-7 lg:grid-cols-[1.1fr_1fr]">
          <section className="panel">
            <form id="vocabulary-note-form" onSubmit={save} className="space-y-5 p-6"><div className="grid items-start gap-4 sm:grid-cols-2">{kindControl}{folderControl}</div>
              <fieldset disabled={generating || saving} className="min-w-0 space-y-5">
              {kind === 'custom' ? selectedTemplate?.fields.map(field => <div key={field.id}><label htmlFor={field.id}>{field.name}{field.required ? ' *' : ''}</label><textarea id={field.id} rows={2} required={field.required} value={values[field.name] ?? ''} onChange={event => { setValues(previous => ({ ...previous, [field.name]: event.target.value })); resetPreview() }} /></div>) : <>
              <div><label htmlFor="front">{kind === 'cloze' ? 'Nội dung có từ cần ẩn' : 'Mặt trước'} <span className="text-emerald-700">*</span></label><textarea id="front" required value={front} onChange={event => { setFront(event.target.value); resetPreview() }} placeholder={kind === 'cloze' ? 'I {{c1::love}} learning languages.' : 'Nhập từ hoặc câu hỏi…'} rows={3} />{kind === 'cloze' && <p className="mt-2 text-xs text-slate-500">Cú pháp: {'{{c1::đáp án::gợi ý}}'}. Gợi ý không bắt buộc.</p>}</div>
              <div><label htmlFor="back">{kind === 'cloze' ? 'Giải nghĩa (tùy chọn)' : 'Mặt sau *'}</label><textarea id="back" required={kind !== 'cloze'} value={back} onChange={event => { setBack(event.target.value); resetPreview() }} placeholder="Nghĩa hoặc đáp án…" rows={3} /></div>
              </>}
              <div><label htmlFor="extra">Ví dụ / ghi chú thêm</label><textarea id="extra" value={extra} onChange={event => { setExtra(event.target.value); resetPreview() }} placeholder="Thêm ngữ cảnh để dễ nhớ hơn…" rows={2} /></div>
              <div><label htmlFor="tags">Nhãn</label><input id="tags" value={tags} onChange={event => setTags(event.target.value)} placeholder="english, công việc…" /><p className="mt-2 text-xs text-slate-400">Phân cách các nhãn bằng dấu phẩy.</p></div>
              <VocabularyFooter><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-500">{folders?.some(folder => folder.id === folderId) ? 'Lưu vào: ' + folders.find(folder => folder.id === folderId)?.name : 'Bạn cần chọn một thư mục.'}</span><button form="vocabulary-note-form" disabled={saving || generating || !folderId || !folders?.some(folder => folder.id === folderId)} className="primary" type="submit"><Plus size={18} />{saving ? 'Đang lưu…' : 'Lưu ghi chú'}</button></div></VocabularyFooter>
              </fieldset>
            </form>
          </section>
          <section id="vocabulary-preview" className="space-y-5 lg:sticky lg:top-6">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Eye size={18} />Xem trước trực tiếp</h2><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">{selectedTemplate?.name ?? noteLabels[kind]}</span></div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex justify-between border-b border-slate-100 px-6 py-4 text-xs text-slate-400"><span>VOCAB LIBRARY</span><span>THẺ {cards.length ? Math.min(cardIndex + 1, cards.length) : 0} / {cards.length}</span></div>
              {previewTemplate?.format === 'html' && card ? <div className="p-4" aria-live="polite"><CardHtml template={previewTemplate} content={revealed ? card.back : card.front} title={revealed ? 'Mặt sau thẻ' : 'Mặt trước thẻ'} />{revealed && card.extra && <p className="px-4 py-3 whitespace-pre-wrap text-sm text-slate-500">{card.extra}</p>}</div> : <><div className="flex min-h-80 flex-col items-center justify-center px-8 py-10 text-center" aria-live="polite"><p className="eyebrow">{revealed ? 'ĐÁP ÁN' : 'BẠN CÓ NHỚ?'}</p><p style={cardStyle} className="mt-6 whitespace-pre-wrap break-words text-3xl font-semibold leading-relaxed text-slate-800">{card?.front || 'Nội dung thẻ sẽ xuất hiện ở đây'}</p>{revealed && card && <div className="mt-7 w-full border-t border-slate-200 pt-7"><p style={cardStyle} className="whitespace-pre-wrap break-words text-xl leading-8 text-emerald-800">{card.back}</p>{card.extra && <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-500">{card.extra}</p>}</div>}</div></>}
              {speechText.trim() && <div className="border-t border-slate-100 p-4"><SpeakButton text={speechText} lang={previewTemplate?.speech?.lang} rate={previewTemplate?.speech?.rate} /></div>}
              <div className="flex gap-3 border-t border-slate-100 bg-slate-50 p-4"><button type="button" disabled={!card} onClick={() => setRevealed(!revealed)} className="primary flex-1">{revealed ? <RotateCcw size={16} /> : <Eye size={16} />}{revealed ? 'Ẩn đáp án' : 'Hiện đáp án'}</button>{cards.length > 1 && <button type="button" className="secondary" onClick={() => { setCardIndex((cardIndex + 1) % cards.length); setRevealed(false) }}>Thẻ tiếp <ArrowRight size={16} /></button>}</div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-5 text-sm leading-6 text-emerald-900"><Check className="mb-2" size={18} />Tự nhớ trước khi lật thẻ. Ví dụ và ghi chú chỉ hiện ở mặt đáp án để bạn tập trung vào điều cần nhớ.</div>
          </section>
        </div>

    </div>
  )
}


