import { Tabs } from '@base-ui/react/tabs'
import { useSearchParams } from 'react-router-dom'
import { UserRound, BookOpen, FolderOpen, DatabaseBackup, Sparkles } from 'lucide-react'
import GoogleAccountButton from '../lib/GoogleAccountButton'
import VocabularySyncButton from '../lib/VocabularySyncButton'
import { useAuth } from '../lib/AuthProvider'
import DriveSettingsPanel from '../lib/DriveSettingsPanel'
import BackupPanel from '../lib/BackupPanel'
import GeminiUsagePanel from '../lib/GeminiUsagePanel'
import PreferencesSyncStatus from '../lib/PreferencesSyncStatus'
import { useEffect, useState } from 'react'
import { Bell, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useSettings } from '../lib/settings'
import { useMeaningReminder } from '../lib/MeaningReminder'

export default function SettingsPage() {
  const [params,setParams]=useSearchParams()
  const tabs=[{id:'account',label:'Tài khoản & đồng bộ',icon:UserRound},{id:'learning',label:'Học tập',icon:BookOpen},{id:'drive',label:'Google Drive',icon:FolderOpen},{id:'backup',label:'Import / Export',icon:DatabaseBackup},{id:'ai',label:'AI',icon:Sparkles}]
  const active=tabs.some(tab=>tab.id===params.get('tab'))?params.get('tab')!:'account'
  const [visited,setVisited]=useState(()=>new Set([active]))
  function changeTab(value:unknown){
    if(typeof value!=='string'||!tabs.some(tab=>tab.id===value))return
    setVisited(previous=>new Set([...previous,value]))
    setParams(previous=>{const next=new URLSearchParams(previous);next.set('tab',value);return next},{replace:true})
  }
  const { session } = useAuth()
  const accountName = String(session?.user.user_metadata.full_name || session?.user.email || 'Tài khoản')
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
  const panels={
    account:<><section className="panel divide-y divide-slate-100"><div className="flex flex-wrap items-center justify-between gap-4 p-6"><div className="flex min-w-0 items-center gap-3"><GoogleAccountButton/><div className="min-w-0"><h2 className="font-semibold">Tài khoản</h2><p className="truncate text-sm text-slate-700">{accountName}</p><p className="truncate text-xs text-slate-500">{session?.user.email}</p></div></div></div><div className="flex flex-wrap items-center justify-between gap-4 p-6"><div><h2 className="font-semibold">Đồng bộ từ vựng</h2><p className="mt-1 text-sm text-slate-500">Đồng bộ bộ thẻ và tiến độ học với Supabase.</p></div><VocabularySyncButton/></div></section><PreferencesSyncStatus/></>,
    learning:<><section className="panel space-y-5 p-6"><div className="flex items-start justify-between gap-5"><div><Label htmlFor="reminder-enabled" className="flex items-center gap-2 text-base"><Bell size={19} />Nhắc điền nghĩa từ đã quên</Label><p className="mt-2 text-sm leading-6 text-slate-500">Chọn ngẫu nhiên trong những thẻ gần nhất được đánh giá Quên. Từ đã chuyển sang Khó/Tốt/Dễ không còn nằm trong nhóm nhắc.</p></div><Switch id="reminder-enabled" checked={settings.reminderEnabled} onCheckedChange={checked => settings.update({ reminderEnabled: checked })} /></div><div className="space-y-2"><Label htmlFor="reminder-minutes">Chu kỳ nhắc (phút)</Label><div className="flex gap-3"><Input id="reminder-minutes" type="number" min={1} max={120} step={1} value={minutes} disabled={!settings.reminderEnabled} onChange={event => { setMinutes(event.target.value); setError('') }} /><Button type="button" disabled={!settings.reminderEnabled} onClick={saveMinutes}>Lưu chu kỳ</Button></div>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<p className="text-xs text-slate-500">Đang dùng: {settings.reminderMinutes} phút/lần. Chỉ nhắc khi trang đang mở và được sử dụng; chờ nếu bạn đang ôn thẻ, nhập liệu hoặc mở popup khác.</p></div><Button type="button" variant="outline" onClick={tryQuestion}>Thử câu hỏi ngay</Button></section><section className="panel mt-5 p-6"><div className="flex items-start justify-between gap-5"><div><Label htmlFor="auto-voice" className="flex items-center gap-2 text-base"><Volume2 size={19} />Tự động phát âm khi mở thẻ</Label><p className="mt-2 text-sm leading-6 text-slate-500">Đọc một lần khi chuyển sang thẻ mới trong trang ôn tập và popup câu hỏi. Bạn vẫn có thể nghe lại bằng nút phát âm.</p><p className="mt-2 text-xs text-slate-400">Một số trình duyệt yêu cầu bấm nút nghe lần đầu trước khi cho tự động phát âm.</p></div><Switch id="auto-voice" checked={settings.autoVoice} onCheckedChange={checked => settings.update({ autoVoice: checked })} /></div></section><PreferencesSyncStatus/></>,
    drive:<DriveSettingsPanel/>,
    backup:<BackupPanel/>,
    ai:<GeminiUsagePanel/>,
  }
  return <main className="workspace-page workspace-settings gap-5 px-4 py-5 sm:px-6"><div className="shrink-0"><p className="eyebrow">CÁ NHÂN HÓA</p><h1 className="mt-2 text-3xl font-bold">Cài đặt</h1><p className="mt-2 text-sm text-slate-500">Quản lý tài khoản, dữ liệu và tùy chọn học tập.</p></div><Tabs.Root orientation="vertical" value={active} onValueChange={changeTab} className="flex min-h-0 flex-1 gap-3 overflow-hidden sm:gap-5"><Tabs.List aria-label="Nhóm cài đặt" className="flex w-40 shrink-0 flex-col gap-1 self-start rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm sm:w-56">{tabs.map(tab=><Tabs.Tab key={tab.id} value={tab.id} className="inline-flex w-full shrink-0 items-center justify-start gap-2 rounded-lg px-3 py-3 text-left text-xs font-medium sm:px-4 sm:text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600 data-active:bg-emerald-700 data-active:text-white"><tab.icon size={16}/>{tab.label}</Tabs.Tab>)}</Tabs.List>{tabs.map(tab=><Tabs.Panel key={tab.id} value={tab.id} keepMounted className="workspace-scroll min-h-0 min-w-0 flex-1 pr-1 pb-3 outline-none [&[hidden]]:hidden [&>section:first-child]:mt-0">{(visited.has(tab.id)||active===tab.id)&&panels[tab.id as keyof typeof panels]}</Tabs.Panel>)}</Tabs.Root></main>
}
