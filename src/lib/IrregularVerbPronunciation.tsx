import { verbPronunciations, type IrregularVerb, type VerbForm } from './irregular-verbs'
import SpeakButton from './SpeakButton'

export default function IrregularVerbPronunciation({ verb, form }: { verb: IrregularVerb; form: VerbForm }) {
 return <div className="space-y-2">{verbPronunciations(verb, form).map(({word,ipa,speechText}) => <div key={word} className="flex items-start justify-between gap-2">
  <div className="min-w-0"><span className="block break-words font-semibold">{word}</span><span className="mt-1 block break-words text-xs font-normal text-slate-500">{ipa || 'Chưa có phiên âm'}</span></div>
  <SpeakButton text={speechText} iconOnly label={'Nghe '+word+' · '+(form==='base'?'V1':form==='past'?'V2':'V3')}/>
 </div>)}</div>
}
