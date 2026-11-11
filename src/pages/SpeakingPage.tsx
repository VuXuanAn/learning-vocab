import { useDriveConnection } from '../lib/drive-connection'
import { removeSpeakingRecording } from '../lib/speaking-delete'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { storedSpeakingReview, latestLessonScores } from '../lib/speaking-review'
import SpeakingAIReview from '../lib/SpeakingAIReview'
import ShadowingFolders from '../lib/ShadowingFolders'
import { useShadowingLibrary } from '../lib/useShadowingLibrary'
import { saveShadowingLesson, lessonForRecording } from '../lib/shadowing-storage'
import type { ShadowingLesson } from '../lib/shadowing-types'
import { Link, useNavigate, useParams } from 'react-router-dom'
﻿import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CloudUpload, Headphones, Mic, RefreshCw, Upload, Trash2, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { db } from '../lib/db'
import { useAuth } from '../lib/AuthProvider'
import { supabase } from '../lib/supabase'
import { validateAudio, recordingPayload, type SpeakingRecording } from '../lib/speaking'
import { uploadRecording, downloadRecording, deleteDriveRecording, DriveError } from '../lib/google-drive'
import VoiceRecorder from '../lib/VoiceRecorder'
import SpeakButton from '../lib/SpeakButton'
export default function SpeakingPage({mode='list'}:{mode?:'list'|'practice'|'detail'}){
 const navigate=useNavigate()
 const { lessonId: detailId }=useParams()
 const {session}=useAuth()
 const library=useShadowingLibrary(session?.user.id??'')
 const token=session?.provider_token??''
 const { ready:driveReady, error:driveError, invalidate:invalidateDrive }=useDriveConnection()
 const draftKey='vocab-speaking-draft-'+(session?.user.id??'')
 const [draft]=useState(()=>{try{return JSON.parse(localStorage.getItem(draftKey)||'{}')}catch{return {}}})
 const [title,setTitle]=useState(typeof draft.title==='string'?draft.title.slice(0,160):'')
 const [text,setText]=useState(typeof draft.text==='string'?draft.text.slice(0,12000):'')
 const [folderId,setFolderId]=useState<string>(mode==='practice'?(draft.folderId??''):'all')
 const [lessonId,setLessonId]=useState<string>(draft.lessonId??'')
 const lessonRef=useRef<string>(draft.lessonId??'')
 useEffect(()=>{try{localStorage.setItem(draftKey,JSON.stringify({title,text,folderId,lessonId}))}catch{/* Finished recordings are stored separately in IndexedDB. */}},[draftKey,title,text,folderId,lessonId])
 const [recording,setRecording]=useState(false)
 const [busy,setBusy]=useState<string|null>(null)
 const [remote,setRemote]=useState<SpeakingRecording[]>([])
 const [lastCreatedId,setLastCreatedId]=useState('')
 const [search,setSearch]=useState('')
 const [error,setError]=useState('')
 const [deleting,setDeleting]=useState<SpeakingRecording|null>(null)
 const [deleteError,setDeleteError]=useState('')
 const [deletingLesson,setDeletingLesson]=useState<ShadowingLesson|null>(null)
 const [lessonDeleteError,setLessonDeleteError]=useState('')
 const [player,setPlayer]=useState<{id:string;url:string}|null>(null)
 const uploadInput=useRef<HTMLInputElement>(null)
 const local=useLiveQuery(()=>db.speakingRecordings.orderBy('createdAt').reverse().toArray())
 useEffect(()=>()=>{if(player)URL.revokeObjectURL(player.url)},[player])
 async function loadHistory(){
  if(!supabase||!session)return
  setError('')
  const {data,error}=await supabase.from('speaking_recordings').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(500)
  if(error){setError(['42P01','PGRST205'].includes(error.code)?'Cần chạy file 007_speaking_recordings.sql trên Supabase để lưu lịch sử. Bản ghi trên máy vẫn hoạt động.':'Chưa tải được lịch sử trên Supabase.');return}
  setRemote((data??[]).map(row=>({id:row.id,aiReview:storedSpeakingReview(row.ai_review),lessonId:row.lesson_id??undefined,title:row.title,referenceText:row.reference_text,createdAt:row.created_at,durationSeconds:row.duration_seconds,mimeType:row.mime_type,size:row.byte_size,driveFileId:row.drive_file_id,metadataSynced:true})))
 }
 useEffect(()=>{void loadHistory()},[session?.user.id])
 function openLesson(lesson:ShadowingLesson){
  localStorage.setItem(draftKey,JSON.stringify({title:lesson.title,text:lesson.referenceText,folderId:lesson.folderId,lessonId:lesson.id}))
  navigate('/speaking/practice')
 }
 function repeat(row:SpeakingRecording){openLesson(lessonForRecording(row,library.lessons,session?.user.id??''))}
 function newLesson(){localStorage.setItem(draftKey,JSON.stringify({title:'',text:'',folderId:folderId==='all'?'':folderId,lessonId:''}));navigate('/speaking/practice')}
 async function persistLesson(){
  if(!lessonRef.current)lessonRef.current=crypto.randomUUID()
  const previous=library.lessons.find(row=>row.id===lessonId)
  const row=await saveShadowingLesson({id:lessonRef.current,ownerId:session?.user.id??'',folderId:folderId==='all'?'':folderId,title:title.trim(),referenceText:text.trim(),createdAt:previous?.createdAt??new Date().toISOString(),updatedAt:new Date().toISOString()})
  setLessonId(row.id);void library.sync().catch(()=>{});return row
 }
 async function moveLesson(lesson:ShadowingLesson,target:string){
  try{await saveShadowingLesson({...lesson,folderId:target});await db.speakingRecordings.filter(row=>!row.lessonId&&row.id===lesson.id).modify({lessonId:lesson.id});void library.sync().catch(()=>{});toast.success('Đã chuyển bài vào thư mục.')}catch(error){setError(error instanceof Error?error.message:'Không chuyển được bài.')}
 }
 async function keep(blob:Blob,seconds:number){
  validateAudio(blob)
  const lesson=await persistLesson()
  const row:SpeakingRecording={id:crypto.randomUUID(),lessonId:lesson.id,title:title.trim()||'Bài luyện nói '+new Date().toLocaleString('vi-VN'),referenceText:text.trim(),createdAt:new Date().toISOString(),durationSeconds:seconds,mimeType:blob.type,size:blob.size,audio:blob}
  await db.speakingRecordings.add(row);setLastCreatedId(row.id);toast.success('Đã lưu bản ghi trên máy. Bạn có thể nghe lại hoặc lưu lên Drive.')
 }
 async function save(row:SpeakingRecording){
  if(busy||!session||!supabase)return
  if(!row.driveFileId&&!driveReady){setError(driveError+' Mở Cài đặt → Google Drive → Kết nối Google Drive.');return}
  setBusy(row.id);setError('')
  try{
   const lesson=lessonForRecording(row,library.lessons,session.user.id)
   if(!lesson.folderId)throw new Error('Chọn thư mục cho bài học trước khi lưu Drive.')
   await library.sync()
   let saved={...row,lessonId:lesson.id}
   if(!saved.driveFileId){saved.driveFileId=await uploadRecording(token,saved);await db.speakingRecordings.put(saved)}
   const {error}=await supabase.from('speaking_recordings').upsert(recordingPayload(saved,session.user.id),{onConflict:'id'})
   if(error)throw new Error('File đã ở trên Drive; lịch sử chưa lưu vào Supabase. Chạy migration 007 và 008 rồi bấm Lưu lịch sử để thử lại.')
   saved.metadataSynced=true;await db.speakingRecordings.put(saved);await loadHistory();toast.success('Đã lưu bản ghi lên Drive và lịch sử lên Supabase.')
  }catch(error){if(error instanceof DriveError&&error.reconnect)invalidateDrive(error.message);setError(error instanceof Error?error.message:'Không lưu được bản ghi.')}
  finally{setBusy(null)}
 }
 async function removeRecord(){
  if(!deleting||busy||!session)return
  const row=deleting
  setBusy('delete:'+row.id);setDeleteError('')
  const rpc=async(checkOnly:boolean)=>{
   if(!supabase)throw new Error('Hãy đăng nhập và thử lại.')
   const {error}=await supabase.rpc('delete_shadowing_recording',{p_recording_id:row.id,p_check_only:checkOnly})
   if(error)throw new Error(['PGRST202','42883','42501'].includes(error.code)?'Chưa có quyền xóa bản ghi trên Supabase. Hãy chạy migration 010_delete_speaking_recordings.sql rồi thử lại.':'Chưa xóa được lịch sử trên Supabase. Bản trên máy vẫn giữ để thử lại.')
  }
  try{
   await removeSpeakingRecording(row,{check:()=>rpc(true),removeFile:id=>deleteDriveRecording(token,id),removeMetadata:()=>rpc(false)})
   if(player?.id===row.id)setPlayer(null)
   setRemote(previous=>previous.filter(item=>item.id!==row.id))
   if(lastCreatedId===row.id)setLastCreatedId('')
   setDeleting(null);toast.success(row.driveFileId?'Đã xóa bản ghi và file trên Google Drive.':'Đã xóa bản ghi trên máy.')
  }catch(error){if(error instanceof DriveError&&error.reconnect)invalidateDrive(error.message);const pending=await db.speakingRecordings.get(row.id).catch(()=>undefined);setDeleteError((pending?.deletion==='driveDeleted'?'File Drive đã được xóa. Cần tiếp tục xóa lịch sử: ':'')+(error instanceof Error?error.message:'Chưa hoàn tất xóa. Hãy thử lại.'))}
  finally{setBusy(null)}
 }
 async function removeLesson(){
  if(!deletingLesson||busy||!session||!supabase)return
  const lesson=deletingLesson,client=supabase
  setBusy('lesson-delete:'+lesson.id);setLessonDeleteError('')
  try{
   await library.exclusive(async()=>{
    const ownership=await client.from('shadowing_lessons').select('id,owner_id').eq('id',lesson.id).maybeSingle()
    if(ownership.error)throw new Error('Chưa kiểm tra được quyền xóa bài trên Supabase. Kiểm tra kết nối rồi thử lại.')
    if(lesson.ownerId!==session.user.id||(ownership.data&&ownership.data.owner_id!==session.user.id))throw new Error('Chỉ chủ sở hữu mới có thể xóa bài học.')
    const all=new Map<string,SpeakingRecording>()
    // Fetch every attempt, including recordings outside the latest 500 shown in the list.
    for(let offset=0;;offset+=500){
     const result=await client.from('speaking_recordings').select('*').eq('user_id',session.user.id).eq('lesson_id',lesson.id).order('id').range(offset,offset+499)
     if(result.error)throw new Error('Chưa tải đủ bản ghi của bài học. Chưa xóa bài; hãy thử lại.')
     for(const r of result.data??[])all.set(r.id,{id:r.id,lessonId:r.lesson_id,title:r.title,referenceText:r.reference_text,createdAt:r.created_at,durationSeconds:r.duration_seconds,mimeType:r.mime_type,size:r.byte_size,driveFileId:r.drive_file_id,metadataSynced:true})
     if((result.data?.length??0)<500)break
    }
    for(const row of await db.speakingRecordings.filter(r=>(r.lessonId??r.id)===lesson.id).toArray())all.set(row.id,{...all.get(row.id),...row})
    for(const row of all.values()){
     const rpc=async(checkOnly:boolean)=>{const result=await client.rpc('delete_shadowing_recording',{p_recording_id:row.id,p_check_only:checkOnly});if(result.error)throw new Error('Chưa xóa được bản ghi trên Supabase. Kiểm tra migration 010 và thử lại.')}
     await removeSpeakingRecording(row,{check:()=>rpc(true),removeFile:id=>deleteDriveRecording(token,id),removeMetadata:()=>rpc(false)})
     setRemote(previous=>previous.filter(item=>item.id!==row.id))
     setPlayer(previous=>previous?.id===row.id?null:previous)
    }
    const result=await client.from('shadowing_lessons').delete().eq('id',lesson.id).eq('owner_id',session.user.id)
    if(result.error)throw new Error('Chưa xóa được bài học. Có thể còn bản ghi mới từ thiết bị khác; hãy thử lại.')
    await db.shadowingLessons.delete(lesson.id)
   })
   try{const saved=JSON.parse(localStorage.getItem(draftKey)||'{}');if(saved.lessonId===lesson.id)localStorage.removeItem(draftKey)}catch{/* Ignore unavailable draft storage. */}
   setDeletingLesson(null);toast.success('Đã xóa bài học và các bản ghi liên quan.');if(mode==='detail')navigate('/speaking')
  }catch(error){if(error instanceof DriveError&&error.reconnect)invalidateDrive(error.message);setLessonDeleteError((error instanceof Error?error.message:'Chưa hoàn tất xóa.')+' Những mục đã xóa không thể khôi phục. Bấm thử lại để tiếp tục các mục còn lại.')}
  finally{setBusy(null)}
 }
 async function play(row:SpeakingRecording){
  if(busy)return
  setBusy(row.id);setError('')
  try{const blob=row.audio??(row.driveFileId?await downloadRecording(token,row.driveFileId):null);if(!blob)throw new Error('Không tìm thấy file âm thanh.');setPlayer({id:row.id,url:URL.createObjectURL(blob)})}
  catch(error){if(error instanceof DriveError&&error.reconnect)invalidateDrive(error.message);setError(error instanceof Error?error.message:'Không mở được bản ghi.')}
  finally{setBusy(null)}
 }
 const merged=new Map(remote.map(row=>[row.id,row]));for(const row of local??[])merged.set(row.id,{...merged.get(row.id),...row})
 const history=[...merged.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
 const lessonMap=new Map(library.lessons.map(row=>[row.id,row]))
 for(const row of history){const lesson=lessonForRecording(row,library.lessons,session?.user.id??'');if(!lessonMap.has(lesson.id))lessonMap.set(lesson.id,lesson)}
 const lessons=[...lessonMap.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
 const counts=new Map<string,number>();for(const lesson of lessons)counts.set(lesson.folderId,(counts.get(lesson.folderId)??0)+1)
 const detailLesson=lessons.find(row=>row.id===detailId)
 const attemptsFor=(id:string)=>history.filter(row=>(row.lessonId??row.id)===id)
 const lessonScores=latestLessonScores(history)
 const recordingCounts=new Map(lessons.map(lesson=>[lesson.id,attemptsFor(lesson.id).length]))
 const shownHistory=history.filter(row=>row.id===lastCreatedId)

 const recordCard=(row:SpeakingRecording)=><article key={row.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{row.title}</h3><p className="mt-1 text-xs text-slate-400">{new Date(row.createdAt).toLocaleString('vi-VN')} · {(row.size/1024/1024).toFixed(2)} MB{row.durationSeconds>0?' · '+row.durationSeconds+' giây':''}</p><p className="mt-2 text-xs text-emerald-700">{row.deletion?(row.deletion==='driveDeleted'?'File Drive đã xóa · chờ xóa lịch sử':'Chờ hoàn tất xóa'):row.driveFileId?(row.metadataSynced?'Đã lưu Drive & Supabase':'Đã lên Drive · lịch sử chưa đồng bộ'):'Đang lưu trên máy'}</p></div><div className="flex flex-wrap gap-2">{mode!=='practice'&&<Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={()=>repeat(row)}>Luyện lại</Button>}<Button type="button" variant="outline" size="sm" disabled={!!busy||recording||!row.audio&&!driveReady} onClick={()=>void play(row)}><Headphones size={15}/>Nghe lại</Button>{(!row.driveFileId||!row.metadataSynced)&&<Button type="button" size="sm" disabled={!!busy||recording||!!row.deletion} title={!row.driveFileId&&!driveReady?driveError:undefined} onClick={()=>void save(row)}><CloudUpload size={15}/>{busy===row.id?'Đang xử lý…':row.driveFileId?'Lưu lịch sử':'Lưu lên Drive'}</Button>}{row.driveFileId&&<a className="secondary text-xs" target="_blank" rel="noopener noreferrer" href={'https://drive.google.com/file/d/'+encodeURIComponent(row.driveFileId)+'/view'}>Mở Drive</a>}<Button type="button" size="sm" variant="destructive" disabled={!!busy||recording} onClick={()=>{setDeleting(row);setDeleteError('')}}><Trash2 size={15}/>{row.deletion?'Tiếp tục xóa':'Xóa bản ghi'}</Button></div></div>{row.referenceText&&<details className="mt-3 text-sm text-slate-500"><summary className="cursor-pointer text-xs">Xem đoạn văn</summary><p className="mt-2 whitespace-pre-wrap leading-7">{row.referenceText}</p></details>}{player?.id===row.id&&<audio className="mt-4 w-full" controls autoPlay src={player.url}/>}<SpeakingAIReview recording={row} disabled={!!busy||recording||!!row.deletion} onBusy={value=>setBusy(current=>value?'review:'+row.id:current==='review:'+row.id?null:current)} loadAudio={async()=>{if(row.audio)return row.audio;if(row.driveFileId)return downloadRecording(token,row.driveFileId);throw new Error('Không tìm thấy âm thanh để review.')}}/></article>
 return <main className="w-full min-w-0 space-y-6 px-4 py-8 sm:px-6" data-review-active={recording?'true':undefined}>
 <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">SPEAKING</p><h1 className="mt-2 text-3xl font-bold">{mode==='list'?'Danh sách bài shadowing':mode==='detail'?'Chi tiết bài học':'Luyện shadowing'}</h1><p className="mt-2 text-sm text-slate-500">{mode==='list'?'Mở thư mục và chọn bài học để xem chi tiết.':mode==='detail'?'Nội dung bài học và các lần ghi âm.':'Nghe mẫu, đọc lại và lưu bản ghi của bạn.'}</p></div>{mode==='list'?<Button type="button" onClick={newLesson}><Mic size={17}/>Luyện bài mới</Button>:<Link className="secondary" to="/speaking">Danh sách bài đã luyện</Link>}</div>{mode==='practice'&&<p className="text-xs leading-6 text-slate-500">Sau khi dừng ghi âm hoặc tải file, bấm <strong>AI review</strong> ở bản ghi bên dưới để được nhận xét và chấm điểm tham khảo.</p>}
 {!driveReady&&<p className="text-xs leading-6 text-amber-700">{driveError}  <Link to="/settings" className="font-medium text-emerald-700 underline underline-offset-2">Kết nối Google Drive trong Cài đặt</Link>. Bản ghi trên máy vẫn nghe được.</p>}
 {library.error&&<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{library.error}</p>}
 {error&&<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">{error}</p>}
 {mode==='practice'&&<ShadowingFolders folders={library.folders} ownerId={session?.user.id??''} selected={folderId} onSelect={setFolderId} onSync={library.sync} counts={counts} disabled={recording||!!busy} compact/>}
 {mode==='practice'&&<section className="panel space-y-5 p-6"><div className="space-y-2"><Label htmlFor="speaking-title">Tên bài</Label><Input id="speaking-title" maxLength={160} disabled={recording} placeholder="Ví dụ: A day at work" value={title} onChange={event=>setTitle(event.target.value)}/></div><div className="space-y-2"><Label htmlFor="speaking-text">Đoạn văn luyện đọc</Label><textarea id="speaking-text" maxLength={12000} disabled={recording} rows={6} placeholder="Dán đoạn văn bạn muốn luyện shadowing…" value={text} onChange={event=>setText(event.target.value)}/></div><div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" disabled={recording||!!busy} onClick={()=>void persistLesson().then(()=>toast.success('Đã lưu bài học.')).catch(error=>setError(error instanceof Error?error.message:'Không lưu được bài.'))}>Lưu bài học</Button>{text.trim()&&!recording&&<SpeakButton text={text} lang="en-US"/>}</div><div className="flex flex-wrap items-start justify-between gap-4 border-t pt-5"><VoiceRecorder disabled={!!busy||!folderId||folderId==='all'||!title.trim()||!text.trim()} onRecorded={keep} onRecording={setRecording}/><Button type="button" variant="outline" disabled={recording||!!busy||!folderId||folderId==='all'||!title.trim()||!text.trim()} onClick={()=>uploadInput.current?.click()}><Upload size={16}/>Tải file âm thanh</Button><input ref={uploadInput} type="file" className="hidden" accept="audio/*" aria-label="Tải file âm thanh" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void keep(file,0).catch(error=>setError(error instanceof Error?error.message:'Không lưu được file.'))}}/></div></section>}
 {mode==='list'&&<><div className="flex flex-wrap items-center gap-3"><Input className="min-w-48 flex-1" aria-label="Tìm bài học shadowing" placeholder="Tìm tên bài hoặc nội dung…" value={search} onChange={event=>setSearch(event.target.value)}/><Button type="button" variant="outline" disabled={!!busy} onClick={()=>void Promise.all([library.sync(),loadHistory()]).catch(()=>{})}><RefreshCw size={15}/>Làm mới</Button></div><ShadowingFolders folders={library.folders} ownerId={session?.user.id??''} selected={folderId} onSelect={setFolderId} onSync={library.sync} counts={counts} lessons={lessons} recordingCounts={recordingCounts} lessonScores={lessonScores} search={search} disabled={!!busy}/></>}
 {mode==='detail'&&<><nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-2 text-sm text-slate-500"><Link to="/speaking" className="hover:text-emerald-700 hover:underline">Shadowing</Link><span>/</span>{detailLesson&&<><span>{library.folders.find(folder=>folder.id===detailLesson.folderId)?.name??'Bài cũ'}</span><span>/</span><span className="text-slate-800">{detailLesson.title}</span></>}</nav>{detailLesson?<><section className="panel space-y-5 p-6"><div className="flex flex-wrap items-start justify-between gap-4"><h2 className="text-xl font-semibold">{detailLesson.title}</h2><div className="flex flex-wrap items-center gap-2"><select disabled={!!busy} aria-label="Chuyển thư mục bài học" value={detailLesson.folderId} className="w-48 text-sm" onChange={event=>void moveLesson(detailLesson,event.target.value)}><option value="" disabled>Chọn thư mục</option>{library.folders.map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><Button type="button" disabled={!!busy} onClick={()=>openLesson(detailLesson)}><Mic size={15}/>Luyện bài này</Button><Button type="button" variant="destructive" disabled={!!busy} onClick={()=>{setDeletingLesson(detailLesson);setLessonDeleteError('')}}><Trash2 size={15}/>Xóa bài học</Button></div></div><p className="whitespace-pre-wrap text-sm leading-8 text-slate-600">{detailLesson.referenceText}</p><SpeakButton text={detailLesson.referenceText} lang="en-US"/></section><section className="panel space-y-4 p-6"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Các lần ghi âm ({attemptsFor(detailLesson.id).length})</h2><Button type="button" variant="ghost" disabled={!!busy} onClick={()=>void loadHistory()}><RefreshCw size={15}/>Làm mới</Button></div>{attemptsFor(detailLesson.id).length?attemptsFor(detailLesson.id).map(recordCard):<p className="py-6 text-center text-sm text-slate-400">Chưa có bản ghi. Bấm “Luyện bài này” để bắt đầu.</p>}</section></>:<section className="panel p-8 text-center text-sm text-slate-500">Không tìm thấy bài học hoặc bài chưa tải xong. <Button variant="ghost" onClick={()=>void Promise.all([library.sync(),loadHistory()]).catch(()=>{})}>Tải lại</Button></section>}</>}
 {mode==='practice'&&lastCreatedId&&<section className="panel p-6"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><Mic size={19}/>Bản ghi vừa tạo</h2><Button type="button" variant="ghost" size="sm" disabled={!!busy} onClick={()=>void loadHistory()}><RefreshCw size={14}/>Làm mới</Button></div> {!shownHistory.length?<p className="py-8 text-center text-sm text-slate-400">{search?'Không tìm thấy bài phù hợp.':'Chưa có bản ghi. Bắt đầu luyện bài mới để tạo bản ghi đầu tiên.'}</p>:<div className="space-y-3">{shownHistory.map(recordCard)}</div>}</section>}
 <Dialog open={!!deleting} onOpenChange={open=>{if(!open&&!busy)setDeleting(null)}}><DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>Xóa bản ghi âm?</DialogTitle><DialogDescription>Bản ghi “{deleting?.title}”, kết quả AI review và nhận xét gắn với bản ghi sẽ bị xóa. {deleting?.driveFileId?'File âm thanh trên Google Drive cũng sẽ bị xóa vĩnh viễn, không chuyển vào thùng rác.':'File âm thanh đang lưu trên thiết bị cũng sẽ bị xóa.'} Bài học vẫn có thể luyện lại.</DialogDescription></DialogHeader>{deleteError&&<p role="alert" className="text-sm leading-6 text-red-600">{deleteError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={!!busy} onClick={()=>setDeleting(null)}>Đóng</Button><Button type="button" variant="destructive" disabled={!!busy} onClick={()=>void removeRecord()}>{busy?.startsWith('delete:')?<LoaderCircle size={15} className="animate-spin"/>:<Trash2 size={15}/>}Xác nhận xóa</Button></div></DialogContent></Dialog>
 <Dialog open={!!deletingLesson} onOpenChange={open=>{if(!open&&!busy)setDeletingLesson(null)}}><DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>Xóa bài học?</DialogTitle><DialogDescription>Bài “{deletingLesson?.title}” cùng tất cả bản ghi âm, kết quả AI review và nhận xét sẽ bị xóa. File ghi âm đã lưu trên Google Drive cũng bị xóa vĩnh viễn. Thao tác không thể hoàn tác; thư mục vẫn được giữ.</DialogDescription></DialogHeader>{lessonDeleteError&&<p role="alert" className="text-sm leading-6 text-red-600">{lessonDeleteError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={!!busy} onClick={()=>setDeletingLesson(null)}>Đóng</Button><Button type="button" variant="destructive" disabled={!!busy} onClick={()=>void removeLesson()}>{busy?.startsWith('lesson-delete:')?<LoaderCircle size={15} className="animate-spin"/>:<Trash2 size={15}/>} {lessonDeleteError?'Thử lại':'Xác nhận xóa bài'}</Button></div></DialogContent></Dialog>
 </main>
}
