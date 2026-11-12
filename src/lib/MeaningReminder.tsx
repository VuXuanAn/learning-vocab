import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { db } from './db'
import { useSettings } from './settings'
import { matchesMeaning, meaningQuestions, nextQuestion, reminderReady, type MeaningQuestion } from './meaning-quiz'
import SpeakButton from './SpeakButton'

const ReminderContext = createContext<() => void>(() => {})
export const useMeaningReminder = () => useContext(ReminderContext)
export default function MeaningReminderProvider({ children }: { children: ReactNode }) {
  const { reminderEnabled, reminderMinutes, autoVoice } = useSettings()
  const notes = useLiveQuery(() => db.notes.toArray())
  const reviews = useLiveQuery(() => db.reviews.toArray())
  const [question, setQuestion] = useState<MeaningQuestion | null>(null)
  const [answer, setAnswer] = useState('')
  const [checked, setChecked] = useState(false)
  const due = useRef(Date.now() + reminderMinutes * 60_000)
  const last = useRef<string | undefined>(undefined)
  const location = useLocation()
  const questions = meaningQuestions(notes ?? [], reviews ?? [])
  const pool = useRef(questions)
  pool.current = questions
  const close = useCallback(() => { setQuestion(null); setAnswer(''); setChecked(false); due.current = Date.now() + reminderMinutes * 60_000 }, [reminderMinutes])
  const show = useCallback((manual = false) => {
    const next = nextQuestion(pool.current, last.current)
    if (!next) { if (manual) toast.info('Chưa có từ phù hợp: hãy chọn Quên khi ôn một thẻ từ vựng trước.'); return }
    last.current = next.noteId
    setQuestion(next); setAnswer(''); setChecked(false)
  }, [])
  useEffect(() => { due.current = Date.now() + reminderMinutes * 60_000; if (!reminderEnabled) setQuestion(null) }, [reminderEnabled, reminderMinutes])
  useEffect(() => {
    if (!reminderEnabled || question) return
    const timer = window.setInterval(() => {
      const element = document.activeElement as HTMLElement | null
      if (!reminderReady({ now: Date.now(), due: due.current, visible: !document.hidden, focused: document.hasFocus(), hasDialog: !!document.fullscreenElement || !!document.querySelector('[data-focus-mode="true"]') || !!document.querySelector('[role="dialog"], [role="alertdialog"]'), reviewActive: !!document.querySelector('[data-review-active="true"]'), editing: !!element?.matches('input, textarea, select, [contenteditable="true"]') })) return
      due.current = Date.now() + reminderMinutes * 60_000
      show()
    }, 1000)
    return () => window.clearInterval(timer)
  }, [reminderEnabled, reminderMinutes, question, show, location.pathname])
  function submit(event: FormEvent) { event.preventDefault(); if (answer.trim()) setChecked(true) }
  const matched = question ? matchesMeaning(answer, question.meaning) : false
  return <ReminderContext value={() => show(true)}>{children}<Dialog open={!!question} onOpenChange={open => { if (!open) close() }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Ôn nhanh một từ từng quên</DialogTitle><DialogDescription>Hãy điền nghĩa trước khi xem đáp án.</DialogDescription></DialogHeader>{question && <form onSubmit={submit} className="space-y-5"><div className="rounded-xl bg-emerald-50 p-5"><div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-2 text-center"><p className="min-w-0 break-words text-3xl font-bold text-emerald-900">{question.word}</p>{question.partOfSpeech && <span className="text-base text-slate-500">({question.partOfSpeech})</span>}{question.phonetic && <span className="break-words text-lg text-slate-500">{question.phonetic}</span>}</div><div className="mt-4 flex justify-center"><SpeakButton key={question.cardId} text={question.word} lang={question.lang} rate={question.rate} autoPlay={autoVoice} /></div></div><div className="space-y-2"><Label htmlFor="meaning-answer">Nghĩa của từ này là gì?</Label><Input id="meaning-answer" autoFocus autoComplete="off" value={answer} disabled={checked} onChange={event => setAnswer(event.target.value)} placeholder="Nhập nghĩa bạn nhớ…" /></div>{checked && <div aria-live="polite" className="rounded-xl border border-slate-200 p-4"><p className={matched ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>{matched ? 'Khớp với nghĩa đã lưu' : 'Chưa khớp hoàn toàn — hãy đối chiếu đáp án'}</p><p className="mt-3 whitespace-pre-wrap text-slate-700">{question.meaning}</p><p className="mt-3 text-xs text-slate-500">Đối chiếu văn bản, chưa chấm các cách diễn đạt đồng nghĩa. Câu hỏi nhanh không thay đổi lịch FSRS.</p></div>}<DialogFooter><Button type="button" variant="outline" onClick={close}>{checked ? 'Đóng' : 'Bỏ qua'}</Button>{!checked && <Button type="submit" disabled={!answer.trim()}>Kiểm tra nghĩa</Button>}</DialogFooter></form>}</DialogContent></Dialog></ReminderContext>
}
