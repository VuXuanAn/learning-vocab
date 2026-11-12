import { cleanGrammarHtml } from './grammar-html'
import { grammarDocument } from './grammar-document'
import type { GrammarEntry } from './grammar-types'

export default function GrammarContent({entry}:{entry:GrammarEntry}) {
 if(entry.contentHtml!==undefined)return <div className="grammar-rich-content reading-content break-words" dangerouslySetInnerHTML={{__html:cleanGrammarHtml(entry.contentHtml)}}/>
 const document=grammarDocument(entry)
 return <div className="space-y-6">
  {document.level&&<span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{document.level}</span>}
  <section className="space-y-3"><h2 className="text-sm font-semibold text-emerald-700">Cấu trúc</h2>{document.structures.map(row=><div key={row.id} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">{row.type&&<h3 className="mb-2 text-sm font-semibold text-emerald-800">{row.type}</h3>}<p className="whitespace-pre-wrap break-words font-mono text-sm leading-7 text-emerald-950">{row.formula}</p></div>)}</section>
  <section><h2 className="mb-3 font-semibold">Cách dùng</h2>{document.usages.some(row=>row.content)?<ul className="list-disc space-y-2 pl-5">{document.usages.filter(row=>row.content).map(row=><li key={row.id} className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{row.content}</li>)}</ul>:<p className="text-sm text-slate-500">Chưa thêm cách dùng.</p>}</section>
  <section className="space-y-3"><h2 className="font-semibold">Ví dụ</h2>{document.examples.some(row=>row.en||row.vi)?document.examples.filter(row=>row.en||row.vi).map(row=><div key={row.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4"><p lang="en" className="whitespace-pre-wrap break-words leading-7 text-slate-800">{row.en}</p>{row.vi&&<p lang="vi" className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-500">{row.vi}</p>}</div>):<p className="text-sm text-slate-500">Chưa thêm ví dụ.</p>}</section>
  <section><h2 className="mb-3 font-semibold">Ghi chú</h2><p className="whitespace-pre-wrap break-words border-l-2 border-amber-300 pl-4 text-sm leading-7 text-slate-600">{document.notes||'Chưa thêm ghi chú.'}</p></section>
 </div>
}
