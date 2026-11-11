import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpenText } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { db } from './db'
import type { Note } from './cards'
import { readingSources } from './reading-sources'
export default function ReadingSources({note}:{note:Note}){
 const {session}=useAuth()
 const sources=readingSources(note).filter(source=>source.ownerId===session?.user.id)
 const ids=JSON.stringify(sources.map(source=>source.articleId))
 const articles=useLiveQuery(()=>db.readingArticles.bulkGet(sources.map(source=>source.articleId)),[ids])
 const shown=sources.map((source,index)=>({source,article:articles?.[index]})).filter(({article})=>!article?.deletedAt)
 if(!shown.length)return null
 return <section className="mt-5 w-full border-t border-slate-100 pt-4 text-left" aria-label="Nguồn bài đọc"><h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><BookOpenText size={15}/>Nguồn bài đọc</h3><ul className="space-y-3">{shown.map(({source,article})=><li key={source.articleId} className="rounded-xl bg-emerald-50/60 p-3"><Link className="text-sm font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-600" to={'/reading/articles/'+encodeURIComponent(source.articleId)+'?sourceNote='+encodeURIComponent(note.id)}>{article?.title??source.title}</Link><span className="ml-2 text-xs text-slate-400">{source.occurrences} vị trí</span>{source.quote&&<p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-500">{source.quote}</p>}</li>)}</ul></section>
}
