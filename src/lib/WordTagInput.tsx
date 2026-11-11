import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { parseWordList } from './ai-batch'

export default function WordTagInput({ id, words, onChange, disabled = false }: { id: string; words: string[]; onChange: (words: string[]) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null)
  function commit(text: string) {
    const additions = parseWordList(text)
    if (!additions.length) { setDraft(''); return }
    const existing = new Set(words.map(word => word.toLocaleLowerCase('vi')))
    const fresh = additions.filter(word => !existing.has(word.toLocaleLowerCase('vi')))
    if (fresh.some(word => word.length > 200)) { setMessage('Mỗi từ hoặc cụm từ tối đa 200 ký tự.'); return }
    const accepted = fresh.slice(0, Math.max(0, 20 - words.length))
    const removed = fresh.length - accepted.length
    onChange([...words, ...accepted])
    setDraft('')
    setMessage([removed ? `Chỉ giữ tối đa 20 từ. Đã bỏ ${removed} từ dư ở cuối danh sách.` : '', fresh.length < additions.length ? 'Từ trùng đã được bỏ qua.' : ''].filter(Boolean).join(' '))
  }
  function remove(index: number) {
    onChange(words.filter((_, wordIndex) => wordIndex !== index))
    setMessage('')
    input.current?.focus()
  }
  return <div>
    <div className={`flex min-h-28 flex-wrap content-start items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20 ${disabled ? 'opacity-60' : ''}`} onClick={event => { if (event.target === event.currentTarget) input.current?.focus() }}>
      <ul aria-label="Các từ đã nhập" className="contents">{words.map((word, index) => <li key={word.toLocaleLowerCase('vi')} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800"><span className="break-words [overflow-wrap:anywhere]">{word}</span><button type="button" aria-label={`Xóa từ ${word}`} disabled={disabled} className="shrink-0 rounded p-0.5 hover:bg-emerald-200 focus-visible:outline-emerald-700" onClick={() => remove(index)}><X size={14} /></button></li>)}</ul>
      <input ref={input} id={id} type="text" disabled={disabled} value={draft} aria-describedby={`${id}-help ${id}-status`} className="!w-auto min-w-40 flex-1 !rounded-none !border-0 !bg-transparent !px-1 !py-1.5 !outline-none !ring-0" placeholder={words.length ? 'Thêm từ, phân cách bằng dấu phẩy…' : 'Dán danh sách: success, contribution, break the ice…'} onChange={event => { setDraft(event.target.value); setMessage('') }} onBlur={() => { if (!disabled && draft.trim()) commit(draft) }} onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
        if (event.key === 'Enter' || event.key === ',' || event.key === ';') { event.preventDefault(); commit(draft) }
        if (event.key === 'Backspace' && !draft && words.length) { event.preventDefault(); remove(words.length - 1) }
      }} onPaste={event => {
        const pasted = event.clipboardData.getData('text')
        if (!/[\n,;]/.test(pasted)) return
        event.preventDefault()
        const start = event.currentTarget.selectionStart ?? draft.length
        const end = event.currentTarget.selectionEnd ?? start
        const combined = draft.slice(0, start) + pasted + draft.slice(end)
        setDraft(combined)
        commit(combined)
      }} />
    </div>
    <p id={`${id}-help`} className="mt-2 text-xs leading-6 text-slate-500">Dán các từ cách nhau bằng dấu phẩy (,) để tự tách thành từng tag. Cũng hỗ trợ Enter, dấu chấm phẩy và xuống dòng; giữ nguyên khoảng trắng trong cụm từ.</p>
    <p id={`${id}-status`} role="status" className="text-xs text-amber-700">{message}</p>
  </div>
}
