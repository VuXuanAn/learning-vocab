import { useState } from 'react'
import { FolderOpen, LoaderCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from './AuthProvider'
import { supabase } from './supabase'
import { useDriveConnection } from './drive-connection'
import { driveSignInOptions } from './speaking'
export default function DriveSettingsPanel(){
 const {session}=useAuth()
 const token=session?.provider_token??''
 const { ready,checking,error:driveError,initialize }=useDriveConnection()
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 async function connect(){
  if(!supabase)return
  setBusy(true);setError('')
  try{const {error}=await supabase.auth.signInWithOAuth(driveSignInOptions(window.location.origin,'/settings'));if(error)throw error}catch{setError('Chưa kết nối được Drive. Kiểm tra quyền Drive và URL /settings trong Supabase.')}finally{setBusy(false)}
 }
 return <section className="panel mt-6 space-y-4 p-6"><h2 className="flex items-center gap-2 text-lg font-semibold"><FolderOpen size={20} className="text-emerald-700"/>Google Drive</h2><p className="text-sm leading-6 text-slate-500">Lưu file ghi âm shadowing vào Drive riêng tư và nghe lại trên các thiết bị của bạn.</p><div className="flex flex-wrap items-center justify-between gap-3"><p className={'flex items-center gap-2 text-sm '+(ready?'text-emerald-700':'text-slate-500')}>{checking?<><LoaderCircle size={15} className="animate-spin"/>Đang kiểm tra kết nối…</>:ready?<><Check size={16}/>Đã kết nối</>:'Chưa kết nối hoặc cần cấp lại quyền'}</p><Button type="button" variant="outline" disabled={busy||checking||!supabase} onClick={()=>void connect()}>{busy?<LoaderCircle size={16} className="animate-spin"/>:<FolderOpen size={16}/>} {ready?'Kết nối lại Google Drive':'Kết nối Google Drive'}</Button></div>{(error||driveError&&!checking&&!!token)&&<div className="space-y-2"><p role="alert" className="text-sm text-red-600">{error||driveError}</p><Button type="button" variant="outline" disabled={busy||checking} onClick={()=>{setError('');void initialize(session?.user.id??'',token,true)}}>Kiểm tra lại kết nối</Button></div>}<p className="text-xs leading-6 text-slate-400">Ứng dụng chỉ xin quyền với file được tạo hoặc chọn qua ứng dụng. Khi quyền truy cập hết hạn, kết nối lại tại đây. Bản ghi trên máy vẫn được giữ.</p></section>
}
