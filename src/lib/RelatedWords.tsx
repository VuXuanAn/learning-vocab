import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useLocation } from 'react-router-dom'
import { LoaderCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { Note } from './cards'
import { db } from './db'
import { parseRelatedWords, findRelatedNote, wordKey } from './related-words'
import { generateRelatedNote } from './related-storage'
export default function RelatedWords({ note, text }: { note: Note; text: string }) {
  const notes = useLiveQuery(() => db.notes.toArray())
  const [busyWord, setBusyWord] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const location = useLocation()
  useEffect(() => () => controller.current?.abort(), [])
  const parent = notes?.find(row => row.id === note.id) ?? note
  const words = parseRelatedWords(text)
  async function generate(word: string) {
    if (controller.current) return
    const abort = new AbortController(); controller.current = abort; setBusyWord(word)
    const timer = window.setTimeout(() => abort.abort(), 60_000)
    try {
      const target = await generateRelatedNote(word, parent, abort.signal)
      if (!abort.signal.aborted) toast.success('Đã có thẻ “' + (target.values?.['Từ vựng'] || target.front) + '”. Bấm vào từ để xem.')
    } catch (error) {
      if (!abort.signal.aborted) toast.error(error instanceof Error ? error.message : 'Không thể tạo từ liên quan.')
      else toast.info('Đã dừng tạo từ hoặc hết thời gian chờ.')
    } finally { window.clearTimeout(timer); controller.current = null; setBusyWord(null) }
  }
  return <div className="border-t border-slate-100 pt-5 text-left"><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Các dạng từ liên quan</h3>{!words.length ? <p className="whitespace-pre-line text-sm text-slate-600">{text}</p> : <ul className="space-y-2">{words.map(({ word, description }) => {
    const target = findRelatedNote(notes ?? [], parent, word)
    const params = new URLSearchParams(location.search)
    if (target) params.set('note', target.id)
    return <li key={wordKey(word)} className="flex flex-wrap items-center justify-between gap-2 text-sm"><div className="min-w-0 break-words">{target ? <Link to={{ pathname: location.pathname === '/cards' ? '/cards' : '/review', search: '?' + params.toString() }} className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-900">{word}</Link> : <span className="font-medium text-slate-700">{word}</span>}{description && <span className="text-slate-500"> {description.startsWith('(') ? description : ': ' + description}</span>}</div>{!target && <button type="button" disabled={!!busyWord || !notes} onClick={() => void generate(word)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">{busyWord === word ? <LoaderCircle size={13} className="animate-spin"/> : <Sparkles size={13}/>}AI gen</button>}</li>
  })}</ul>}</div>
}
