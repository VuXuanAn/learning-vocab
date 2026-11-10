import { createPortal } from 'react-dom'
import { createContext, useContext, type ReactNode } from 'react'
export const VocabularyFooterContext = createContext<HTMLDivElement | null>(null)
export default function VocabularyFooter({ children }: { children: ReactNode }) {
  const target = useContext(VocabularyFooterContext)
  return target ? createPortal(children, target) : null
}
