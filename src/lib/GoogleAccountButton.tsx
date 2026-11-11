import { useState } from 'react'
import { useAuth } from './AuthProvider'
import { ChevronDown, LoaderCircle, LogOut, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { supabase, supabaseConfigError } from './supabase'
import { googleSignInOptions } from './google-auth'

export default function GoogleAccountButton() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
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
  if (session) {
    const name = String(session.user.user_metadata.full_name || session.user.email || 'Tài khoản')
    const initials = name.trim().split(/\s+/).slice(-2).map(part => part[0]).join('').toLocaleUpperCase('vi')
    return <DropdownMenu>
      <DropdownMenuTrigger disabled={busy || loading} aria-label={'Tài khoản: ' + name} title={name} render={<button type="button" className="flex shrink-0 items-center gap-1 rounded-full p-0.5 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"/>}>
        <span className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">{busy ? <LoaderCircle size={15} className="animate-spin"/> : initials}</span>
        <ChevronDown size={12} className="hidden sm:block"/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-64 rounded-xl p-1.5">
        <div className="px-3 py-2.5"><p className="truncate text-sm font-semibold text-slate-800">{name}</p><p className="mt-1 truncate text-xs text-slate-500">{session.user.email}</p></div>
        <DropdownMenuSeparator/>
        <DropdownMenuItem className="gap-2.5 rounded-lg px-3 py-2.5" onClick={() => navigate('/settings')}><Settings size={16}/>Cài đặt</DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 rounded-lg px-3 py-2.5" variant="destructive" disabled={busy || loading} onClick={() => void logout()}><LogOut size={16}/>Đăng xuất</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  }
  return <Button type="button" variant="outline" className="gap-2 self-center rounded-xl" disabled={busy || loading} onClick={() => void login()}>{busy ? <LoaderCircle size={18} className="animate-spin"/> : <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.05.97-3.38.97-2.61 0-4.83-1.76-5.62-4.12H3.05v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.38 13.93a6 6 0 0 1 0-3.86V7.48H3.05a10 10 0 0 0 0 9.04l3.33-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5L18.7 4.6A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.48l3.33 2.59A5.99 5.99 0 0 1 12 5.95Z"/></svg>}<span>Đăng nhập<span className="hidden sm:inline"> bằng Google</span></span></Button>
}
