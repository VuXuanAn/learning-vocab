import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import VocabularyLookup from './VocabularyLookup'
import LinkedCardDialog from './LinkedCardDialog'
import { bindVocabularySearchShortcut } from './vocabulary-search-shortcut'

export default function QuickVocabularySearch() {
 const [open, setOpen] = useState(false)
 const [selected, setSelected] = useState('')
 const portal = useRef<HTMLElement | null>(null)
 useEffect(() => {
  const toggle = () => {
   portal.current = document.fullscreenElement as HTMLElement | null
   setSelected('')
   setOpen(previous => !previous)
  }
  const unbind = bindVocabularySearchShortcut(window, toggle)
  return unbind
 }, [])
 return <><Dialog open={open} onOpenChange={setOpen}>
  <DialogContent portalContainer={portal} showCloseButton={false} className="top-[12dvh] flex max-h-[75dvh] -translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
   <DialogTitle className="sr-only">Tra từ trong kho</DialogTitle>
   <DialogDescription className="sr-only">Tìm từ đã lưu hoặc động từ bất quy tắc. Nhấn Ctrl + D để bật hoặc tắt, Escape để đóng.</DialogDescription>
   {open && <VocabularyLookup onClose={()=>setOpen(false)} onChoose={id=>{setOpen(false);setSelected(id)}}/>}
  </DialogContent>
 </Dialog>{selected&&<LinkedCardDialog portalContainer={portal} selectedNoteId={selected} onClose={()=>setSelected('')}/>}</>
}
