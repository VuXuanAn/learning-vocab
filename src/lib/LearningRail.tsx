import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sparkles } from 'lucide-react'
import { db } from './db'
import { meaningQuestions } from './meaning-quiz'
import SpeakButton from './SpeakButton'
import VocabularyLookup from './VocabularyLookup'

export default function LearningRail() {
 const data = useLiveQuery(async () => {
  const [notes, reviews] = await Promise.all([
   db.notes.toArray(), db.reviews.toArray(),
  ])
  return meaningQuestions(notes, reviews, [1, 2]).map(question => ({id:'word:'+question.noteId,question}))
 }, [])
 const pool = data ?? []
 const [choice, setChoice] = useState(() => Math.random())
 const poolRef = useRef(pool)
 poolRef.current = pool
 useEffect(() => {
  const timer = window.setInterval(() => {
   if (document.hidden) return
   const size = poolRef.current.length
   if (size < 2) return
   setChoice(previous => {
    const current = Math.min(size - 1, Math.floor(previous * size))
    const next = (current + 1 + Math.floor(Math.random() * (size - 1))) % size
    return (next + .5) / size
   })
  }, 10_000)
  return () => window.clearInterval(timer)
 }, [])
 const item = pool[Math.min(pool.length - 1, Math.floor(choice * pool.length))]
 return <aside aria-label="Tra từ và ôn tập" className="learning-rail">
  <VocabularyLookup/>
  <div className="flex items-center gap-2 text-emerald-800"><Sparkles size={18}/><h2 className="font-semibold">Góc ôn tập</h2></div>
  <p className="mt-2 text-xs leading-5 text-slate-500">Từ vựng Quên / Khó · đổi mỗi 10 giây</p>
  {!data ? <p className="mt-6 text-sm text-slate-500">Đang tải…</p> : !item ? <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-500">Đánh giá từ vựng là Quên / Khó để ôn tại đây.</div> : <article key={item.id} className="mt-5 min-w-0 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
   <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-emerald-700">Từ vựng · Quên / Khó</p>
    <h3 className="whitespace-pre-wrap break-words text-xl font-bold text-emerald-900">{item.question.word}</h3>
    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-sm text-slate-500">{item.question.partOfSpeech&&<span>({item.question.partOfSpeech})</span>}{item.question.phonetic&&<span className="break-words">{item.question.phonetic}</span>}</div>
    <div className="mt-3"><SpeakButton text={item.question.word} lang={item.question.lang} rate={item.question.rate}/></div>
    <p className="mt-4 whitespace-pre-wrap break-words font-medium text-slate-700">{item.question.meaning}</p>
    {item.question.example&&<div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6"><p className="whitespace-pre-wrap break-words text-slate-700">{item.question.example}</p>{item.question.exampleTranslation&&<p className="mt-2 whitespace-pre-wrap break-words text-slate-500">{item.question.exampleTranslation}</p>}</div>}
  </article>}
 </aside>
}
