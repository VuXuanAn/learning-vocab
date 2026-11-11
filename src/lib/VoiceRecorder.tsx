import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { validateAudio } from './speaking'
export default function VoiceRecorder({ disabled, onRecorded, onRecording }: { disabled:boolean; onRecorded:(blob:Blob,seconds:number)=>Promise<void>;onRecording:(value:boolean)=>void }) {
 const [recording,setRecording]=useState(false)
 const [starting,setStarting]=useState(false)
 const [seconds,setSeconds]=useState(0)
 const [error,setError]=useState('')
 const recorder=useRef<MediaRecorder|null>(null)
 const stream=useRef<MediaStream|null>(null)
 const mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;recorder.current?.state==='recording'&&recorder.current.stop();stream.current?.getTracks().forEach(track=>track.stop())}},[])
 useEffect(()=>{
  if(!recording)return
  const timer=window.setInterval(()=>setSeconds(value=>{if(value>=299)recorder.current?.stop();return value+1}),1000)
  return()=>window.clearInterval(timer)
 },[recording])
 async function start(){
  if(starting||recording)return
  setStarting(true);setError('')
  try{
   if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw new Error('Trình duyệt chưa hỗ trợ ghi âm. Hãy dùng HTTPS hoặc localhost, hoặc tải file lên.')
   const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})
   if(!mounted.current){media.getTracks().forEach(track=>track.stop());return}
   stream.current=media
   const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type))
   const instance=new MediaRecorder(media,mime?{mimeType:mime}:undefined)
   recorder.current=instance
   const chunks:Blob[]=[];const started=Date.now()
   instance.ondataavailable=event=>{if(event.data.size)chunks.push(event.data)}
   instance.onerror=()=>{if(mounted.current)setError('Ghi âm bị gián đoạn. Hãy thử lại.');media.getTracks().forEach(track=>track.stop());if(instance.state==='recording')instance.stop()}
   instance.onstop=()=>{
    media.getTracks().forEach(track=>track.stop());stream.current=null
    if(!mounted.current)return
    setRecording(false);onRecording(false)
    const blob=new Blob(chunks,{type:instance.mimeType||mime||'audio/webm'})
    try{validateAudio(blob);void onRecorded(blob,Math.min(1800,Math.round((Date.now()-started)/1000))).catch(()=>setError('Chưa lưu được bản ghi. Hãy kiểm tra dung lượng trình duyệt.'))}catch(error){setError(error instanceof Error?error.message:'Bản ghi không hợp lệ.')}
   }
   instance.start(1000);setSeconds(0);setRecording(true);onRecording(true)
  }catch(error){stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;setError((error as {name?:string})?.name==='NotAllowedError'?'Bạn cần cho phép micro để ghi âm.':error instanceof Error?error.message:'Không mở được micro.')}
  finally{if(mounted.current)setStarting(false)}
 }
 return <div className="space-y-2"><div className="flex flex-wrap items-center gap-3">{recording?<Button type="button" variant="destructive" onClick={()=>recorder.current?.stop()}><Square size={16}/>Dừng và lưu bản ghi</Button>:<Button type="button" disabled={disabled||starting} onClick={()=>void start()}><Mic size={17}/>{starting?'Đang mở micro…':'Bắt đầu ghi âm'}</Button>}{recording&&<span role="status" className="text-sm font-medium text-red-600">● {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</span>}</div>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<p className="text-xs text-slate-400">Tối đa 5 phút mỗi lần. Dừng ghi để lưu trước khi rời trang.</p></div>
}
