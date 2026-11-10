import { useState } from 'react'
import { useAuth } from './AuthProvider'
import { LoaderCircle, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase, supabaseConfigError } from './supabase'
import { googleSignInOptions } from './google-auth'

export default function GoogleAccountButton() {
  const { session, loading } = useAuth()
  const [busy, setBusy] = useState(false)
  async function login() {
    if (!supabase) {
      toast.error(supabaseConfigError || 'Điền VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY trong .env, rồi khởi động lại ứng dụng để đăng nhập Google.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth(googleSignInOptions(window.location.origin))
      if (error) throw error
    } catch {
      toast.error('Không thể đăng nhập Google. Kiểm tra Google provider và URL chuyển hướng trong Supabase.')
    } finally { setBusy(false) }
  }
  async function logout() {
    if (!supabase) return
    setBusy(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      toast.success('Đã đăng xuất. Dữ liệu trên máy được giữ lại.')
    } catch { toast.error('Không thể đăng xuất. Hãy thử lại.') }
    finally { setBusy(false) }
  }
  if (session) return <div className="flex items-center gap-2 border-l border-slate-200 pl-3"><span className="max-w-40 truncate text-sm font-medium text-slate-700" title={session.user.email}>{session.user.user_metadata.full_name || session.user.email || 'Tài khoản'}</span><Button type="button" variant="ghost" size="icon" aria-label="Đăng xuất" title="Đăng xuất" disabled={busy || loading} onClick={() => void logout()}>{busy ? <LoaderCircle className="animate-spin" size={18}/> : <LogOut size={18}/>}</Button></div>
  return <Button type="button" variant="outline" className="gap-2 self-center rounded-xl" disabled={busy || loading} onClick={() => void login()}>{busy ? <LoaderCircle size={18} className="animate-spin"/> : <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.05.97-3.38.97-2.61 0-4.83-1.76-5.62-4.12H3.05v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.38 13.93a6 6 0 0 1 0-3.86V7.48H3.05a10 10 0 0 0 0 9.04l3.33-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5L18.7 4.6A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.48l3.33 2.59A5.99 5.99 0 0 1 12 5.95Z"/></svg>}Đăng nhập bằng Google</Button>
}
