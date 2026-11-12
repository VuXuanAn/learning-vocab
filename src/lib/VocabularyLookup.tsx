import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { db } from './db'
import { noteWord } from './related-words'
import LinkedCardDialog from './LinkedCardDialog'
import { irregularVerbForms, irregularVerbId, searchIrregularVerbs } from './irregular-verbs'

const plain = (value: string) => value.replace(/<[^>]*>/g, '').trim()
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim()

export default function VocabularyLookup() {
 const [query, setQuery] = useState('')
 const [selectedNoteId, setSelectedNoteId] = useState('')
 const portalContainer = useRef<HTMLElement | null>(null)
 const notes = useLiveQuery(() => db.notes.toArray())
 const vocabulary = useMemo(() => (notes ?? []).flatMap(note => {
  const word = plain(noteWord(note))
  if (!word) return []
  const field = (pattern: RegExp) => {
   const found = note.template?.fields.find(field => pattern.test(normalized(field.name)))
   return plain((found && note.values?.[found.name]) || '')
  }
  const meaning = field(/nghia|meaning|definition/) || plain(note.back)
  return [{id:note.id,word,meaning,wordKey:normalized(word),meaningKey:normalized(meaning),
   partOfSpeech:field(/^(loai tu|part of speech|word type|pos)$/),
   phonetic:field(/phien am|phonetic|pronunciation|^ipa$/),
   example:field(/^(cau vi du|vi du|example|example sentence)$/),
   translation:field(/^(dich cau vi du|dich vi du|example translation)$/),
   lang:note.template?.speech?.lang,rate:note.template?.speech?.rate}]
 }), [notes])
 const term = normalized(query)
 const referenceMatches = useMemo(() => searchIrregularVerbs(query), [query])
 const matches = useMemo(() => {
  if (!term) return []
  const references = referenceMatches.map(verb => ({id:irregularVerbId(verb), word:verb.base, meaning:`${verb.past} · ${verb.participle}\n${verb.meaning}`, wordKey:verb.base, meaningKey:normalized(verb.meaning)}))
  const exactReferences = new Set(referenceMatches.filter(verb=>irregularVerbForms(verb).includes(term)).map(irregularVerbId))
  return [...vocabulary.filter(row => row.wordKey.includes(term) || row.meaningKey.includes(term)), ...references].sort((a,b) => {
   const rank = (word: string) => word === term ? 0 : word.startsWith(term) ? 1 : word.includes(term) ? 2 : 3
   return (exactReferences.has(a.id)?0:rank(a.wordKey))-(exactReferences.has(b.id)?0:rank(b.wordKey)) || a.word.localeCompare(b.word)
  })
 }, [vocabulary, term, referenceMatches])
 return <section aria-labelledby="vocabulary-lookup-title" className="mb-6 min-w-0 rounded-2xl border border-slate-20 bg-white p-4 shadow-sm">
  <h2 id="vocabulary-lookup-title" className="flex items-center gap-2 font-semibold text-emerald-800"><Search size={18}/>Tra từ trong kho</h2>
  <p className="mt-2 text-xs leading-5 text-slate-500">Tra từ đã lưu và động từ bất quy tắc theo cả V1, V2, V3.</p>
  <div className="relative mt-3"><Input aria-label="Tìm từ vựng trong kho" type="search" autoComplete="off" placeholder="Nhập từ hoặc nghĩa…" value={query} onChange={event=>setQuery(event.target.value)} className="pr-9"/>{query&&<button type="button" onClick={()=>setQuery('')} aria-label="Xóa tìm kiếm" className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"><X size={15}/></button>}</div>
  <p role="status" className="mt-3 text-xs leading-5 text-slate-500">{!notes?'Đang tải kho từ…':!term?'Tìm theo từ tiếng Anh hoặc nghĩa tiếng Việt.':matches.length?`${matches.length} kết quả trong kho từ vựng`:'Chưa tìm thấy từ này trong kho trên thiết bị. Đồng bộ để cập nhật dữ liệu mới nhất.'}</p>
  {!!term&&!!matches.length&&<div key={term} className="mt-3 max-h-[40dvh] space-y-2 overflow-y-auto overscroll-contain pr-1">
   {matches.slice(0,2).map(row=><button key={row.id} type="button" aria-haspopup="dialog" onClick={()=>setSelectedNoteId(row.id)} className="block w-full rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left transition-colors hover:border-emerald-20 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
    <span className="break-words text-sm font-semibold text-emerald-900">{row.word}</span><span className="ml-2 text-[10px] font-medium text-emerald-700">{row.id.startsWith('irregular:')?'Bất quy tắc':'Đã lưu'}</span><span className="mt-1 block whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{row.meaning}</span>
   </button>)}
   {matches.length>2&&<p className="px-1 text-xs leading-5 text-slate-500">Hiển thị 2 kết quả đầu. Nhập thêm để thu hẹp tìm kiếm.</p>}
  </div>}
  <LinkedCardDialog portalContainer={portalContainer} selectedNoteId={selectedNoteId} onClose={()=>setSelectedNoteId('')}/>
 </section>
}
