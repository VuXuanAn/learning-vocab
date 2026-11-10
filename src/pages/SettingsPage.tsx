import CloudSyncPanel from '../lib/CloudSyncPanel'
import { useEffect, useState } from 'react'
import { Bell, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useSettings } from '../lib/settings'
import { useMeaningReminder } from '../lib/MeaningReminder'

export default function SettingsPage() {
  const settings = useSettings()
  const [minutes, setMinutes] = useState(String(settings.reminderMinutes))
  useEffect(() => setMinutes(String(settings.reminderMinutes)), [settings.reminderMinutes])
  const [error, setError] = useState('')
  const tryQuestion = useMeaningReminder()
  function saveMinutes() {
    const value = Number(minutes)
    if (!Number.isInteger(value) || value < 1 || value > 120) { setError('Nhập số nguyên từ 1 đến 120 phút.'); return }
    settings.update({ reminderMinutes: value }); setError('')
  }
  return <main className="mx-auto max-w-3xl px-6 py-10"><p className="eyebrow">CÁ NHÂN HÓA</p><h1 className="mt-2 text-3xl font-bold">Cài đặt</h1><p className="mt-3 text-slate-500">Các tùy chọn được lưu tự động trên trình duyệt này.</p><section className="panel mt-8 space-y-5 p-6"><div className="flex items-start justify-between gap-5"><div><Label htmlFor="reminder-enabled" className="flex items-center gap-2 text-base"><Bell size={19} />Nhắc điền nghĩa từ đã quên</Label><p className="mt-2 text-sm leading-6 text-slate-500">Chọn ngẫu nhiên trong những thẻ gần nhất được đánh giá Quên. Từ đã chuyển sang Khó/Tốt/Dễ không còn nằm trong nhóm nhắc.</p></div><Switch id="reminder-enabled" checked={settings.reminderEnabled} onCheckedChange={checked => settings.update({ reminderEnabled: checked })} /></div><div className="space-y-2"><Label htmlFor="reminder-minutes">Chu kỳ nhắc (phút)</Label><div className="flex gap-3"><Input id="reminder-minutes" type="number" min={1} max={120} step={1} value={minutes} disabled={!settings.reminderEnabled} onChange={event => { setMinutes(event.target.value); setError('') }} /><Button type="button" disabled={!settings.reminderEnabled} onClick={saveMinutes}>Lưu chu kỳ</Button></div>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<p className="text-xs text-slate-500">Đang dùng: {settings.reminderMinutes} phút/lần. Chỉ nhắc khi trang đang mở và được sử dụng; chờ nếu bạn đang ôn thẻ, nhập liệu hoặc mở popup khác.</p></div><Button type="button" variant="outline" onClick={tryQuestion}>Thử câu hỏi ngay</Button></section><section className="panel mt-5 p-6"><div className="flex items-start justify-between gap-5"><div><Label htmlFor="auto-voice" className="flex items-center gap-2 text-base"><Volume2 size={19} />Tự động phát âm khi mở thẻ</Label><p className="mt-2 text-sm leading-6 text-slate-500">Đọc một lần khi chuyển sang thẻ mới trong trang ôn tập và popup câu hỏi. Bạn vẫn có thể nghe lại bằng nút phát âm.</p><p className="mt-2 text-xs text-slate-400">Một số trình duyệt yêu cầu bấm nút nghe lần đầu trước khi cho tự động phát âm.</p></div><Switch id="auto-voice" checked={settings.autoVoice} onCheckedChange={checked => settings.update({ autoVoice: checked })} /></div></section><CloudSyncPanel /></main>
}
