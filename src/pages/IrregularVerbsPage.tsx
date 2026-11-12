import IrregularVerbPronunciation from '../lib/IrregularVerbPronunciation'
import { useState } from 'react'
import { BookOpenText, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { irregularVerbs, normalizeVerbSearch, verbPattern } from '../lib/irregular-verbs'

const patterns = [ ['all', 'Tất cả'], ['same', 'V1 = V2 = V3'], ['past-same', 'V2 = V3'], ['base-same', 'V1 = V3'], ['different', 'Dạng khác'] ]

export default function IrregularVerbsPage() {
 const [search, setSearch] = useState('')
 const [pattern, setPattern] = useState('all')
 const query = normalizeVerbSearch(search)
 const filtered = irregularVerbs.filter(verb => (pattern === 'all' || verbPattern(verb) === pattern) && (!query || normalizeVerbSearch([verb.base, verb.past, verb.participle, verb.meaning].join(' ')).includes(query)))
 const active = !!search || pattern !== 'all'
 function reset() { setSearch(''); setPattern('all') }
 return <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6 lg:p-8">
  <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 sm:gap-6">
   <header className="shrink-0">
    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-700">Vocab / Tra cứu</p>
    <div className="flex flex-wrap items-center gap-3"><span className="rounded-xl bg-emerald-100 p-3 text-emerald-800"><BookOpenText size={24}/></span><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Động từ bất quy tắc</h1><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{irregularVerbs.length} động từ</span></div>
    <p className="mt-3 text-sm leading-6 text-slate-500">Tra nhanh ba dạng động từ và nghĩa tiếng Việt.</p>
   </header>
   <section aria-label="Tìm kiếm và lọc động từ" className="shrink-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="relative"><Search size={19} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><Input aria-label="Tìm động từ hoặc nghĩa tiếng Việt" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Tìm V1, V2, V3 hoặc nghĩa… ví dụ: went, written, đi" className="h-12 pl-10 pr-11"/>{search&&<button type="button" aria-label="Xóa tìm kiếm" onClick={()=>setSearch('')} className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={16}/></button>}</div>
    <div className="flex flex-wrap gap-2">{patterns.map(([value,label])=><button key={value} type="button" aria-pressed={pattern===value} onClick={()=>setPattern(value)} className={'rounded-lg border px-3 py-2 text-xs font-medium transition '+(pattern===value?'border-emerald-700 bg-emerald-700 text-white':'border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50')}>{label}</button>)}</div>
   </section>
   <section aria-label="Bảng động từ bất quy tắc" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><p role="status" aria-live="polite" className="text-sm text-slate-500"><strong className="font-semibold text-slate-800">{filtered.length}</strong> / {irregularVerbs.length} động từ</p>{active&&<button type="button" onClick={reset} className="text-sm font-medium text-emerald-700 hover:underline">Xóa bộ lọc</button>}</div>
    <div className="min-h-0 flex-1 overflow-auto overscroll-contain" tabIndex={0}><table className="w-full min-w-[640px] text-left text-sm"><caption className="sr-only">Dạng nguyên mẫu, quá khứ, quá khứ phân từ và nghĩa tiếng Việt</caption><thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500"><tr>{[['V1','Nguyên mẫu'],['V2','Quá khứ'],['V3','Quá khứ phân từ'],['Nghĩa','Tiếng Việt']].map(([title,subtitle])=><th key={title} scope="col" className="px-5 py-4 font-normal"><span className="block font-bold text-slate-700">{title}</span><span className="mt-1 block">{subtitle}</span></th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(verb=><tr key={verb.base} className="transition hover:bg-emerald-50/50"><th scope="row" className="px-5 py-4 font-semibold text-emerald-800"><IrregularVerbPronunciation verb={verb} form="base"/></th><td className="px-5 py-4 text-slate-700"><IrregularVerbPronunciation verb={verb} form="past"/></td><td className="px-5 py-4 text-slate-700"><IrregularVerbPronunciation verb={verb} form="participle"/></td><td className="px-5 py-4 text-slate-500">{verb.meaning}</td></tr>)}</tbody></table></div>
    {!filtered.length&&<div className="px-5 py-14 text-center"><Search size={28} className="mx-auto mb-3 text-slate-300"/><p className="font-medium text-slate-700">Không tìm thấy động từ</p><p className="mt-2 text-sm text-slate-500">Thử dạng khác của từ, nghĩa tiếng Việt hoặc bỏ bộ lọc.</p><button type="button" onClick={reset} className="mt-4 text-sm font-semibold text-emerald-700 hover:underline">Hiển thị tất cả</button></div>}
   </section>
   <p className="shrink-0 text-xs leading-5 text-slate-400">IPA Anh–Mỹ · Bấm loa để nghe bằng giọng đọc từ thiết bị. {irregularVerbs.length} động từ, gồm cả động từ ghép và các dạng ít gặp.</p>
  </div>
 </main>
}
