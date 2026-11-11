import ReadingSources from './ReadingSources'
import RelatedWords from './RelatedWords'
﻿import type { Note } from './cards'
import { hasWordFamily } from './ai-batch'
import SpeakButton from './SpeakButton'
export default function AIVocabularyCard({ note, revealed, reversed = false, autoVoice = false }: { note: Note; revealed: boolean; reversed?: boolean; autoVoice?: boolean }) {
  const values = note.values ?? {}
  const word = values['Từ vựng'] || note.front
  const meaning = values['Nghĩa tiếng Việt'] || note.back
  const showWord = !reversed || revealed
  const details = revealed
  const family = hasWordFamily(word) ? values['Các dạng từ liên quan']?.trim() : ''
  return <div className="flex min-h-80 flex-col items-center justify-center px-6 py-10 text-center sm:px-10">
    {showWord ? <div className="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2"><h2 className="min-w-0 whitespace-pre-wrap break-words text-3xl font-bold leading-tight text-emerald-800 sm:text-4xl">{word}</h2>{values['Loại từ'] && <span className="text-base leading-tight text-slate-500">({values['Loại từ']})</span>}{values['Phiên âm IPA'] && <span className="break-words text-xl leading-tight text-slate-500">{values['Phiên âm IPA']}</span>}<SpeakButton iconOnly studyShortcut text={word} lang={note.template?.speech?.lang} rate={note.template?.speech?.rate} autoPlay={autoVoice}/></div> : <p className="whitespace-pre-wrap break-words text-3xl font-semibold text-slate-800">{meaning}</p>}
    {details && <div className="mt-5 w-full max-w-2xl space-y-5">
      <p className="whitespace-pre-wrap break-words text-xl font-semibold text-emerald-800">{meaning}</p>
      {values['Câu ví dụ'] && <div className="rounded-xl bg-slate-50 p-4"><p className="whitespace-pre-wrap break-words text-lg text-slate-700">{values['Câu ví dụ']}</p>{values['Dịch câu ví dụ'] && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-500">{values['Dịch câu ví dụ']}</p>}</div>}
      {family && <RelatedWords note={note} text={family}/>}
      <ReadingSources note={note}/>
    </div>}
  </div>
}
