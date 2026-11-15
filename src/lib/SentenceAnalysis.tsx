import { useState } from 'react'
import { MousePointer2, Tags, X, Combine, Split } from 'lucide-react'
import { sentenceRoles, sentenceTags, mergeSentenceTags, splitSentenceTag, wordTypes, type WordAnnotation, type WordGroup } from './scratchpad-analysis'

export default function SentenceAnalysis({quote,annotations,groups,onChange,onGroupsChange}:{quote:string;annotations:Record<string,WordAnnotation>;groups:WordGroup[];onChange:(value:Record<string,WordAnnotation>)=>void;onGroupsChange:(groups:WordGroup[],annotations:Record<string,WordAnnotation>)=>void}){
 const words=sentenceTags(quote,groups)
 const [selected,setSelected]=useState<Set<string>>(()=>new Set())
 const selectedWords=words.filter(word=>selected.has(word.id))
 const active=selectedWords[0]
 const canMerge=selectedWords.length>1&&words.indexOf(selectedWords.at(-1)!)-words.indexOf(selectedWords[0])+1===selectedWords.length
 const first=active?annotations[active.id]??{}:{}
 const annotation={
  role:selectedWords.every(word=>annotations[word.id]?.role===first.role)?first.role:undefined,
  wordType:selectedWords.every(word=>annotations[word.id]?.wordType===first.wordType)?first.wordType:undefined,
  note:active?annotations[active.id]?.note:undefined,
 }
 const assigned=words.filter(word=>annotations[word.id]?.role||annotations[word.id]?.wordType).length
 function selectWord(id:string,multiple:boolean){
  setSelected(previous=>{
   if(!multiple)return new Set([id])
   const next=new Set(previous)
   if(next.has(id))next.delete(id);else next.add(id)
   return next
  })
 }
 function update(patch:Partial<WordAnnotation>){
  if(!active)return
  const next={...annotations}
  for(const word of selectedWords)for(const id of 'note' in patch?[word.id]:new Set([word.id,...word.wordIds])){
   next[id]={...annotations[id],...patch}
   if(!next[id].role&&!next[id].wordType&&!next[id].note)delete next[id]
  }
  onChange(next)
 }
 function merge(){
  const result=mergeSentenceTags(quote,groups,annotations,selected)
  if(result){onGroupsChange(result.groups,result.annotations);setSelected(new Set([result.id]))}
 }
 function split(){
  if(!active)return
  const result=splitSentenceTag(quote,groups,annotations,active.id)
  if(result){onGroupsChange(result.groups,result.annotations);setSelected(new Set(result.ids))}
 }
 return <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-50 lg:grid-cols-[minmax(0,1fr)_19rem] lg:overflow-hidden">
  <section className="min-w-0 p-4 sm:p-5 lg:overflow-y-auto" aria-label="Câu được tách thành từng từ">
   <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-xs font-medium text-slate-500"><MousePointer2 size={14}/>Ctrl + click để chọn nhiều từ</p><span className="text-xs text-slate-400">{assigned}/{words.length} tag đã phân tích</span></div>
   <div className="flex flex-wrap items-start gap-x-2 gap-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    {words.length>0&&quote.slice(0,words[0].start)&&<span className="pt-3 text-slate-500">{quote.slice(0,words[0].start)}</span>}
    {words.map((word,index)=>{
     const row=annotations[word.id],role=sentenceRoles.find(role=>role.id===row?.role),type=wordTypes.find(type=>type.id===row?.wordType)
     return <span key={word.id} className="inline-flex items-start gap-0.5"><button type="button" aria-label={(word.wordIds.length>1?'Phân tích cụm ':'Phân tích từ ')+word.text+' (từ '+(index+1)+')'} aria-pressed={selected.has(word.id)} onClick={event=>selectWord(word.id,event.ctrlKey||event.metaKey)} className={'flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-emerald-600 '+(role?.color??'border-slate-200 bg-white text-slate-800')+(selected.has(word.id)?' ring-2 ring-emerald-500 ring-offset-2':' hover:border-emerald-400 hover:shadow-sm')}><span className="text-base">{word.text}</span>{(role||type)&&<span className="flex flex-wrap justify-center gap-1 text-[10px] leading-4">{role&&<span title={role.label} className="rounded bg-white/70 px-1.5">{role.short} · {role.label}</span>}{type&&<span title={type.label} className="rounded bg-white/70 px-1.5">{type.short}</span>}</span>}{row?.note&&<span className="max-w-32 truncate text-[10px] font-normal opacity-70" title={row.note}>{row.note}</span>}</button>{word.after.trim()&&<span className="pt-3 text-slate-500">{word.after.trim()}</span>}</span>
    })}
    {!words.length&&<p className="text-sm text-slate-500">Không có từ để phân tích trong đoạn đã chọn.</p>}
   </div>
   <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2" aria-label="Chú thích vai trò trong câu">{sentenceRoles.map(role=><span key={role.id} className={'rounded-md border px-2 py-1 text-[10px] '+role.color}>{role.short} · {role.label}</span>)}</div>
   <p className="mt-4 text-xs leading-5 text-slate-400">Loại từ và vai trò trong câu được chọn độc lập. Ví dụ một danh từ có thể làm chủ ngữ hoặc tân ngữ.</p>
  </section>
  <aside className="min-w-0 border-t border-slate-200 bg-white p-4 lg:overflow-y-auto lg:border-l lg:border-t-0" aria-label="Gán nhãn cho từ">
   {!active?<div className="py-8 text-center"><Tags size={28} className="mx-auto text-emerald-600"/><h3 className="mt-3 text-sm font-semibold text-slate-700">Chọn tag trong câu</h3><p className="mt-2 text-xs leading-6 text-slate-400">Bấm để chọn một từ. Giữ Ctrl (hoặc Cmd trên Mac) và bấm để thêm hoặc bỏ từ khỏi nhóm chọn.</p></div>:<>
    <div className="mb-4 flex items-center justify-between gap-2"><div><p className="text-[10px] uppercase tracking-wide text-slate-400">{selectedWords.length>1?'ĐANG CHỌN · '+selectedWords.length+' TỪ':'ĐANG PHÂN TÍCH'}</p><h3 className="mt-1 break-words text-xl font-semibold text-slate-800">{selectedWords.map(word=>word.text).join(' ')}</h3></div><button type="button" onClick={()=>setSelected(new Set())} aria-label="Đóng bảng phân tích từ" className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X size={16}/></button></div>
    {selectedWords.length>1&&<p className="mb-4 rounded-lg bg-emerald-50 p-2 text-xs leading-5 text-emerald-800">Nhãn bạn chọn sẽ áp dụng cho cả {selectedWords.length} từ. Ghi chú riêng của mỗi từ được giữ lại.</p>}
    {selectedWords.length>1&&<div className="mb-4"><button type="button" disabled={!canMerge} onClick={merge} className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"><Combine size={16}/>Gộp thành một tag</button>{!canMerge&&<p className="mt-2 text-xs text-slate-500">Chọn các tag liền nhau để giữ đúng thứ tự câu.</p>}</div>}
    {selectedWords.length===1&&active.wordIds.length>1&&<button type="button" onClick={split} className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><Split size={16}/>Tách tag</button>}
    <fieldset><legend className="mb-2 text-xs font-semibold text-slate-700">Vai trò trong câu</legend><div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Vai trò trong câu">{sentenceRoles.map(role=><button type="button" key={role.id} role="radio" aria-checked={annotation.role===role.id} onClick={()=>update({role:annotation.role===role.id?undefined:role.id})} className={'flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs '+role.color+(annotation.role===role.id?' ring-2 ring-emerald-500':' opacity-80 hover:opacity-100')}><span className="w-5 text-[10px] font-bold">{role.short}</span>{role.label}</button>)}</div></fieldset>
    <fieldset className="mt-5"><legend className="mb-2 text-xs font-semibold text-slate-700">Loại từ</legend><div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Loại từ">{wordTypes.map(type=><button type="button" key={type.id} role="radio" aria-checked={annotation.wordType===type.id} onClick={()=>update({wordType:annotation.wordType===type.id?undefined:type.id})} className={'rounded-lg border px-2 py-2 text-left text-xs '+(annotation.wordType===type.id?'border-emerald-500 bg-emerald-50 text-emerald-800':'border-slate-200 text-slate-600 hover:bg-slate-50')}><span className="mr-1.5 text-[10px] font-semibold text-slate-400">{type.short}</span>{type.label}</button>)}</div></fieldset>
    {selectedWords.length===1&&<><label htmlFor="scratch-word-note" className="mb-2 mt-5 text-xs">Nghĩa / Ghi chú cho từ</label><textarea id="scratch-word-note" rows={3} maxLength={2000} value={annotation.note??''} onChange={event=>update({note:event.target.value})} className="w-full resize-y px-3 py-2 text-sm" placeholder="Nghĩa trong câu, cách dùng…"/></>}
    {selectedWords.some(word=>annotations[word.id])&&<button type="button" onClick={()=>{const next={...annotations};for(const word of selectedWords)for(const id of new Set([word.id,...word.wordIds]))delete next[id];onChange(next)}} className="mt-3 text-xs text-red-600 hover:underline">{selectedWords.length>1?'Xóa phân tích '+selectedWords.length+' từ':'Xóa phân tích từ này'}</button>}
   </>}
  </aside>
 </div>
}
