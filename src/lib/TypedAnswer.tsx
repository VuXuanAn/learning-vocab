import { useId, useState, type FormEvent } from 'react'
import { CornerDownLeft, PencilLine } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { checkTypedAnswer, type TypedTarget } from './typed-answer'
export default function TypedAnswer({ target, revealed, disabled, onReveal, onChecked, practice=false }: { target:TypedTarget; revealed:boolean; disabled:boolean; onReveal:()=>void;onChecked?:(matched:boolean|undefined)=>void; practice?:boolean }) {
 const inputId=useId()
 const [answer,setAnswer]=useState('')
 const [checked,setChecked]=useState(false)
 function submit(event:FormEvent){
  event.preventDefault()
  if(!answer.trim()||disabled)return
  setChecked(true);onChecked?.(checkTypedAnswer(answer,target))
  if(!revealed)onReveal()
 }
 const matched=checked&&checkTypedAnswer(answer,target)
 const label=practice?'Luyện chính tả: nhập lại từ / cụm từ':target.kind==='word'?'Nhập từ / cụm từ':target.kind==='cloze'?'Điền phần còn thiếu':'Nhập nghĩa của từ'
 return <div className="mx-auto mb-6 max-w-2xl px-6"><form onSubmit={submit} className="space-y-2"><label htmlFor={inputId} className="flex items-center gap-2 text-sm font-medium text-slate-500"><PencilLine size={15}/>{label}</label><div className="flex flex-wrap gap-2"><Input id={inputId} className="min-w-48 flex-1" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} value={answer} disabled={disabled} onChange={event=>{setAnswer(event.target.value);setChecked(false);onChecked?.(undefined)}} onKeyDown={event=>{if(event.key==='Enter'&&event.nativeEvent.isComposing)event.preventDefault()}} placeholder={target.kind==='word'?(practice?'Gõ lại từ tiếng Anh…':'Gõ từ tương ứng với nghĩa trên…'):target.kind==='cloze'?'Nhiều chỗ trống: ngăn cách bằng dấu ;':'Gõ nghĩa của từ…'}/><Button type="submit" variant="outline" disabled={disabled||!answer.trim()}>Kiểm tra<CornerDownLeft size={14}/></Button></div></form>{checked&&<div role="status" className={'mt-3 rounded-xl border px-3 py-2 text-sm '+(matched?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-amber-200 bg-amber-50 text-amber-900')}>{matched?<p>Đúng rồi!</p>:<><p className="whitespace-pre-wrap break-words">Chưa đúng. Bạn nhập: {answer}</p><p className="mt-1 whitespace-pre-wrap break-words">Đáp án: {target.expected}</p></>}</div>}</div>
}
