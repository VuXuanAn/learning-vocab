import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { db } from './db'
import SpeakButton, { speechLanguages } from './SpeakButton'
import CardHtml from './CardHtml'
import { renderCardTemplate, validateTemplate, type CardTemplate } from './templates'

const makeTemplate = (): CardTemplate => ({
  id: crypto.randomUUID(), name: '',
  fields: [{ id: crypto.randomUUID(), name: 'Từ vựng', required: true }, { id: crypto.randomUUID(), name: 'Nghĩa', required: true }, { id: crypto.randomUUID(), name: 'Ví dụ', required: false }],
  frontTemplate: '<div class="word">{{Từ vựng}}</div>', backTemplate: '{{FrontSide}}<hr><div class="meaning">{{Nghĩa}}</div><p class="example">{{Ví dụ}}</p>', format: 'html', css: '.word { font-size: 36px; font-weight: 700; }\n.meaning { color: #166534; }\n.example { font-size: 18px; color: #64748b; }\nhr { border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0; }', align: 'center', fontSize: 28, color: '#166534',
})
export default function TemplateEditor({ onClose, onSaved }: { onClose: () => void; onSaved: (template: CardTemplate) => void }) {
  const [template, setTemplate] = useState(makeTemplate)
  const [side, setSide] = useState<'frontTemplate' | 'backTemplate'>('frontTemplate')
  const [speechSample, setSpeechSample] = useState('serendipity')
  const [busy, setBusy] = useState(false)
  const values = Object.fromEntries(template.fields.map(field => [field.name, `Nội dung ${field.name || 'trường'}`]))
  const update = (patch: Partial<CardTemplate>) => setTemplate(previous => ({ ...previous, ...patch }))
  async function save() {
    const normalized = { ...template, name: template.name.trim(), fields: template.fields.map(field => ({ ...field, name: field.name.trim() })) }
    const error = validateTemplate(normalized)
    if (error) { toast.error(error); return }
    setBusy(true)
    try { await db.templates.add(normalized); onSaved(normalized); toast.success('Đã tạo kiểu thẻ mới.') }
    catch { toast.error('Không thể lưu kiểu thẻ. Vui lòng thử lại.') }
    finally { setBusy(false) }
  }
  return <section className="panel mb-7 border-emerald-200" aria-label="Tạo kiểu thẻ tùy chỉnh">
    <div className="panel-heading justify-between"><h2>Tạo kiểu thẻ tùy chỉnh</h2><button type="button" className="secondary" onClick={onClose}>Đóng</button></div>
    <div className="grid gap-7 p-6 lg:grid-cols-2">
      <div className="space-y-5">
        <div><label htmlFor="template-name">Tên kiểu thẻ</label><input id="template-name" value={template.name} onChange={event => update({ name: event.target.value })} placeholder="Ví dụ: Từ vựng tiếng Anh" /></div>
        <div><h3 className="mb-3 font-semibold">Các trường dữ liệu</h3><div className="space-y-3">{template.fields.map((field, index) => <div key={field.id} className="flex flex-wrap items-center gap-2"><input className="min-w-32 flex-1" aria-label={`Tên trường ${index + 1}`} value={field.name} onChange={event => update({ fields: template.fields.map(item => item.id === field.id ? { ...item, name: event.target.value } : item) })} /><label className="mb-0 flex items-center gap-2 text-xs"><input className="w-auto" type="checkbox" checked={field.required} onChange={event => update({ fields: template.fields.map(item => item.id === field.id ? { ...item, required: event.target.checked } : item) })} />Bắt buộc</label><button type="button" className="secondary" aria-label={`Xóa trường ${field.name}`} disabled={template.fields.length === 1} onClick={() => update({ fields: template.fields.filter(item => item.id !== field.id), speech: template.speech?.fieldId === field.id ? undefined : template.speech })}><Trash2 size={15} /></button></div>)}</div><button type="button" className="secondary mt-3" onClick={() => update({ fields: [...template.fields, { id: crypto.randomUUID(), name: `Trường ${template.fields.length + 1}`, required: false }] })}><Plus size={15} />Thêm trường</button></div>
        <div className="grid grid-cols-3 gap-3"><div><label htmlFor="alignment">Căn chữ</label><select id="alignment" value={template.align} onChange={event => update({ align: event.target.value as CardTemplate['align'] })}><option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option></select></div><div><label htmlFor="font-size">Cỡ chữ</label><input id="font-size" type="number" min={14} max={48} value={template.fontSize} onChange={event => update({ fontSize: Number(event.target.value) })} /></div><div><label htmlFor="text-color">Màu chữ</label><input id="text-color" type="color" className="h-12 p-1" value={template.color} onChange={event => update({ color: event.target.value })} /></div></div>
        <section className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4"><h3 className="font-semibold">Giọng đọc từ vựng</h3><label htmlFor="speech-field">Trường cần đọc</label><select id="speech-field" value={template.speech?.fieldId ?? ''} onChange={event => update({ speech: event.target.value ? { fieldId: event.target.value, lang: template.speech?.lang ?? 'en-US', rate: template.speech?.rate ?? 1 } : undefined })}><option value="">Không bật giọng đọc</option>{template.fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select>{template.speech && <><label htmlFor="speech-language">Ngôn ngữ</label><select id="speech-language" value={template.speech.lang} onChange={event => update({ speech: { ...template.speech!, lang: event.target.value } })}>{speechLanguages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><label htmlFor="speech-rate">Tốc độ</label><select id="speech-rate" value={template.speech.rate} onChange={event => update({ speech: { ...template.speech!, rate: Number(event.target.value) } })}><option value={0.7}>Chậm (0.7×)</option><option value={1}>Bình thường (1×)</option><option value={1.2}>Nhanh (1.2×)</option></select><label htmlFor="speech-sample">Từ để nghe thử</label><input id="speech-sample" value={speechSample} onChange={event => setSpeechSample(event.target.value)} /><SpeakButton text={speechSample} lang={template.speech.lang} rate={template.speech.rate} /></>}<p className="text-xs leading-5 text-slate-500">Nút nghe hiển thị bên dưới thẻ. Giọng đọc phụ thuộc trình duyệt và thiết bị, không cần API key.</p></section>
      </div>
      <div className="space-y-4"><div className="flex gap-2"><button type="button" aria-pressed={side === 'frontTemplate'} className={side === 'frontTemplate' ? 'primary' : 'secondary'} onClick={() => setSide('frontTemplate')}>Mặt trước</button><button type="button" aria-pressed={side === 'backTemplate'} className={side === 'backTemplate' ? 'primary' : 'secondary'} onClick={() => setSide('backTemplate')}>Mặt sau</button></div><label htmlFor="layout">HTML {side === 'frontTemplate' ? 'mặt trước' : 'mặt sau'}</label><textarea id="layout" className="font-mono" spellCheck={false} rows={7} value={template[side]} onChange={event => update({ [side]: event.target.value })} /><div className="flex flex-wrap gap-2">{[...template.fields.map(field => field.name), ...(side === 'backTemplate' ? ['FrontSide'] : [])].map((name, index) => <button key={index} type="button" className="secondary text-xs" onClick={() => update({ [side]: template[side] + `\n{{${name}}}` })}>{`+ {{${name}}}`}</button>)}</div><p className="text-xs leading-6 text-slate-500">Đặt trường theo thứ tự mong muốn bằng {'{{Tên trường}}'}, thêm chữ và xuống dòng tùy ý. {'{{FrontSide}}'} chèn mặt trước vào mặt sau. Dùng HTML như {'<div>'}, {'<p>'}, {'<span>'} và class để định dạng. CSS bên dưới chỉ áp dụng cho thẻ. JavaScript không được chạy.</p><div><label htmlFor="card-css">CSS chung cho hai mặt</label><textarea id="card-css" className="font-mono" spellCheck={false} rows={7} value={template.css ?? ''} onChange={event => update({ css: event.target.value })} /><p className="mt-2 text-xs text-slate-500">Dùng .card cho toàn bộ thẻ, hoặc class bạn đặt trong HTML.</p></div><CardHtml template={template} content={renderCardTemplate(template, side, values)} title="Xem trước HTML của kiểu thẻ" /></div>
    </div><div className="flex justify-end border-t border-slate-100 p-5"><button type="button" disabled={busy} className="primary" onClick={() => void save()}>{busy ? 'Đang lưu…' : 'Lưu kiểu thẻ và sử dụng'}</button></div>
  </section>
}
