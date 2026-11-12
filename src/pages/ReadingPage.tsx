import GrammarCardDialog from '../lib/GrammarCardDialog'
import AssignReadingGrammarDialog from '../lib/AssignReadingGrammarDialog'
import ReadingGrammarDialog from '../lib/ReadingGrammarDialog'
import type { GrammarSource } from '../lib/reading-grammar'
import ReadingMatchReview, { type ReadingMatchReviewData } from '../lib/ReadingMatchReview'
import ReadingTranslation from '../lib/ReadingTranslation'
import ReadingColumns from '../lib/ReadingColumns'
import StyledSelect from '@/components/ui/styled-select'
import ReadingStudyNotes from '../lib/ReadingStudyNotes'
﻿import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpenText, ChevronDown, ChevronRight, FileText, Folder, FolderPlus, LoaderCircle, Pencil, Plus, RefreshCw, ScanText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { db } from '../lib/db'
import { useAuth } from '../lib/AuthProvider'
import { useReadingLibrary } from '../lib/useReadingLibrary'
import { saveReadingArticle, saveReadingFolder } from '../lib/reading-storage'
import type { ReadingArticle, ReadingFolder } from '../lib/reading-types'
import { cleanReadingHtml, detectReadingVocab, renderReadingHtml, readingSelection, highlightReadingGrammar } from '../lib/reading-content'
import LinkedCardDialog from '../lib/LinkedCardDialog'

export default function ReadingPage(){
 const {session}=useAuth(),ownerId=session?.user.id??''
 const library=useReadingLibrary(ownerId)
 const {articleId}=useParams()
 const navigate=useNavigate(),[params,setParams]=useSearchParams()
 const article=library.articles.find(row=>row.id===articleId)
 const noteIds=useLiveQuery(()=>db.notes.toCollection().primaryKeys())
 const root=useRef<HTMLElement|null>(null),abort=useRef<AbortController|null>(null)
 const [matchReview,setMatchReview]=useState<ReadingMatchReviewData|null>(null)
 const [grammarCardId,setGrammarCardId]=useState('')
 const [grammarMode,setGrammarMode]=useState<'create'|'assign'>('create')
 const [grammarSource,setGrammarSource]=useState<GrammarSource|null>(null)
 const readingGrammar=useLiveQuery(()=>db.grammarEntries.where('ownerId').equals(ownerId).filter(entry=>entry.source?.articleId===articleId||entry.sources?.some(source=>source.articleId===articleId)===true).toArray(),[ownerId,articleId])
 const [notesHidden,setNotesHidden]=useState(true)
 const [readingPane,setReadingPane]=useState<'content'|'translation'|'notes'>('content')
 const [search,setSearch]=useState(''),[collapsed,setCollapsed]=useState<Set<string>>(new Set())
 const [folderDialog,setFolderDialog]=useState(false),[folderEditing,setFolderEditing]=useState<ReadingFolder|null>(null),[folderName,setFolderName]=useState('')
 const [editor,setEditor]=useState<ReadingArticle|null>(null),[preview,setPreview]=useState(false)
 const [deleting,setDeleting]=useState<ReadingArticle|null>(null)
 const [busy,setBusy]=useState(false),[detecting,setDetecting]=useState(false),[error,setError]=useState('')
 useEffect(()=>()=>abort.current?.abort(),[])
 useEffect(()=>{abort.current?.abort();setDetecting(false);setError('');setMatchReview(null);setGrammarSource(null);setGrammarCardId('')},[articleId])
 const sourceNote=params.get('sourceNote')??''
 const sourceGrammar=params.get('sourceGrammar')??''
 const rendered=useMemo(()=>article?highlightReadingGrammar(renderReadingHtml(article.contentHtml,article.detection,new Set(noteIds??[])),article.contentHtml,readingGrammar??[],article.id):'',[article?.id,article?.contentHtml,article?.detection,noteIds,readingGrammar])
 useEffect(()=>{
  function selectGrammar(event:Event){
   const detail=(event as CustomEvent<{articleId:string;range:Range;mode?:'create'|'assign'}>).detail
   if(!article||detail.articleId!==article.id)return
   const content=root.current?.querySelector<HTMLElement>('[data-reading-article]')
   const selected=content?readingSelection(article.contentHtml,content,detail.range):null
   if(!selected||selected.quote.length>10000){toast.error('Hãy bôi đen đoạn trong Content, tối đa 10.000 ký tự.');return}
   setGrammarMode(detail.mode??'create')
   setGrammarSource({...selected,articleId:article.id,articleTitle:article.title,contentHtml:article.contentHtml,highlights:[]})
  }
  window.addEventListener('reading:add-grammar',selectGrammar)
  return()=>window.removeEventListener('reading:add-grammar',selectGrammar)
 },[article])
 useEffect(()=>{
  if(!sourceNote)return
  const frame=requestAnimationFrame(()=>{
   const links=[...(root.current?.querySelectorAll<HTMLAnchorElement>('a[data-reading-note]')??[])]
   const matches=links.filter(link=>link.dataset.readingNote===sourceNote)
   for(const link of matches)link.classList.add('reading-source-highlight')
   matches[0]?.scrollIntoView({block:'center',behavior:'smooth'})
  })
  return()=>cancelAnimationFrame(frame)
 },[sourceNote,rendered])
 useEffect(()=>{
  if(!sourceGrammar)return
  const frame=requestAnimationFrame(()=>{
   const marks=[...(root.current?.querySelectorAll<HTMLElement>('[data-reading-grammar]')??[])]
   marks.find(mark=>mark.dataset.readingGrammar===sourceGrammar)?.scrollIntoView({block:'center',behavior:'smooth'})
  })
  return()=>cancelAnimationFrame(frame)
 },[sourceGrammar,rendered])
 function sync(){void library.sync().catch(()=>{})}
 function showFolder(folder?:ReadingFolder){setFolderEditing(folder??null);setFolderName(folder?.name??'');setError('');setFolderDialog(true)}
 function newArticle(folderId=''){
  if(!library.folders.length){toast.info('Tạo thư mục Reading trước khi thêm bài đọc.');showFolder();return}
  const now=new Date().toISOString();setEditor({id:crypto.randomUUID(),ownerId,folderId:folderId||library.folders[0].id,title:'',contentHtml:'',note:'',createdAt:now,updatedAt:now});setPreview(false);setError('')
 }
 async function persistFolder(event:React.FormEvent){
  event.preventDefault();setBusy(true);setError('')
  try{const now=new Date().toISOString();await saveReadingFolder({id:folderEditing?.id??crypto.randomUUID(),ownerId,name:folderName,createdAt:folderEditing?.createdAt??now,updatedAt:now});setFolderDialog(false);sync();toast.success('Đã lưu thư mục Reading.')}catch(error){setError(error instanceof Error?error.message:'Không lưu được thư mục.')}finally{setBusy(false)}
 }
 async function persistArticle(event:React.FormEvent){
  event.preventDefault();if(!editor)return;setBusy(true);setError('')
  try{
   const current=await db.readingArticles.get(editor.id)
   if(current&&current.updatedAt!==editor.updatedAt)throw new Error('Bài đã thay đổi. Đóng popup và mở lại để tránh ghi đè.')
   const saved=await saveReadingArticle({...editor,contentHtml:cleanReadingHtml(editor.contentHtml)})
   setEditor(null);sync();navigate('/reading/articles/'+saved.id);toast.success('Đã lưu bài đọc.')
  }catch(error){setError(error instanceof Error?error.message:'Không lưu được bài đọc.')}finally{setBusy(false)}
 }
 async function detect(){
  if(!article||detecting)return
  const captured=article,controller=new AbortController();abort.current=controller;setDetecting(true);setError('')
  try{
   const notes=await db.notes.toArray()
   const detection=await detectReadingVocab(captured.contentHtml,notes,controller.signal,captured.detection)
   if(controller.signal.aborted)return
   const current=await db.readingArticles.get(captured.id)
   if(!current||current.deletedAt||current.contentHtml!==captured.contentHtml)throw new Error('Nội dung đã thay đổi; bấm Detect vocab để dò lại.')
   const saved=await saveReadingArticle({...current,detection})
   if(detection.suggestions.length&&saved.detection)setMatchReview({articleId:captured.id,ownerId:captured.ownerId,detection:saved.detection,suggestions:detection.suggestions})
   const found='Đã tìm thấy '+new Set(detection.matches.map(match=>match.noteId)).size+' từ/cụm từ ('+detection.matches.length+' vị trí). '
   try{
    await library.sync()
    if(!controller.signal.aborted)toast.success(found+'Đã lưu kết quả detect lên Supabase.')
   }catch{
    if(!controller.signal.aborted){setError('Đã detect và lưu trên máy, nhưng chưa lưu lên Supabase. Kiểm tra kết nối hoặc migration 011, rồi bấm Làm mới để gửi lại.');toast.warning(found+'Kết quả được giữ trên máy, đang chờ đồng bộ.')}
   }
  }catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Không dò được từ vựng.')}
  finally{if(abort.current===controller){abort.current=null;setDetecting(false)}}
 }
 async function remove(){
  if(!deleting)return;setBusy(true);setError('')
  try{const current=await db.readingArticles.get(deleting.id);if(current)await saveReadingArticle({...current,deletedAt:new Date().toISOString()});setDeleting(null);sync();navigate('/reading');toast.success('Đã xóa bài đọc. Các thẻ từ vựng vẫn được giữ.')}catch{setError('Không xóa được bài đọc.')}finally{setBusy(false)}
 }
 function openCard(event:React.MouseEvent){
  const mark=(event.target as Element).closest<HTMLElement>('[data-reading-grammar]')
  if(mark){
   event.preventDefault()
   if(window.getSelection()?.toString().trim())return
   const grammar=readingGrammar?.find(entry=>entry.id===mark.dataset.readingGrammar)
   if(grammar)setGrammarCardId(grammar.id)
   return
  }
  const target=(event.target as Element).closest<HTMLAnchorElement>('a[data-reading-note]')
  if(!target)return
  event.preventDefault()
  // Preserve drag selection over vocabulary links instead of opening a card.
  if(window.getSelection()?.toString().trim())return
  const id=target.dataset.readingNote
  if(id)setParams(previous=>{const next=new URLSearchParams(previous);next.set('note',id);return next})
 }
 const matching=library.articles.filter(row=>row.title.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))
 return <main ref={root} className="workspace-page reading-page gap-4 px-4 py-5 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">READING</p><h1 className="mt-2 text-3xl font-bold">{articleId?'Chi tiết bài đọc':'Thư viện bài đọc'}</h1></div><div className="flex flex-wrap gap-2">{articleId?<Link to="/reading" className="secondary">Danh sách bài đọc</Link>:<><Button variant="outline" onClick={()=>showFolder()}><FolderPlus size={16}/>Tạo thư mục</Button><Button onClick={()=>newArticle()}><Plus size={16}/>Thêm bài đọc</Button></>}<Button variant="outline" disabled={library.syncing} onClick={sync}><RefreshCw size={16} className={library.syncing?'animate-spin':''}/>Làm mới</Button></div></div>
 {library.error&&<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{library.error}</p>}
 {error&&!editor&&!folderDialog&&!deleting&&<p role="alert" className="text-sm text-red-600">{error}</p>}
 {!articleId?<><Input aria-label="Tìm bài đọc" placeholder="Tìm tên bài đọc…" value={search} onChange={event=>setSearch(event.target.value)}/><section className="panel reading-list min-h-0 flex-1 overflow-auto overscroll-contain"><div className="sticky top-0 z-10 flex justify-between border-b bg-slate-50 px-5 py-4 text-sm font-semibold"><span>Thư mục / Bài đọc</span><span>{library.articles.length} bài</span></div>{library.folders.map(folder=>{const rows=matching.filter(row=>row.folderId===folder.id);if(search&&!rows.length)return null;const expanded=!!search||!collapsed.has(folder.id);return <div key={folder.id}><div className="flex flex-wrap items-center gap-2 border-b bg-slate-50/60 px-4 py-2"><button type="button" aria-expanded={expanded} onClick={()=>setCollapsed(previous=>{const next=new Set(previous);if(next.has(folder.id))next.delete(folder.id);else next.add(folder.id);return next})} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-sm font-medium">{expanded?<ChevronDown size={15}/>:<ChevronRight size={15}/>}<Folder size={17} className="shrink-0 text-emerald-700"/>{folder.name}</button><span className="text-xs text-slate-400">{library.articles.filter(row=>row.folderId===folder.id).length}</span><Button variant="ghost" size="icon" aria-label={'Đổi tên '+folder.name} onClick={()=>showFolder(folder)}><Pencil size={15}/></Button><Button variant="ghost" size="icon" aria-label={'Thêm bài vào '+folder.name} onClick={()=>newArticle(folder.id)}><Plus size={16}/></Button></div>{expanded&&(rows.length?rows.map(row=><Link key={row.id} to={'/reading/articles/'+row.id} className="flex items-center gap-3 border-b border-slate-100 py-4 pl-14 pr-5 text-sm hover:bg-slate-50"><FileText size={16} className="shrink-0 text-slate-400"/><span className="min-w-0 flex-1 break-words font-medium text-slate-700">{row.title}</span><span className="text-xs text-slate-400">{row.detection?new Set(row.detection.matches.map(match=>match.noteId)).size+' từ đã dò':'Chưa dò từ'}</span></Link>):<p className="border-b py-4 pl-14 text-sm text-slate-400">Chưa có bài đọc.</p>)}</div>})}{!library.folders.length&&<div className="p-12 text-center text-slate-500"><BookOpenText className="mx-auto mb-3 text-emerald-700" size={32}/>Tạo thư mục và thêm bài đọc đầu tiên.</div>}</section></>:article?<><nav aria-label="Đường dẫn" className="flex flex-wrap gap-2 text-sm text-slate-500"><Link to="/reading" className="hover:text-emerald-700">Reading</Link><span>/</span><span>{library.folders.find(folder=>folder.id===article.folderId)?.name}</span><span>/</span><span className="text-slate-800">{article.title}</span></nav><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-semibold">{article.title}</h2><div className="flex flex-wrap gap-2"><Button disabled={detecting||busy} onClick={()=>void detect()}>{detecting?<LoaderCircle size={16} className="animate-spin"/>:<ScanText size={16}/>} {detecting?(library.syncing?'Đang lưu kết quả…':'Đang dò…'):'Detect vocab'}</Button><Button variant="outline" disabled={detecting} onClick={()=>{setEditor(article);setPreview(false);setError('')}}><Pencil size={16}/>Chỉnh sửa</Button><Button variant="destructive" disabled={detecting} onClick={()=>{setDeleting(article);setError('')}}><Trash2 size={16}/>Xóa bài</Button></div></div><div className="reading-pane-toggle flex shrink-0 gap-1 rounded-xl border border-slate-200 bg-white p-1 lg:hidden" role="group" aria-label="Phần bài đọc">{([{id:'content',label:'Nội dung'},{id:'translation',label:'Dịch'},{id:'notes',label:'Ghi chú'}] as const).map(pane=><button type="button" key={pane.id} aria-pressed={readingPane===pane.id} onClick={()=>setReadingPane(pane.id)} className={'min-h-10 flex-1 rounded-lg text-sm font-medium '+(readingPane===pane.id?'bg-emerald-700 text-white':'text-slate-500')}>{pane.label}</button>)}</div><ReadingColumns pane={readingPane} notesHidden={notesHidden}><section data-reading-pane="content" className="panel reading-content-panel flex min-h-0 min-w-0 flex-col overflow-hidden"><div className="reading-pane-header"><h3 className="font-semibold">Content</h3><span className="min-w-0 flex-1 truncate text-right text-xs text-slate-400" title={article.detection?'Đã dò lúc '+new Date(article.detection.createdAt).toLocaleString('vi-VN')+(article.metadataSynced?' · Đã lưu Supabase':' · Chờ lưu Supabase'):'Bấm Detect vocab để tìm từ đã có trong kho.'}>{article.detection?'Đã dò lúc '+new Date(article.detection.createdAt).toLocaleString('vi-VN')+(article.metadataSynced?' · Đã lưu Supabase':' · Chờ lưu Supabase'):'Bấm Detect vocab để tìm từ đã có trong kho.'}</span></div><div data-reading-article={article.id} className="reading-content min-h-0 flex-1 overflow-y-auto overscroll-contain break-words p-6" tabIndex={0} aria-label="Nội dung bài đọc" onClick={openCard} dangerouslySetInnerHTML={{__html:rendered}}/><p className="reading-pane-footer text-xs text-slate-400">Bôi đen để gán ngữ pháp có sẵn, thêm ngữ pháp mới hoặc từ vựng. Bấm từ gạch chân để mở thẻ; bấm phần tô vàng để mở thẻ ngữ pháp. Khi thêm từ mới vào kho, bấm Detect vocab để cập nhật.</p></section><ReadingTranslation key={article.id+article.contentHtml} article={article} onSync={library.sync}/><ReadingStudyNotes key={article.id} articleId={article.id} ownerId={ownerId} onSync={library.sync} collapsed={notesHidden} onToggle={()=>setNotesHidden(value=>!value)}/></ReadingColumns></>:<section className="panel p-10 text-center text-slate-500">Bài đọc chưa tải xong hoặc không còn tồn tại. <Button variant="ghost" onClick={sync}>Tải lại</Button></section>}
 <Dialog open={folderDialog} onOpenChange={open=>{if(!busy)setFolderDialog(open)}}><DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>{folderEditing?'Đổi tên thư mục':'Tạo thư mục Reading'}</DialogTitle><DialogDescription>Nhóm các bài đọc theo chủ đề.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={event=>void persistFolder(event)}><Input aria-label="Tên thư mục Reading" autoFocus required maxLength={100} value={folderName} disabled={busy} onChange={event=>setFolderName(event.target.value)}/>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>setFolderDialog(false)}>Hủy</Button><Button type="submit" disabled={busy||!folderName.trim()}>Lưu</Button></div></form></DialogContent></Dialog>
 <Dialog open={!!editor} onOpenChange={open=>{if(!busy&&!open)setEditor(null)}}><DialogContent showCloseButton={!busy} className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-5xl"><DialogHeader><DialogTitle>{library.articles.some(row=>row.id===editor?.id)?'Chỉnh sửa bài đọc':'Thêm bài đọc'}</DialogTitle><DialogDescription>Nhập nội dung bài đọc bằng HTML. Bạn có thể thêm ghi chú học tập sau khi mở bài.</DialogDescription></DialogHeader>{editor&&<form className="flex min-h-0 flex-col gap-4" onSubmit={event=>void persistArticle(event)}><div className="min-h-0 space-y-4 overflow-y-auto pr-1"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="reading-title">Tên bài *</Label><Input id="reading-title" autoFocus required maxLength={160} value={editor.title} onChange={event=>setEditor({...editor,title:event.target.value})}/></div><div className="space-y-2"><Label htmlFor="reading-folder">Thư mục *</Label><StyledSelect id="reading-folder" required value={editor.folderId} onChange={event=>setEditor({...editor,folderId:event.target.value})}>{library.folders.map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}</StyledSelect></div></div><div className="space-y-2"><div className="flex items-center justify-between gap-2"><Label htmlFor="reading-html">Content HTML *</Label><Button type="button" variant="outline" size="sm" onClick={()=>setPreview(value=>!value)}>{preview?'Sửa HTML':'Xem trước'}</Button></div>{preview?<div className="reading-content min-h-48 rounded-xl border p-5" dangerouslySetInnerHTML={{__html:cleanReadingHtml(editor.contentHtml)}}/>:<textarea id="reading-html" required maxLength={200000} rows={10} className="font-mono text-sm" placeholder="<h2>Tiêu đề</h2><p>Nội dung bài đọc…</p>" value={editor.contentHtml} onChange={event=>setEditor({...editor,contentHtml:event.target.value,detection:undefined})}/>}</div></div>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex shrink-0 justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={busy} onClick={()=>setEditor(null)}>Hủy</Button><Button type="submit" disabled={busy||!editor.title.trim()||!editor.contentHtml.trim()}>Lưu bài đọc</Button></div></form>}</DialogContent></Dialog>
 <Dialog open={!!deleting} onOpenChange={open=>{if(!busy&&!open)setDeleting(null)}}><DialogContent><DialogHeader><DialogTitle>Xóa bài đọc?</DialogTitle><DialogDescription>Xóa “{deleting?.title}” cùng Content, Note và các liên kết đã dò. Các thẻ trong kho từ vựng được giữ nguyên.</DialogDescription></DialogHeader>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setDeleting(null)}>Hủy</Button><Button variant="destructive" disabled={busy} onClick={()=>void remove()}>Xóa bài đọc</Button></div></DialogContent></Dialog>
 {matchReview&&<ReadingMatchReview key={matchReview.articleId+matchReview.detection.createdAt} data={matchReview} onClose={()=>setMatchReview(null)} onSync={library.sync}/>}
 {grammarSource&&grammarMode==='assign'&&<AssignReadingGrammarDialog source={grammarSource} ownerId={ownerId} onClose={()=>setGrammarSource(null)}/>}
 {grammarSource&&grammarMode==='create'&&<ReadingGrammarDialog key={grammarSource.articleId+':'+grammarSource.start+':'+grammarSource.end} source={grammarSource} ownerId={ownerId} onClose={()=>setGrammarSource(null)}/>}
 {grammarCardId&&<GrammarCardDialog key={grammarCardId} id={grammarCardId} ownerId={ownerId} onClose={()=>setGrammarCardId('')} portalContainer={root}/>}
 <LinkedCardDialog portalContainer={root}/>
 </main>
}
