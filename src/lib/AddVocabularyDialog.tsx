import SelectionVocabularyMenu from './SelectionVocabularyMenu'
import { Button } from '@/components/ui/button'
import { VocabularyFooterContext } from './VocabularyFooter'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import AddVocabularyForm from '../pages/AddVocabularyForm'

const AddVocabularyContext = createContext<(folderId?: string, selectedText?: string) => void>(() => {})
export const useAddVocabulary = () => useContext(AddVocabularyContext)
export default function AddVocabularyProvider({ children }: { children: ReactNode }) {
  const [prefill,setPrefill]=useState({text:'',version:0})
  const [footerTarget, setFooterTarget] = useState<HTMLDivElement | null>(null)
  const [params, setParams] = useSearchParams()
  const open = params.get('add') === '1'
  const folderId = params.get('addFolder') ?? params.get('folder') ?? ''
  function show(folder?: string, selectedText = '') {
    setPrefill(previous=>({text:selectedText.trim().replace(/\s+/gu,' ').slice(0,200),version:previous.version+1}))
    setParams(previous => { const next = new URLSearchParams(previous); next.set('add', '1'); next.set('addFolder', folder ?? previous.get('folder') ?? ''); return next })
  }
  function close() {
    setParams(previous => { const next = new URLSearchParams(previous); next.delete('add'); next.delete('addFolder'); return next }, { replace: true })
  }
  return <AddVocabularyContext value={show}>{children}<SelectionVocabularyMenu/><Dialog open={open} onOpenChange={value => { if (!value) close() }}><DialogContent className="vocabulary-dialog flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col rounded-none sm:h-[90dvh] sm:max-h-[90dvh] sm:rounded-xl gap-0 overflow-hidden p-0 sm:max-w-6xl"><DialogHeader className="shrink-0 border-b px-6 py-5 pr-12"><DialogTitle className="text-2xl">Thêm từ vựng</DialogTitle><DialogDescription>Tạo ghi chú, tùy chỉnh kiểu thẻ và xem trước trước khi lưu.</DialogDescription></DialogHeader><VocabularyFooterContext value={footerTarget}><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">{open && <AddVocabularyForm key={prefill.version+':'+folderId} initialWords={prefill.text?[prefill.text]:[]} initialFolderId={folderId === 'all' ? '' : folderId} />}</div><div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-white px-6 py-4"><div ref={setFooterTarget} className="min-w-0 flex-1" /><Button type="button" variant="outline" onClick={close}>Đóng</Button></div></VocabularyFooterContext></DialogContent></Dialog></AddVocabularyContext>
}
