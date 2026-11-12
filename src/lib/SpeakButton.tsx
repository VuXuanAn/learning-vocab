import { useCallback, useEffect, useRef, useState } from 'react'
import { Square, Volume2 } from 'lucide-react'
import { toast } from 'sonner'

export const speechLanguages = [ ['en-US', 'Tiếng Anh (Mỹ)'], ['en-GB', 'Tiếng Anh (Anh)'], ['vi-VN', 'Tiếng Việt'], ['ja-JP', 'Tiếng Nhật'], ['ko-KR', 'Tiếng Hàn'], ['zh-CN', 'Tiếng Trung'], ['fr-FR', 'Tiếng Pháp'], ['de-DE', 'Tiếng Đức'] ]
export default function SpeakButton({ text, lang = 'en-US', rate = 1, autoPlay = false, iconOnly = false, studyShortcut = false, label }: { text: string; lang?: string; rate?: number; autoPlay?: boolean; iconOnly?: boolean; studyShortcut?: boolean; label?: string }) {
  const [speaking, setSpeaking] = useState(false)
  const utterance = useRef<SpeechSynthesisUtterance | null>(null)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  const stop = useCallback(() => {
    if (utterance.current) { utterance.current.onstart = null; utterance.current.onend = null; utterance.current.onerror = null; window.speechSynthesis.cancel(); utterance.current = null }
  }, [])
  const start = useCallback((automatic = false) => {
    if (!supported || !text.trim()) return
    stop(); window.speechSynthesis.cancel()
    const speech = new SpeechSynthesisUtterance(text.trim())
    speech.lang = lang; speech.rate = rate
    const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase() === lang.toLowerCase())
    if (voice) speech.voice = voice
    speech.onstart = () => setSpeaking(true)
    speech.onend = () => { setSpeaking(false); utterance.current = null }
    speech.onerror = event => {
      setSpeaking(false); utterance.current = null
      if (event.error === 'canceled' || event.error === 'interrupted') return
      if (automatic && event.error === 'not-allowed') toast.info('Bấm Nghe phát âm để cho phép trình duyệt phát giọng đọc.', { id: 'voice-permission' })
      else toast.error('Không phát được giọng đọc. Hãy kiểm tra âm lượng và ngôn ngữ trên thiết bị.', { id: 'voice-error' })
    }
    utterance.current = speech
    try { window.speechSynthesis.speak(speech) }
    catch { setSpeaking(false); toast.error('Trình duyệt không thể phát giọng đọc.', { id: 'voice-error' }) }
  }, [supported, text, lang, rate, stop])
  useEffect(() => {
    setSpeaking(false)
    const timer = autoPlay && supported ? window.setTimeout(() => start(true), 150) : undefined
    return () => { window.clearTimeout(timer); stop() }
  }, [autoPlay, supported, start, stop])
  return <div className={iconOnly ? "inline-flex shrink-0 items-center self-center leading-none" : undefined}><button type="button" data-study-speech={studyShortcut ? 'true' : undefined} className={iconOnly ? "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-40" : "secondary"} title={label || (studyShortcut ? 'Nghe phát âm (S)' : speaking ? 'Dừng đọc' : 'Nghe phát âm')} disabled={!supported || !text.trim()} onClick={() => { if (speaking) { stop(); setSpeaking(false) } else start() }} aria-label={speaking ? 'Dừng đọc' : (label || 'Nghe phát âm')}>{speaking ? <Square size={16} /> : <Volume2 size={18} />}{!iconOnly && (speaking ? 'Dừng đọc' : 'Nghe phát âm')}</button>{!supported && !iconOnly && <p className="mt-2 text-xs text-slate-500">Trình duyệt này chưa hỗ trợ giọng đọc.</p>}</div>
}
