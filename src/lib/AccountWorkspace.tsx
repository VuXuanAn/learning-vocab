import { useEffect, useState, type ReactNode } from 'react'
import { prepareAccountWorkspace } from './account-workspace'
import { Button } from '@/components/ui/button'
export default function AccountWorkspace({ userId, children }: { userId: string; children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setReady(false); setError(false)
    void prepareAccountWorkspace(userId).then(() => { if (active) setReady(true) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [userId, attempt])
  if (error) return <main className="mx-auto max-w-xl space-y-4 px-6 py-16 text-center"><h1 className="text-xl font-semibold">Chưa mở được kho từ vựng</h1><p role="alert" className="text-sm leading-6 text-slate-500">Kiểm tra kết nối và bảo đảm đã chạy file SQL Supabase. Dữ liệu đang có trên máy vẫn được giữ nguyên.</p><Button onClick={() => setAttempt(value => value + 1)}>Thử lại</Button></main>
  if (!ready) return <main role="status" className="p-12 text-center text-slate-500">Đang mở kho từ vựng của bạn…</main>
  return children
}
