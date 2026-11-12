import { requestGrammarGeneration } from './grammar-generation'
import GrammarTextEditor from './GrammarTextEditor'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Eye, Copy, Upload, PencilLine, Sparkles, LoaderCircle, Square } from 'lucide-react'
import { toast } from 'sonner'
import { parseGrammarImport } from './grammar-json'
import { grammarImportPrompt } from './grammar-import-prompt'
import { withGrammarDocument } from './grammar-document'
import { grammarEntryHtml, grammarHtmlLimit, prepareGrammarHtml } from './grammar-html'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { GrammarEntry } from './grammar-types'

export default function GrammarFields({value,onChange,disabled=false,onGenerating,folderControl}:{value:GrammarEntry;onChange:(value:GrammarEntry)=>void;disabled?:boolean;onGenerating?:(value:boolean)=>void;folderControl?:ReactNode}) {
 const [mode,setMode]=useState<'editor'|'preview'>('editor')
 const [importOpen,setImportOpen]=useState(false),[json,setJson]=useState(''),[importError,setImportError]=useState('')
 const [generating,setGenerating]=useState(false),[generationError,setGenerationError]=useState('')
 const abort=useRef<AbortController|null>(null),latest=useRef(value)
 latest.current=value
 useEffect(()=>()=>{const controller=abort.current;abort.current=null;controller?.abort();onGenerating?.(false)},[onGenerating])
 async function generate(){
  if(abort.current||disabled||!value.title.trim())return
  const controller=new AbortController();abort.current=controller;setGenerating(true);onGenerating?.(true);setGenerationError('')
  let timedOut=false
  const timer=setTimeout(()=>{timedOut=true;controller.abort()},55000)
  try{
   const generated=await requestGrammarGeneration(value.title,controller.signal)
   if(controller.signal.aborted)return
   onChange({...latest.current,contentHtml:generated.contentHtml})
   setMode('editor');setImportOpen(false);toast.success('Đã tạo nội dung AI. Review và chỉnh sửa rồi bấm Lưu ngữ pháp.')
  }catch(error){if(timedOut)setGenerationError('AI phản hồi quá lâu. Nội dung hiện tại vẫn được giữ; hãy thử lại.');else if(!controller.signal.aborted)setGenerationError(error instanceof Error?error.message:'Không tạo được nội dung ngữ pháp.')}
  finally{clearTimeout(timer);if(abort.current===controller){abort.current=null;setGenerating(false);onGenerating?.(false)}}
 }
 const html=grammarEntryHtml(value)
 const prompt=grammarImportPrompt(value.title),promptInput=useRef<HTMLTextAreaElement>(null),promptDetails=useRef<HTMLDetailsElement>(null)
 async function copyPrompt(){
  try{await navigator.clipboard.writeText(prompt);toast.success('Đã sao chép prompt tạo ngữ pháp.')}
  catch{if(promptDetails.current)promptDetails.current.open=true;promptInput.current?.focus();promptInput.current?.select();toast.info('Hãy sao chép prompt đang được chọn bên dưới.')}
 }
 function importJson(){
  try{
   const parsed=parseGrammarImport(json)
   if('contentHtml' in parsed)onChange({...value,title:parsed.name,name:parsed.name,contentHtml:prepareGrammarHtml(parsed.contentHtml)})
   else{const imported=withGrammarDocument({...value,contentHtml:undefined},parsed);onChange({...imported,contentHtml:grammarEntryHtml(imported)})}
   setMode('editor');setImportOpen(false);setImportError('');toast.success('Đã chuyển JSON vào nội dung. Kiểm tra rồi bấm Lưu ngữ pháp.')
  }catch(error){setImportError(error instanceof Error?error.message:'Không đọc được JSON.')}
 }
 return <div className="grammar-fields flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
  <div className="grid shrink-0 grid-cols-2 gap-3">{folderControl}<div className="space-y-2"><Label htmlFor="grammar-name">Tên ngữ pháp *</Label><Input id="grammar-name" disabled={disabled||generating} required maxLength={160} value={value.title} placeholder="Ví dụ: Get to + V / Work out / Câu điều kiện" onChange={event=>onChange({...value,title:event.target.value,name:event.target.value})}/></div></div>
  <section aria-label="Prompt AI và import ngữ pháp" className="grammar-import-tools relative flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-2"><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" disabled={disabled||generating} onClick={()=>void copyPrompt()}><Copy size={15}/>Sao chép prompt AI</Button><Button type="button" variant="outline" size="sm" disabled={disabled||generating} aria-expanded={importOpen} aria-controls="grammar-import-input" onClick={()=>{if(promptDetails.current)promptDetails.current.open=false;setImportOpen(open=>!open)}}><Upload size={15}/>Import JSON</Button><Button type="button" size="sm" disabled={disabled||generating||!value.title.trim()} onClick={()=>void generate()}>{generating?<LoaderCircle size={15} className="animate-spin"/>:<Sparkles size={15}/>} {generating?'Đang tạo…':'Tạo bằng AI'}</Button>{generating&&<Button type="button" variant="outline" size="sm" onClick={()=>abort.current?.abort()}><Square size={14}/>Dừng tạo</Button>}</div>{generating&&<p role="status" className="basis-full text-sm text-emerald-700">Đang tạo nội dung theo tiêu đề và prompt. Nội dung hiện tại được giữ đến khi AI hoàn tất.</p>}{generationError&&<p role="alert" className="basis-full text-sm text-red-600">{generationError}</p>}<p className="sr-only">Prompt tự động lấy chủ đề từ tên ngữ pháp ở trên. Bấm Tạo bằng AI để điền nội dung vào editor, hoặc sao chép prompt và import JSON. Review trước khi lưu.</p><details ref={promptDetails} onToggle={event=>{if(event.currentTarget.open)setImportOpen(false)}}><summary className="cursor-pointer text-sm font-medium text-slate-600">Xem prompt AI</summary><div className="grammar-prompt-popover space-y-2"><Label htmlFor="grammar-import-prompt">Prompt tạo nội dung</Label><textarea ref={promptInput} id="grammar-import-prompt" readOnly rows={8} className="font-mono text-xs" value={prompt}/><Button type="button" size="sm" variant="outline" onClick={()=>{if(promptDetails.current)promptDetails.current.open=false}}>Đóng prompt</Button></div></details>{importOpen&&<div id="grammar-import-input" className="grammar-import-popover space-y-3"><Label htmlFor="grammar-json-input">Dán JSON từ AI</Label><textarea id="grammar-json-input" rows={8} maxLength={grammarHtmlLimit} disabled={disabled||generating} value={json} onChange={event=>{setJson(event.target.value);setImportError('')}} placeholder={'{ "name": "Tên ngữ pháp", "contentHtml": "<p>Nội dung…</p>" }'} className="font-mono text-xs"/>{importError&&<p role="alert" className="text-sm text-red-600">{importError}</p>}<Button type="button" disabled={disabled||generating||!json.trim()} onClick={importJson}>Điền vào nội dung</Button><Button type="button" variant="ghost" size="sm" onClick={()=>setImportOpen(false)}>Đóng import</Button></div>}</section>
  <div className="flex min-h-0 flex-1 flex-col gap-2"><div className="flex shrink-0 flex-wrap items-center justify-between gap-2"><Label htmlFor="grammar-html">Nội dung *</Label><div className="flex flex-wrap gap-1" role="group" aria-label="Chế độ soạn ngữ pháp">{([{id:'editor',label:'Soạn thảo',icon:PencilLine},{id:'preview',label:'Xem trước',icon:Eye}] as const).map(tab=><Button key={tab.id} type="button" size="sm" variant={mode===tab.id?'outline':'ghost'} aria-pressed={mode===tab.id} onClick={()=>setMode(tab.id)}><tab.icon size={15}/>{tab.label}</Button>)}</div></div>

   {mode==='editor'?<GrammarTextEditor value={html} disabled={disabled||generating} onChange={contentHtml=>onChange({...value,contentHtml})}/>:<div role="region" aria-label="Xem trước nội dung ngữ pháp" className="grammar-rich-content reading-content min-h-0 flex-1 overflow-y-auto overscroll-contain break-words rounded-xl border border-slate-200 bg-white p-5" dangerouslySetInnerHTML={{__html:prepareGrammarHtml(html)}}/>}
  </div>

 </div>
}
