import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpenText } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useAuth } from './AuthProvider'
import { db } from './db'
import type { Note } from './cards'
import { readingSources } from './reading-sources'
import { readingSourcePassages } from './reading-content'
export default function ReadingSources({note}:{note:Note}){
 const {session}=useAuth()
 const [selectedId,setSelectedId]=useState<string|null>(null)
 const [portalRoot,setPortalRoot]=useState<HTMLElement|null>(null)
 const sources=readingSources(note).filter(source=>source.ownerId===session?.user.id)
 const ids=JSON.stringify(sources.map(source=>source.articleId))
 const articles=useLiveQuery(()=>db.readingArticles.bulkGet(sources.map(source=>source.articleId)),[ids])
 const shown=sources.map((source,index)=>({source,article:articles?.[index]})).filter(({source,article})=>!article?.deletedAt&&(!article||article.ownerId===source.ownerId))
 const selected=shown.find(({source})=>source.articleId===selectedId)
 const passages=selected?.article?readingSourcePassages(selected.article.contentHtml,selected.article.detection,note.id):[]
 if(!shown.length)return null
 return <section className="mt-5 w-full border-t border-slate-100 pt-4 text-left" aria-label="Nguồn bài đọc"><h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><BookOpenText size={15}/>Nguồn bài đọc</h3><ul className="space-y-3">{shown.map(({source,article})=><li key={source.articleId} className="rounded-xl bg-emerald-50/60 p-3"><button type="button" aria-haspopup="dialog" className="text-left text-sm font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-600" onClick={event=>{setPortalRoot(event.currentTarget.closest<HTMLElement>('[data-focus-mode="true"]'));setSelectedId(source.articleId)}}>{article?.title??source.title}</button><span className="ml-2 text-xs text-slate-400">{source.occurrences} vị trí</span>{source.quote&&<p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-500">{source.quote}</p>}</li>)}</ul>
 <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelectedId(null)}}><DialogContent portalContainer={portalRoot??undefined} className="left-auto right-0 top-0 flex h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-xl"><DialogHeader className="shrink-0 border-b px-6 py-5 pr-12"><DialogTitle className="leading-6">{selected?.article?.title??selected?.source.title}</DialogTitle><DialogDescription>Đoạn bài đọc chứa từ đang ôn. Đóng để tiếp tục học.</DialogDescription></DialogHeader><div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-6">{!articles?<p role="status" className="text-slate-500">Đang tải bài đọc…</p>:passages.length?passages.map((html,index)=><div key={index} className="reading-content whitespace-pre-wrap break-words rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 text-base leading-8 text-slate-700" dangerouslySetInnerHTML={{__html:html}}/>):<><p className="text-sm text-slate-500">{selected?.article?'Nội dung bài đã thay đổi. Hiển thị đoạn trích đã lưu.':'Bài đọc chưa có trên thiết bị. Hiển thị đoạn trích đã lưu.'}</p><blockquote className="whitespace-pre-wrap break-words rounded-xl bg-emerald-50/60 p-4 text-base leading-8 text-slate-700">{selected?.source.quote||'Chưa có đoạn trích cho từ này.'}</blockquote></>}</div></DialogContent></Dialog>
 </section>
}
