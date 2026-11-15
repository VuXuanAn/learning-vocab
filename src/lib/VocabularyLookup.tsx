import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, BookOpen, ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react'
import { db } from './db'
import { noteWord } from './related-words'
import { irregularVerbForms, irregularVerbId, searchIrregularVerbs } from './irregular-verbs'

const plain = (value: string) => value.replace(/<[^>]*>/g, '').trim()
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim()

export default function VocabularyLookup({ onChoose, onClose }: { onChoose: (id: string) => void; onClose: () => void }) {
 const listId = useId()
 const [query, setQuery] = useState('')
 const [active, setActive] = useState(0)
 const list = useRef<HTMLDivElement>(null)
 const notes = useLiveQuery(() => db.notes.toArray())
 const vocabulary = useMemo(() => [...(notes ?? [])].sort((a,b) => b.createdAt - a.createdAt).flatMap(note => {
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
  if (!term) return vocabulary
  const references = referenceMatches.map(verb => ({id:irregularVerbId(verb), word:verb.base, meaning:`${verb.past} · ${verb.participle}\n${verb.meaning}`, wordKey:verb.base, meaningKey:normalized(verb.meaning)}))
  const exactReferences = new Set(referenceMatches.filter(verb=>irregularVerbForms(verb).includes(term)).map(irregularVerbId))
  return [...vocabulary.filter(row => row.wordKey.includes(term) || row.meaningKey.includes(term)), ...references].sort((a,b) => {
   const rank = (word: string) => word === term ? 0 : word.startsWith(term) ? 1 : word.includes(term) ? 2 : 3
   return (exactReferences.has(a.id)?0:rank(a.wordKey))-(exactReferences.has(b.id)?0:rank(b.wordKey)) || a.word.localeCompare(b.word)
  })
 }, [vocabulary, term, referenceMatches])
 const visible = matches.slice(0,50)
 const index = Math.min(active, Math.max(0,visible.length-1))
 useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({block:'nearest'}) }, [index,query])
 return <>
  <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3"><Search size={20} className="shrink-0 text-emerald-700"/>
   <input autoFocus role="combobox" aria-label="Tra từ trong kho" aria-autocomplete="list" aria-expanded={true} aria-controls={listId} aria-activedescendant={visible.length?listId+'-'+index:undefined} autoComplete="off" className="min-w-0 flex-1 border-0 bg-transparent p-1 text-sm outline-none" placeholder="Tìm từ vựng hoặc nghĩa tiếng Việt…" value={query} onChange={event=>{setQuery(event.target.value);setActive(0)}} onKeyDown={event=>{
    if(event.nativeEvent.isComposing)return
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(visible.length)setActive((index+(event.key==='ArrowDown'?1:-1)+visible.length)%visible.length)}
    if(event.key==='Enter'){event.preventDefault();if(visible[index])onChoose(visible[index].id)}
   }}/><button type="button" onClick={onClose} aria-label="Đóng tìm kiếm" className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">Esc</button>
  </div>
  <div className="flex shrink-0 justify-between px-4 py-2 text-xs text-slate-500"><span>{term?'Kết quả tìm kiếm':'Từ vựng đã lưu gần đây'}</span><span role="status" aria-live="polite">{matches.length} từ vựng</span></div>
  <div ref={list} id={listId} role="listbox" aria-label="Kết quả từ vựng" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
   {!notes?<p role="status" className="p-8 text-center text-sm text-slate-500">Đang tải kho từ…</p>:!visible.length?<p role="status" className="p-8 text-center text-sm text-slate-500">{term?'Không tìm thấy từ vựng phù hợp.':'Chưa có từ vựng trong kho.'}</p>:visible.map((row,i)=><div key={row.id} id={listId+'-'+i} role="option" aria-selected={index===i} onMouseMove={()=>setActive(i)} onMouseDown={event=>event.preventDefault()} onClick={()=>onChoose(row.id)} className={'flex cursor-pointer gap-3 rounded-lg px-3 py-3 '+(index===i?'bg-emerald-700 text-white':'text-slate-700 hover:bg-slate-50')}>
    <BookOpen size={18} className="mt-0.5 shrink-0"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{row.word}</p><p className={'mt-1 truncate text-xs '+(index===i?'text-emerald-100':'text-slate-400')}>{row.id.startsWith('irregular:')?'Bất quy tắc · ':''}{row.meaning}</p></div>{index===i&&<CornerDownLeft size={16} className="mt-1 shrink-0"/>}
   </div>)}
  </div>
  <div className="flex shrink-0 flex-wrap items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500"><span className="flex items-center gap-1"><ArrowUp size={12}/><ArrowDown size={12}/>Chọn</span><span>Enter · Xem từ vựng</span><span>Esc · Đóng</span>{matches.length>50&&<span>Hiển thị 50 kết quả, nhập thêm để thu hẹp.</span>}</div>
 </>
}
