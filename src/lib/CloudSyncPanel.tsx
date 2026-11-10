import { googleSignInOptions } from './google-auth'
import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useLiveQuery } from 'dexie-react-hooks'
import { Cloud, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase, supabaseConfigError } from './supabase'
import { db } from './db'
import { canUpload } from './cloud-schema'
import { exportSnapshot, localSnapshot, restoreSnapshot, uploadSnapshot } from './cloud-local'

function cloudError(error: { code?: string } | unknown) {
  const code = (error as {code?: string})?.code
  if (['42P01','PGRST205','PGRST202'].includes(code ?? '')) return 'Chưa tạo bảng/hàm Supabase. Hãy chạy file SQL trong supabase/migrations trước.'
  if (code === '40001') return 'Cloud đã thay đổi trên thiết bị khác. Tải bản mới về trước khi sao lưu tiếp.'
  if (code === 'invalid_credentials') return 'Email hoặc mật khẩu không đúng.'
  if (['provider_disabled','validation_failed'].includes(code ?? '')) return 'Chưa bật Google provider hoặc cấu hình đăng nhập chưa hợp lệ trong Supabase.'
  if (['access_denied','oauth_access_denied'].includes(code ?? '')) return 'Bạn đã hủy hoặc từ chối đăng nhập bằng Google.'
  if (['bad_oauth_state','flow_state_not_found','flow_state_expired'].includes(code ?? '')) return 'Phiên đăng nhập Google đã hết hạn. Hãy bấm đăng nhập lại trên cùng trình duyệt.'
  if (code === 'email_not_confirmed') return 'Hãy xác nhận email trước khi đăng nhập.'
  return 'Không thực hiện được thao tác. Kiểm tra kết nối, cấu hình Supabase, quyền tài khoản và thử lại.'
}
export default function CloudSyncPanel() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [remote, setRemote] = useState<{revision:number;updated_at:string} | null>(null)
  const [ready, setReady] = useState(false)
  const localState = useLiveQuery(async()=>({binding:await db.cloudMeta.get('current')}))
  const binding = localState?.binding
  const backup = useLiveQuery(()=>db.localBackups.orderBy('createdAt').last())
  useEffect(()=>{
    if (!supabase) return
    let alive = true
    void supabase.auth.getSession().then(({data,error})=>{if(alive){setSession(data.session);if(error)setError(cloudError(error))}})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next)})
    return ()=>{alive=false;subscription.unsubscribe()}
  },[])
  useEffect(()=>{
    if(!session || !supabase)return
    let alive=true
    setReady(false)
    void supabase.from('vocab_snapshots').select('revision,updated_at').eq('user_id',session.user.id).maybeSingle().then(({data,error})=>{if(alive){if(error)setError(cloudError(error));else {setRemote(data?{revision:Number(data.revision),updated_at:data.updated_at}:null);setReady(true)}}})
    return()=>{alive=false}
  },[session?.user.id])
  async function loginGoogle() {
    if (!supabase || busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      const {error} = await supabase.auth.signInWithOAuth(googleSignInOptions(window.location.origin))
      if(error) throw error
    } catch(error) { setError(cloudError(error)) }
    finally { setBusy(false) }
  }
  async function auth(event:FormEvent,signup=false){
    event.preventDefault();if(!supabase)return
    setBusy(true);setError('');setMessage('')
    try{
      const result=signup ? await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin+'/settings'}}) : await supabase.auth.signInWithPassword({email:email.trim(),password})
      if(result.error)throw result.error
      setPassword('');setMessage(signup?'Đã gửi đăng ký. Kiểm tra email để xác nhận nếu project yêu cầu.':'Đăng nhập thành công. Chọn sao lưu hoặc tải dữ liệu bên dưới.')
    }catch(error){setError(cloudError(error))}finally{setBusy(false)}
  }
  async function upload(){
    if(!supabase || !session || !ready || !localState)return
    const userId=session.user.id
    const localRevision=binding?.userId===userId?binding.revision:0
    if(!canUpload(binding?.userId || undefined,userId,localRevision,remote?.revision??0)){setError('Dữ liệu local thuộc tài khoản khác hoặc chưa tải bản cloud mới. Hãy tải về trước; local hiện tại được sao lưu tự động.');return}
    setBusy(true);setError('');setMessage('')
    try{
      const payload=await uploadSnapshot(userId,localRevision)
      if(new TextEncoder().encode(JSON.stringify(payload)).length>20*1024*1024)throw new Error('oversized')
      const {data,error}=await supabase.rpc('save_vocab_snapshot',{p_payload:payload,p_expected_revision:localRevision,p_user_id:userId})
      if(error)throw error
      const result=data?.[0]
      if(!result)throw new Error('missing-result')
      await db.cloudMeta.put({id:'current',userId,revision:Number(result.revision),lastSyncAt:result.updated_at})
      setRemote({revision:Number(result.revision),updated_at:result.updated_at});setMessage('Đã sao lưu folder, từ vựng, lịch FSRS và cài đặt lên Supabase.')
    }catch(error){setError(error instanceof Error && error.message==='oversized'?'Dữ liệu vượt giới hạn sao lưu 20 MB. Hãy xuất JSON để lưu riêng.':cloudError(error))}finally{setBusy(false)}
  }
  async function download(){
    if(!supabase || !session)return
    setBusy(true);setError('');setMessage('')
    try{
      const {data,error}=await supabase.from('vocab_snapshots').select('payload,revision,updated_at').eq('user_id',session.user.id).maybeSingle()
      if(error)throw error
      if(!data){setMessage('Tài khoản chưa có dữ liệu cloud.');return}
      await restoreSnapshot(data.payload,session.user.id,Number(data.revision))
      setRemote({revision:Number(data.revision),updated_at:data.updated_at});setReady(true);setMessage('Đã tải dữ liệu cloud. Dữ liệu local trước đó được giữ trong bản khôi phục.')
    }catch(error){setError(cloudError(error))}finally{setBusy(false)}
  }
  async function restoreLocal(){
    if(!backup)return
    setBusy(true);setError('')
    try{await restoreSnapshot(backup.payload,backup.owner?.userId??'',backup.owner?.revision??0);setMessage('Đã khôi phục bản local trước đó.')}catch{setError('Không thể khôi phục bản local.')}finally{setBusy(false)}
  }
  async function exportLocal(){try{exportSnapshot(await localSnapshot())}catch{setError('Không thể xuất dữ liệu local.')}}
  return <section className="panel mt-8 space-y-5 p-6"><h2 className="flex items-center gap-2 text-lg font-semibold"><Cloud size={20}/>Tài khoản & lưu trữ Supabase</h2>{!supabase?<div className="rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">{supabaseConfigError || 'Chưa cấu hình cloud. Điền VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY trong file .env ở thư mục gốc, rồi khởi động lại frontend. Dữ liệu local vẫn hoạt động.'}</div>:session?<><div className="rounded-xl bg-emerald-50 p-4 text-sm"><p>Đã đăng nhập: <strong>{session.user.email}</strong></p><p className="mt-2 text-xs text-slate-500">{remote?`Bản cloud #${remote.revision} · ${new Date(remote.updated_at).toLocaleString('vi-VN')}`:ready?'Chưa có bản cloud.':'Đang kiểm tra dữ liệu cloud…'}</p></div><p className="text-sm leading-6 text-slate-500">Đồng bộ thủ công. “Tải cloud về máy” thay dữ liệu trên thiết bị bằng bản cloud và giữ bản local trước đó để khôi phục. Sao lưu không tự ghi đè phiên bản mới hơn từ thiết bị khác.</p><div className="flex flex-wrap gap-3"><Button type="button" disabled={busy || !ready || !localState} onClick={()=>void upload()}>{busy&&<LoaderCircle size={16} className="animate-spin"/>}Sao lưu lên cloud</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>void download()}>Tải cloud về máy</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>{void supabase!.auth.signOut().then(({error})=>{if(error)setError(cloudError(error));else setMessage('Đã đăng xuất. Dữ liệu local được giữ lại.')})}}>Đăng xuất</Button></div></>:<div className="space-y-5"><Button type="button" variant="outline" className="w-full gap-3 py-5" disabled={busy} onClick={()=>void loginGoogle()}><svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.05.97-3.38.97-2.61 0-4.83-1.76-5.62-4.12H3.05v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.38 13.93a6 6 0 0 1 0-3.86V7.48H3.05a10 10 0 0 0 0 9.04l3.33-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5L18.7 4.6A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.48l3.33 2.59A5.99 5.99 0 0 1 12 5.95Z"/></svg>Đăng nhập bằng Google</Button><div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200"/>hoặc dùng email<span className="h-px flex-1 bg-slate-200"/></div><form className="space-y-4" onSubmit={event=>void auth(event)}><div className="space-y-2"><Label htmlFor="cloud-email">Email</Label><Input id="cloud-email" type="email" autoComplete="email" required value={email} disabled={busy} onChange={event=>setEmail(event.target.value)}/></div><div className="space-y-2"><Label htmlFor="cloud-password">Mật khẩu</Label><Input id="cloud-password" type="password" autoComplete="current-password" required minLength={8} value={password} disabled={busy} onChange={event=>setPassword(event.target.value)}/></div><div className="flex gap-3"><Button type="submit" disabled={busy}>Đăng nhập</Button><Button type="button" variant="outline" disabled={busy || !email.trim() || password.length<8} onClick={event=>{const form=event.currentTarget.closest('form');if(form?.reportValidity())void auth(event,true)}}>Đăng ký</Button></div></form></div>}{message&&<p role="status" className="text-sm leading-6 text-emerald-700">{message}</p>}{error&&<p role="alert" className="text-sm leading-6 text-red-600">{error}</p>}<div className="flex flex-wrap gap-3 border-t pt-4"><Button type="button" variant="outline" disabled={busy} onClick={()=>void exportLocal()}>Xuất dữ liệu JSON</Button>{backup&&<Button type="button" variant="outline" disabled={busy} onClick={()=>void restoreLocal()}>Khôi phục local trước lần tải gần nhất</Button>}</div></section>
}
