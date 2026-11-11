import { useState, type FormEvent } from 'react'
import { Check, CornerDownLeft, PencilLine } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { checkTypedAnswer, type TypedTarget } from './typed-answer'
export default function TypedAnswer({ target, revealed, disabled, onReveal }: { target:TypedTarget; revealed:boolean; disabled:boolean; onReveal:()=>void }) {
 const [answer,setAnswer]=useState('')
 const [checked,setChecked]=useState(false)
 function submit(event:FormEvent){
  event.preventDefault()
  if(!answer.trim()||checked||disabled)return
  setChecked(true);onReveal()
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur()
 }
 if(revealed&&!checked)return null
 const matched=checked&&checkTypedAnswer(answer,target)
 const label=target.kind==='word'?'Nhập từ / cụm từ':target.kind==='cloze'?'Điền phần còn thiếu':'Nhập nghĩa bạn nhớ'
 return <div className="mx-auto mb-6 max-w-2xl px-6">{!checked?<form onSubmit={submit} className="space-y-2"><label htmlFor="study-typed-answer" className="flex items-center gap-2 text-sm font-medium text-slate-500"><PencilLine size={15}/>{label}</label><div className="flex flex-wrap gap-2"><Input id="study-typed-answer" className="min-w-48 flex-1" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} value={answer} disabled={disabled} onChange={event=>setAnswer(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&event.nativeEvent.isComposing)event.preventDefault()}} placeholder={target.kind==='word'?'Gõ từ tương ứng với nghĩa trên…':target.kind==='cloze'?'Nhiều chỗ trống: ngăn cách bằng dấu ;':'Gõ một nghĩa tiếng Việt…'}/><Button type="submit" variant="outline" disabled={disabled||!answer.trim()}>Kiểm tra<CornerDownLeft size={14}/></Button></div></form>:<div role="status" className={'rounded-xl border p-4 text-sm '+(matched?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-amber-200 bg-amber-50 text-amber-900')}><p className="flex items-center gap-2 font-semibold">{matched&&<Check size={16}/>} {matched?'Khớp đáp án đã lưu':'Chưa khớp — hãy đối chiếu đáp án'}</p><p className="mt-2 whitespace-pre-wrap break-words">Bạn nhập: {answer}</p>{!matched&&<p className="mt-1 whitespace-pre-wrap break-words">Đáp án: {target.expected}</p>}{target.kind==='meaning'&&<p className="mt-2 text-xs opacity-75">Đối chiếu văn bản; chưa chấm các cách diễn đạt đồng nghĩa ngoài đáp án đã lưu.</p>}</div>}</div>
}
