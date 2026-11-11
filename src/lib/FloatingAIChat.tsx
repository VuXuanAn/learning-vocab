import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bot, MessageCircle, X, Send, LoaderCircle, Trash2, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { chatContext, type ChatMessage } from './chat-context'
export default function FloatingAIChat(){
 const [open,setOpen]=useState(false),[messages,setMessages]=useState<ChatMessage[]>([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [container,setContainer]=useState<Element>(()=>document.fullscreenElement??document.body)
 const controller=useRef<AbortController|null>(null),input=useRef<HTMLTextAreaElement>(null),bottom=useRef<HTMLDivElement>(null),launcher=useRef<HTMLButtonElement>(null)
 useEffect(()=>{const update=()=>setContainer(document.fullscreenElement??document.body);document.addEventListener('fullscreenchange',update);return()=>{document.removeEventListener('fullscreenchange',update);controller.current?.abort();controller.current=null}},[])
 useEffect(()=>{if(open){const frame=requestAnimationFrame(()=>input.current?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame)}},[open])
 useEffect(()=>{if(open)bottom.current?.scrollIntoView({block:'nearest'})},[messages,busy,open])
 function close(){setOpen(false);requestAnimationFrame(()=>launcher.current?.focus({preventScroll:true}))}
 async function send(event:React.FormEvent){
  event.preventDefault();const text=draft.trim();if(!text||busy||text.length>3000)return
  const message:ChatMessage={id:crypto.randomUUID(),role:'user',content:text},next=[...messages,message]
  setMessages(next);setDraft('');setError('');setBusy(true)
  const abort=new AbortController();controller.current=abort
  const timer=window.setTimeout(()=>abort.abort(),65000)
  try{
   const response=await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify({messages:chatContext(next)})})
   if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('API chat chưa sẵn sàng. Khởi động lại backend hoặc deploy bản mới.')
   const payload=await response.json()
   if(!response.ok)throw new Error(typeof payload.error==='string'?payload.error:'Chưa nhận được phản hồi AI.')
   if(typeof payload.reply!=='string'||!payload.reply.trim()||payload.reply.length>10000)throw new Error('Phản hồi AI chưa hợp lệ.')
   if(controller.current!==abort)return
   setMessages(previous=>[...previous,{id:crypto.randomUUID(),role:'assistant',content:payload.reply}])
  }catch(error){
   if(controller.current!==abort)return
   setMessages(previous=>previous.filter(row=>row.id!==message.id));setDraft(text)
   setError(abort.signal.aborted?'Đã dừng chờ phản hồi. Bạn có thể gửi lại.':error instanceof Error?error.message:'Không kết nối được AI.')
  }finally{window.clearTimeout(timer);if(controller.current===abort){controller.current=null;setBusy(false)}}
 }
 return createPortal(<><button ref={launcher} type="button" className="ai-chat-launcher fixed z-40 flex size-12 items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600" aria-label={open?'Đóng chat AI':'Mở chat AI'} aria-expanded={open} aria-controls="floating-ai-chat" onClick={()=>open?close():setOpen(true)}>{open?<X size={21}/>:<MessageCircle size={23}/>}</button>{open&&<section id="floating-ai-chat" role="dialog" aria-modal="false" aria-label="Chat với AI" className="ai-chat-panel fixed z-40 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();close()}}}><div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Bot size={20}/></span><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Chat với AI</h2><p className="text-[11px] text-slate-400">Lịch sử tạm trong phiên mở ứng dụng</p></div><Button type="button" size="icon" variant="ghost" disabled={busy||!messages.length} title="Xóa cuộc trò chuyện" aria-label="Xóa cuộc trò chuyện" onClick={()=>{setMessages([]);setError('')}}><Trash2 size={16}/></Button><Button type="button" size="icon" variant="ghost" aria-label="Đóng khung chat" onClick={close}><X size={18}/></Button></div><div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4" aria-busy={busy} aria-live="polite">{!messages.length&&!busy&&<div className="py-8 text-center"><Bot size={32} className="mx-auto text-emerald-600"/><h3 className="mt-3 text-sm font-semibold">Bạn muốn hỏi gì?</h3><p className="mt-2 text-sm leading-6 text-slate-500">Hỏi nghĩa từ, ngữ pháp, cấu trúc câu hoặc nhờ AI giải thích một đoạn tiếng Anh.</p><p className="mt-3 text-xs leading-5 text-slate-400">Ứng dụng không lưu lịch sử chat lên server. Tải lại trang sẽ xóa cuộc trò chuyện.</p></div>}{messages.map(message=><div key={message.id} className={'flex '+(message.role==='user'?'justify-end':'justify-start')}><div className={'max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6 [overflow-wrap:anywhere] '+(message.role==='user'?'rounded-br-sm bg-emerald-700 text-white':'rounded-bl-sm bg-slate-100 text-slate-700')}>{message.content}</div></div>)}{busy&&<p role="status" className="flex items-center gap-2 text-xs text-slate-400"><LoaderCircle size={14} className="animate-spin"/>AI đang trả lời…</p>}<div ref={bottom}/></div><form onSubmit={event=>void send(event)} className="shrink-0 space-y-2 border-t border-slate-100 p-3">{error&&<p role="alert" className="text-xs leading-5 text-red-600">{error}</p>}<div className="flex items-end gap-2"><textarea ref={input} aria-label="Tin nhắn cho AI" rows={2} maxLength={3000} disabled={busy} className="max-h-32 min-h-12 flex-1 resize-none text-sm" value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Nhập câu hỏi…" onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form?.requestSubmit()}}}/>{busy?<Button type="button" size="icon" variant="outline" aria-label="Dừng chờ phản hồi" onClick={()=>controller.current?.abort()}><Square size={16}/></Button>:<Button type="submit" size="icon" aria-label="Gửi tin nhắn" disabled={!draft.trim()}><Send size={17}/></Button>}</div><p className="text-[10px] text-slate-400">AI có thể trả lời sai. Kiểm tra lại thông tin quan trọng.</p></form></section>}</>,container)
}
