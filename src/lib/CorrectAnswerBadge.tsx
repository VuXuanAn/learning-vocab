import { Check, X } from 'lucide-react'
export default function CorrectAnswerBadge({correct=true}:{correct?:boolean}){
 const label=correct?'Đáp án đúng':'Đáp án chưa đúng'
 const Icon=correct?Check:X
 return <span role="status" title={label} className={`inline-flex size-7 shrink-0 items-center justify-center self-center rounded-full align-middle ${correct?'bg-emerald-50 text-emerald-600':'bg-red-50 text-red-600'}`}><Icon size={16} strokeWidth={2.5}/><span className="sr-only">{label}</span></span>
}
