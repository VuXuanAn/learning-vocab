import { CloudCheck, CloudUpload, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePreferencesSync } from './PreferencesSyncProvider'
export default function PreferencesSyncStatus() {
  const { status, retry } = usePreferencesSync()
  const missing = ['42P01', 'PGRST205', 'PGRST202', '42883'].includes((status.error as { code?: string })?.code ?? '')
  return <div className="mt-4 flex flex-wrap items-center gap-2 text-xs" role="status">{status.phase === 'saved' ? <><CloudCheck size={15} className="text-emerald-700"/><span className="text-emerald-700">Cài đặt đã đồng bộ với tài khoản Supabase.</span></> : status.phase === 'error' ? <><CloudUpload size={15} className="text-amber-700"/><span className="text-amber-700">{missing ? 'Chưa tạo bảng cài đặt. Cần chạy migration 002_user_preferences.sql trên Supabase.' : 'Chưa đồng bộ được cài đặt. Thay đổi được giữ trên máy để gửi lại.'}</span><Button type="button" size="sm" variant="outline" onClick={retry}>Thử lại</Button></> : <><LoaderCircle size={15} className="animate-spin text-slate-400"/><span className="text-slate-500">{status.phase === 'loading' ? 'Đang tải cài đặt tài khoản…' : 'Đang lưu cài đặt…'}</span></>}</div>
}
