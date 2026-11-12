import type { IrregularVerb, VerbForm } from './irregular-verbs'
import IrregularVerbPronunciation from './IrregularVerbPronunciation'
import SpeakButton from './SpeakButton'

export default function IrregularVerbDetails({ verb }: { verb: IrregularVerb }) {
 return <div className="space-y-5 p-6">
  <div className="flex items-center gap-3"><h2 className="text-3xl font-semibold text-emerald-900">{verb.base}</h2><SpeakButton text={verb.base} iconOnly/></div>
  <p className="text-lg text-slate-700">{verb.meaning}</p>
  <dl className="grid gap-3 sm:grid-cols-3">{([['V1 · Nguyên mẫu','base'],['V2 · Quá khứ','past'],['V3 · Quá khứ phân từ','participle']] as [string,VerbForm][]).map(([label,form])=><div key={label} className="rounded-xl border border-emerald-100 bg-emerald-50 p-4"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-2 text-emerald-900"><IrregularVerbPronunciation verb={verb} form={form}/></dd></div>)}</dl>
  <p className="text-xs leading-5 text-slate-500">IPA Anh–Mỹ · Giọng đọc từ thiết bị. Dấu / phân cách các dạng được chấp nhận. Mục tra cứu động từ bất quy tắc không tham gia ôn tập.</p>
 </div>
}
