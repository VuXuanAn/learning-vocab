import { useState, type FormEvent } from 'react'
import { Check, CornerDownLeft, PencilLine } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { checkTypedAnswer, type TypedTarget } from './typed-answer'
export default function TypedAnswer({ target, revealed, disabled, onReveal, onChecked, inlineIndicator=false }: { target:TypedTarget; revealed:boolean; disabled:boolean; onReveal:()=>void;onChecked?:(matched:boolean)=>void;inlineIndicator?:boolean }) {
 const [answer,setAnswer]=useState('')
 const [checked,setChecked]=useState(false)
 function submit(event:FormEvent){
  event.preventDefault()
  if(!answer.trim()||checked||disabled)return
  setChecked(true);onChecked?.(checkTypedAnswer(answer,target));onReveal()
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur()
 }
 if(revealed&&!checked)return null
 const matched=checked&&checkTypedAnswer(answer,target)
 if(checked&&inlineIndicator)return null
 const label=target.kind==='word'?'Nhập từ / cụm từ':target.kind==='cloze'?'Điền phần còn thiếu':'Nhập nghĩa bạn nhớ'
 return <div className="mx-auto mb-6 max-w-2xl px-6">{!checked?<form onSubmit={submit} className="space-y-2"><label htmlFor="study-typed-answer" className="flex items-center gap-2 text-sm font-medium text-slate-500"><PencilLine size={15}/>{label}</label><div className="flex flex-wrap gap-2"><Input id="study-typed-answer" className="min-w-48 flex-1" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} value={answer} disabled={disabled} onChange={event=>setAnswer(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&event.nativeEvent.isComposing)event.preventDefault()}} placeholder={target.kind==='word'?'Gõ từ tương ứng với nghĩa trên…':target.kind==='cloze'?'Nhiều chỗ trống: ngăn cách bằng dấu ;':'Gõ một nghĩa tiếng Việt…'}/><Button type="submit" variant="outline" disabled={disabled||!answer.trim()}>Kiểm tra<CornerDownLeft size={14}/></Button></div></form>:matched?<div role="status" className="flex justify-center py-1"><span title="Đáp án đúng" className="inline-flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check size={20} strokeWidth={2.5}/><span className="sr-only">Đáp án đúng</span></span></div>:<div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"><p className="whitespace-pre-wrap break-words">Bạn nhập: {answer}</p><p className="mt-1 whitespace-pre-wrap break-words">Đáp án: {target.expected}</p></div>}</div>
}
