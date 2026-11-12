import LinkedCardDialog from '../lib/LinkedCardDialog'
import ReadingMatchReview, { type ReadingMatchReviewData } from '../lib/ReadingMatchReview'
import { detectReadingVocab, renderReadingHtml } from '../lib/reading-content'
import { shadowingHtml, confirmShadowingMatches } from '../lib/shadowing-storage'
import StyledSelect from '@/components/ui/styled-select'
import { useDriveConnection } from '../lib/drive-connection'
import { removeSpeakingRecording } from '../lib/speaking-delete'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { storedSpeakingReview, latestLessonScores } from '../lib/speaking-review'
import SpeakingAIReview from '../lib/SpeakingAIReview'
import ShadowingFolders from '../lib/ShadowingFolders'
import { useShadowingLibrary } from '../lib/useShadowingLibrary'
import { saveShadowingLesson, lessonForRecording } from '../lib/shadowing-storage'
import type { ShadowingLesson } from '../lib/shadowing-types'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CloudUpload, Headphones, Mic, RefreshCw, Upload, Trash2, LoaderCircle, Pencil, ScanText } from 'lucide-react'
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
export default function SpeakingPage({mode='list'}:{mode?:'list'|'detail'}){
 const navigate=useNavigate()
 const { lessonId: detailId }=useParams()
 const {session}=useAuth()
 const library=useShadowingLibrary(session?.user.id??'')
 const { accessToken:token, ready:driveReady, error:driveError, invalidate:invalidateDrive }=useDriveConnection()
 const [folderId,setFolderId]=useState('all')
 const [editor,setEditor]=useState<ShadowingLesson|null>(null)
 const [detecting,setDetecting]=useState(false)
 const [matchReview,setMatchReview]=useState<ReadingMatchReviewData|null>(null)
 const [,setParams]=useSearchParams()
 const root=useRef<HTMLElement|null>(null),abort=useRef<AbortController|null>(null)
 const noteIds=useLiveQuery(()=>db.notes.toCollection().primaryKeys())
 useEffect(()=>()=>abort.current?.abort(),[])
 const [recording,setRecording]=useState(false)
 const [busy,setBusy]=useState<string|null>(null)
 const [remote,setRemote]=useState<SpeakingRecording[]>([])
 const [speakingPane,setSpeakingPane]=useState<'content'|'recordings'>('content')
 const [search,setSearch]=useState('')
 const [error,setError]=useState('')
 const [deleting,setDeleting]=useState<SpeakingRecording|null>(null)
 const [deleteError,setDeleteError]=useState('')
 const [deletingLesson,setDeletingLesson]=useState<ShadowingLesson|null>(null)
 const [lessonDeleteError,setLessonDeleteError]=useState('')
 const [player,setPlayer]=useState<{id:string;url:string}|null>(null)
 const uploadInput=useRef<HTMLInputElement>(null)
 useEffect(()=>{abort.current?.abort();setDetecting(false);setMatchReview(null);setError('');setSpeakingPane('content')},[detailId])
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
 function newLesson(){
  const now=new Date().toISOString()
  setError('');setEditor({id:crypto.randomUUID(),ownerId:session?.user.id??'',folderId:folderId==='all'?(library.folders[0]?.id??''):folderId,title:'',referenceText:'',createdAt:now,updatedAt:now})
 }
 async function persistLesson(event:React.FormEvent){
  event.preventDefault();if(!editor||busy)return
  setBusy('lesson-save');setError('')
  try{
   const current=await db.shadowingLessons.get(editor.id)
   if(current&&current.updatedAt!==editor.updatedAt)throw new Error('Bài học đã thay đổi. Đóng và mở lại phần chỉnh sửa.')
   const saved=await saveShadowingLesson(editor)
   setEditor(null);void library.sync().catch(()=>{});navigate('/speaking/lessons/'+saved.id);toast.success('Đã lưu bài học.')
  }catch(error){setError(error instanceof Error?error.message:'Không lưu được bài học.')}
  finally{setBusy(null)}
 }
 async function detect(){
  if(!detailLesson||detecting)return
  const captured=detailLesson,controller=new AbortController();abort.current=controller;setDetecting(true);setError('')
  try{
   const detection=await detectReadingVocab(shadowingHtml(captured.referenceText),await db.notes.toArray(),controller.signal,captured.detection)
   if(controller.signal.aborted)return
   const current=await db.shadowingLessons.get(captured.id)
   if(!current||current.referenceText!==captured.referenceText)throw new Error('Hãy lưu bài học vào thư mục rồi Detect vocab lại.')
   const saved=await saveShadowingLesson({...current,detection})
   if(controller.signal.aborted)return
   if(detection.suggestions.length&&saved.detection)setMatchReview({articleId:captured.id,ownerId:captured.ownerId,detection:saved.detection,suggestions:detection.suggestions})
   toast.success('Đã tìm thấy '+new Set(detection.matches.map(match=>match.noteId)).size+' từ/cụm từ.')
   void library.sync().catch(()=>{})
  }catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Không dò được từ vựng.')}
  finally{if(abort.current===controller){abort.current=null;setDetecting(false)}}
 }
 async function moveLesson(lesson:ShadowingLesson,target:string){
  try{await saveShadowingLesson({...lesson,folderId:target});await db.speakingRecordings.filter(row=>!row.lessonId&&row.id===lesson.id).modify({lessonId:lesson.id});void library.sync().catch(()=>{});toast.success('Đã chuyển bài vào thư mục.')}catch(error){setError(error instanceof Error?error.message:'Không chuyển được bài.')}
 }
 async function keep(blob:Blob,seconds:number){
  validateAudio(blob)
  const lesson=detailLesson
  if(!lesson)throw new Error('Không tìm thấy bài học.')
  const row:SpeakingRecording={id:crypto.randomUUID(),lessonId:lesson.id,title:lesson.title,referenceText:lesson.referenceText,createdAt:new Date().toISOString(),durationSeconds:seconds,mimeType:blob.type,size:blob.size,audio:blob}
  await db.speakingRecordings.add(row);toast.success('Đã lưu bản ghi trên máy. Bạn có thể nghe lại hoặc lưu lên Drive.')
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
 const referenceText=detailLesson?.referenceText,detection=detailLesson?.detection
 const rendered=useMemo(()=>referenceText===undefined?'':renderReadingHtml(shadowingHtml(referenceText),detection,new Set(noteIds??[])),[referenceText,detection,noteIds])

 const recordCard=(row:SpeakingRecording)=><article key={row.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{row.title}</h3><p className="mt-1 text-xs text-slate-400">{new Date(row.createdAt).toLocaleString('vi-VN')} · {(row.size/1024/1024).toFixed(2)} MB{row.durationSeconds>0?' · '+row.durationSeconds+' giây':''}</p><p className="mt-2 text-xs text-emerald-700">{row.deletion?(row.deletion==='driveDeleted'?'File Drive đã xóa · chờ xóa lịch sử':'Chờ hoàn tất xóa'):row.driveFileId?(row.metadataSynced?'Đã lưu Drive & Supabase':'Đã lên Drive · lịch sử chưa đồng bộ'):'Đang lưu trên máy'}</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" disabled={!!busy||recording||!row.audio&&!driveReady} onClick={()=>void play(row)}><Headphones size={15}/>Nghe lại</Button>{(!row.driveFileId||!row.metadataSynced)&&<Button type="button" size="sm" disabled={!!busy||recording||!!row.deletion} title={!row.driveFileId&&!driveReady?driveError:undefined} onClick={()=>void save(row)}><CloudUpload size={15}/>{busy===row.id?'Đang xử lý…':row.driveFileId?'Lưu lịch sử':'Lưu lên Drive'}</Button>}{row.driveFileId&&<a className="secondary text-xs" target="_blank" rel="noopener noreferrer" href={'https://drive.google.com/file/d/'+encodeURIComponent(row.driveFileId)+'/view'}>Mở Drive</a>}<Button type="button" size="sm" variant="destructive" disabled={!!busy||recording} onClick={()=>{setDeleting(row);setDeleteError('')}}><Trash2 size={15}/>{row.deletion?'Tiếp tục xóa':'Xóa bản ghi'}</Button></div></div>{row.referenceText&&<details className="mt-3 text-sm text-slate-500"><summary className="cursor-pointer text-xs">Xem đoạn văn</summary><p className="mt-2 whitespace-pre-wrap leading-7">{row.referenceText}</p></details>}{player?.id===row.id&&<audio className="mt-4 w-full" controls autoPlay src={player.url}/>}<SpeakingAIReview recording={row} disabled={!!busy||recording||!!row.deletion} onBusy={value=>setBusy(current=>value?'review:'+row.id:current==='review:'+row.id?null:current)} loadAudio={async()=>{if(row.audio)return row.audio;if(row.driveFileId)return downloadRecording(token,row.driveFileId);throw new Error('Không tìm thấy âm thanh để review.')}}/></article>
 return <main ref={root} className="workspace-page speaking-page gap-4 px-4 py-5 sm:px-6" data-review-active={recording?'true':undefined}>
 <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">SPEAKING</p><h1 className="mt-2 text-3xl font-bold">{mode==='list'?'Danh sách bài shadowing':'Luyện shadowing'}</h1><p className="mt-2 text-sm text-slate-500">{mode==='list'?'Mở thư mục và chọn bài học để luyện tập.':'Nghe mẫu, đọc lại và lưu bản ghi ngay tại bài học.'}</p></div>{mode==='list'?<Button type="button" onClick={newLesson}><Mic size={17}/>Thêm bài học</Button>:<Link className="secondary" to="/speaking">Danh sách bài đã luyện</Link>}</div><div className={'speaking-body '+(mode==='detail'?'speaking-detail-body':'workspace-scroll space-y-5')}>
 {library.error&&<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{library.error}</p>}
 {error&&<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">{error}</p>}
 {mode==='list'&&<><div className="flex flex-wrap items-center gap-3"><Input className="min-w-48 flex-1" aria-label="Tìm bài học shadowing" placeholder="Tìm tên bài hoặc nội dung…" value={search} onChange={event=>setSearch(event.target.value)}/><Button type="button" variant="outline" disabled={!!busy} onClick={()=>void Promise.all([library.sync(),loadHistory()]).catch(()=>{})}><RefreshCw size={15}/>Làm mới</Button></div><ShadowingFolders folders={library.folders} ownerId={session?.user.id??''} selected={folderId} onSelect={setFolderId} onSync={library.sync} counts={counts} lessons={lessons} recordingCounts={recordingCounts} lessonScores={lessonScores} search={search} disabled={!!busy}/></>}
 {mode==='detail'&&<><nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-2 text-sm text-slate-500"><Link to="/speaking" className="hover:text-emerald-700 hover:underline">Shadowing</Link><span>/</span>{detailLesson&&<><span>{library.folders.find(folder=>folder.id===detailLesson.folderId)?.name??'Bài cũ'}</span><span>/</span><span className="text-slate-800">{detailLesson.title}</span></>}</nav>{detailLesson?<><div className="flex shrink-0 gap-1 rounded-xl border border-slate-200 bg-white p-1 lg:hidden" role="group" aria-label="Phần bài shadowing">{([{id:'content',label:'Nội dung'},{id:'recordings',label:'Bản ghi ('+attemptsFor(detailLesson.id).length+')'}] as const).map(pane=><button type="button" key={pane.id} aria-pressed={speakingPane===pane.id} onClick={()=>setSpeakingPane(pane.id)} className={'min-h-10 flex-1 rounded-lg text-sm font-medium '+(speakingPane===pane.id?'bg-emerald-700 text-white':'text-slate-500')}>{pane.label}</button>)}</div><div data-mobile-pane={speakingPane} className="speaking-detail-panels"><section className="panel speaking-reference-panel"><div className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b p-5"><h2 className="text-xl font-semibold">{detailLesson.title}</h2><div className="flex flex-wrap items-center gap-2"><StyledSelect disabled={recording||!!busy||detecting} aria-label="Chuyển thư mục bài học" value={detailLesson.folderId} className="w-48 text-sm" onChange={event=>void moveLesson(detailLesson,event.target.value)}><option value="" disabled>Chọn thư mục</option>{library.folders.map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}</StyledSelect><Button type="button" disabled={recording||!!busy||detecting||!!editor} onClick={()=>void detect()}>{detecting?<LoaderCircle size={15} className="animate-spin"/>:<ScanText size={15}/>}Detect vocab</Button>{!recording&&<SpeakButton text={detailLesson.referenceText} lang="en-US"/>}<Button type="button" variant="outline" disabled={recording||!!busy||detecting} onClick={()=>{setError('');setEditor(detailLesson)}}><Pencil size={15}/>Chỉnh sửa</Button><Button type="button" variant="destructive" disabled={recording||!!busy||detecting} onClick={()=>{setDeletingLesson(detailLesson);setLessonDeleteError('')}}><Trash2 size={15}/>Xóa bài học</Button></div></div><div tabIndex={0} aria-label="Nội dung bài shadowing" className="reading-content min-h-0 flex-1 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words p-6 text-sm leading-8 text-slate-600" onClick={event=>{const link=(event.target as Element).closest<HTMLElement>('[data-reading-note]');if(!link)return;event.preventDefault();if(window.getSelection()?.toString().trim())return;setParams(previous=>{const next=new URLSearchParams(previous);next.set('note',link.dataset.readingNote!);return next})}} dangerouslySetInnerHTML={{__html:rendered}}/><p className="shrink-0 border-t p-4 text-xs text-slate-400">Bấm từ gạch chân để mở thẻ từ vựng.</p></section><section className="panel speaking-recordings-panel"><div className="flex shrink-0 items-center justify-between gap-3 border-b p-5"><h2 className="font-semibold">Các lần ghi âm ({attemptsFor(detailLesson.id).length})</h2><Button type="button" variant="ghost" disabled={!!busy} onClick={()=>void loadHistory()}><RefreshCw size={15}/>Làm mới</Button></div><div className="shrink-0 space-y-3 border-b p-5"><div className="flex flex-wrap items-start gap-3"><VoiceRecorder key={detailLesson.id} disabled={!!busy||detecting||!!editor} onRecorded={keep} onRecording={setRecording}/><Button type="button" variant="outline" disabled={recording||!!busy||detecting||!!editor} onClick={()=>uploadInput.current?.click()}><Upload size={16}/>Tải file âm thanh</Button><input ref={uploadInput} type="file" className="hidden" accept="audio/*" aria-label="Tải file âm thanh" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void keep(file,0).catch(error=>setError(error instanceof Error?error.message:'Không lưu được file.'))}}/></div><p className="text-xs text-slate-400">Sau khi lưu bản ghi, bấm AI review để nhận xét và chấm điểm.</p></div><div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5" tabIndex={0} aria-label="Danh sách ghi âm">{attemptsFor(detailLesson.id).length?attemptsFor(detailLesson.id).map(recordCard):<p className="py-6 text-center text-sm text-slate-400">Chưa có bản ghi. Bấm “Bắt đầu ghi âm” hoặc tải file âm thanh để luyện bài này.</p>}</div></section></div></>:<section className="panel p-8 text-center text-sm text-slate-500">Không tìm thấy bài học hoặc bài chưa tải xong. <Button variant="ghost" onClick={()=>void Promise.all([library.sync(),loadHistory()]).catch(()=>{})}>Tải lại</Button></section>}</>}
 </div>
 <Dialog open={!!editor} onOpenChange={open=>{if(!open&&!busy)setEditor(null)}}><DialogContent showCloseButton={!busy} className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{lessons.some(row=>row.id===editor?.id)?'Chỉnh sửa bài học':'Thêm bài học'}</DialogTitle><DialogDescription>Lưu tên, thư mục và đoạn văn để luyện shadowing ngay trên trang bài học.</DialogDescription></DialogHeader>{editor&&<form onSubmit={event=>void persistLesson(event)} className="space-y-4"><div className="space-y-2"><Label htmlFor="speaking-title">Tên bài *</Label><Input id="speaking-title" required autoFocus maxLength={160} value={editor.title} onChange={event=>setEditor({...editor,title:event.target.value})}/></div><div className="space-y-2"><Label htmlFor="speaking-folder">Thư mục *</Label><StyledSelect id="speaking-folder" required value={editor.folderId} onChange={event=>setEditor({...editor,folderId:event.target.value})}><option value="" disabled>Chọn thư mục</option>{library.folders.map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}</StyledSelect>{!library.folders.length&&<p className="text-sm text-amber-700">Tạo thư mục ở danh sách bài shadowing trước khi lưu bài học.</p>}</div><div className="space-y-2"><Label htmlFor="speaking-text">Đoạn văn luyện đọc *</Label><textarea id="speaking-text" required maxLength={12000} rows={8} value={editor.referenceText} onChange={event=>setEditor({...editor,referenceText:event.target.value})}/></div>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={!!busy} onClick={()=>setEditor(null)}>Hủy</Button><Button type="submit" disabled={!!busy||!editor.folderId||!editor.title.trim()||!editor.referenceText.trim()}>Lưu bài học</Button></div></form>}</DialogContent></Dialog>
 <LinkedCardDialog portalContainer={root}/>
 {matchReview&&<ReadingMatchReview key={matchReview.articleId+matchReview.detection.createdAt} data={matchReview} onClose={()=>setMatchReview(null)} onSync={library.sync} onConfirm={matches=>confirmShadowingMatches(matchReview.articleId,matchReview.ownerId,matchReview.detection,matches).then(()=>{})}/>}

 <Dialog open={!!deleting} onOpenChange={open=>{if(!open&&!busy)setDeleting(null)}}><DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>Xóa bản ghi âm?</DialogTitle><DialogDescription>Bản ghi “{deleting?.title}”, kết quả AI review và nhận xét gắn với bản ghi sẽ bị xóa. {deleting?.driveFileId?'File âm thanh trên Google Drive cũng sẽ bị xóa vĩnh viễn, không chuyển vào thùng rác.':'File âm thanh đang lưu trên thiết bị cũng sẽ bị xóa.'} Bài học vẫn có thể luyện lại.</DialogDescription></DialogHeader>{deleteError&&<p role="alert" className="text-sm leading-6 text-red-600">{deleteError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={!!busy} onClick={()=>setDeleting(null)}>Đóng</Button><Button type="button" variant="destructive" disabled={!!busy} onClick={()=>void removeRecord()}>{busy?.startsWith('delete:')?<LoaderCircle size={15} className="animate-spin"/>:<Trash2 size={15}/>}Xác nhận xóa</Button></div></DialogContent></Dialog>
 <Dialog open={!!deletingLesson} onOpenChange={open=>{if(!open&&!busy)setDeletingLesson(null)}}><DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>Xóa bài học?</DialogTitle><DialogDescription>Bài “{deletingLesson?.title}” cùng tất cả bản ghi âm, kết quả AI review và nhận xét sẽ bị xóa. File ghi âm đã lưu trên Google Drive cũng bị xóa vĩnh viễn. Thao tác không thể hoàn tác; thư mục vẫn được giữ.</DialogDescription></DialogHeader>{lessonDeleteError&&<p role="alert" className="text-sm leading-6 text-red-600">{lessonDeleteError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={!!busy} onClick={()=>setDeletingLesson(null)}>Đóng</Button><Button type="button" variant="destructive" disabled={!!busy} onClick={()=>void removeLesson()}>{busy?.startsWith('lesson-delete:')?<LoaderCircle size={15} className="animate-spin"/>:<Trash2 size={15}/>} {lessonDeleteError?'Thử lại':'Xác nhận xóa bài'}</Button></div></DialogContent></Dialog>
 </main>
}
