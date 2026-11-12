import StyledSelect from '@/components/ui/styled-select'
import { findIrregularVerb } from './irregular-verbs'
import IrregularVerbDetails from './IrregularVerbDetails'
import ReadingSources from './ReadingSources'
﻿import { useState, type RefObject } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { db } from './db'
import { generateCards } from './cards'
import AIVocabularyCard from './AIVocabularyCard'
import CardHtml from './CardHtml'
export default function LinkedCardDialog({ portalContainer, selectedNoteId, onClose }: { portalContainer: RefObject<HTMLElement | null>; selectedNoteId?: string; onClose?: () => void }) {
  const [params, setParams] = useSearchParams()
  const id = selectedNoteId ?? params.get('note') ?? ''
  const irregularVerb = findIrregularVerb(id)
  const record = useLiveQuery(async () => ({ note: id ? await db.notes.get(id) : undefined }), [id])
  const note = record?.note
  const cards = note ? generateCards(note) : []
  const [selection, setSelection] = useState({id: '', index: 0})
  const selectedIndex = selection.id === id ? selection.index : 0
  const card = cards[selectedIndex] ?? cards[0]
  if (irregularVerb) return <Dialog open onOpenChange={open => { if (open) return; if (selectedNoteId !== undefined) { onClose?.(); return } setParams(previous => { const next=new URLSearchParams(previous); next.delete('note'); return next }, {replace:true}) }}><DialogContent portalContainer={portalContainer} className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-2xl"><DialogHeader className="border-b px-6 py-5 pr-12"><DialogTitle>Động từ bất quy tắc</DialogTitle><DialogDescription>Tra cứu dạng động từ và nghĩa tiếng Việt.</DialogDescription></DialogHeader><IrregularVerbDetails verb={irregularVerb}/></DialogContent></Dialog>
  return <Dialog open={!!id} onOpenChange={open => { if (!open && selectedNoteId !== undefined) { onClose?.(); return } if (!open) setParams(previous => { const next = new URLSearchParams(previous); next.delete('note'); return next }, {replace:true}) }}><DialogContent portalContainer={portalContainer} className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-3xl" onKeyDown={event => {
    if (event.key.toLowerCase() !== 's' || event.ctrlKey || event.altKey || event.metaKey || event.repeat || event.nativeEvent.isComposing || (event.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]')) return
    event.preventDefault(); event.stopPropagation()
    event.currentTarget.querySelector<HTMLButtonElement>('[data-study-speech="true"]:not(:disabled)')?.click()
  }}><DialogHeader className="border-b px-6 py-5 pr-12"><DialogTitle>Thẻ từ vựng</DialogTitle><DialogDescription>Xem nội dung thẻ đã lưu.</DialogDescription></DialogHeader>{cards.length > 1 && <div className="px-6 pt-4"><label htmlFor="view-card-index">Thẻ trong từ vựng này</label><StyledSelect id="view-card-index" value={selectedIndex} onChange={event => setSelection({id, index:Number(event.target.value)})}>{cards.map((row,index) => <option key={row.id} value={index}>Thẻ {index + 1} / {cards.length}</option>)}</StyledSelect></div>}{!record ? <p role="status" className="p-8 text-center text-slate-500">Đang mở thẻ…</p> : !note || !card ? <p className="p-8 text-center text-slate-500">Thẻ không còn tồn tại trên thiết bị này.</p> : note.kind === 'ai' ? <AIVocabularyCard key={note.id} note={note} revealed/> : note.template?.format === 'html' ? <div className="space-y-4 p-4"><CardHtml template={note.template} content={card.front} title="Mặt trước thẻ"/><div className="border-t pt-4"><CardHtml template={note.template} content={card.back} title="Mặt sau thẻ"/></div></div> : <div className="space-y-6 p-8 text-center"><h2 className="whitespace-pre-wrap text-3xl font-semibold">{card.front}</h2><p className="whitespace-pre-wrap text-xl text-emerald-800">{card.back}</p></div>}{note&&note.kind!=='ai'&&<div className="px-6 pb-6"><ReadingSources note={note}/></div>}</DialogContent></Dialog>
}

