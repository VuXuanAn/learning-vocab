import VocabularySyncButton from './lib/VocabularySyncButton'
import VocabularySyncProvider from './lib/VocabularySyncProvider'
import PreferencesSyncProvider from './lib/PreferencesSyncProvider'
import CardManagerPage from './pages/CardManagerPage'
import { useLayoutEffect, useRef, useState } from 'react'
import AccountWorkspace from './lib/AccountWorkspace'
import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { BookOpen, Plus, Brain } from 'lucide-react'
import { Toaster } from 'sonner'
import AuthProvider, { useAuth } from './lib/AuthProvider'
import GoogleAccountButton from './lib/GoogleAccountButton'
import MeaningReminderProvider from './lib/MeaningReminder'
import AddVocabularyProvider from './lib/AddVocabularyDialog'
import SettingsPage from './pages/SettingsPage'
import AddVocabularyPage from './pages/AddVocabularyPage'
import HomePage from './pages/HomePage'
import LandingPage from './pages/LandingPage'
import ReviewPage from './pages/ReviewPage'

export default function App() {
  return <BrowserRouter><AuthProvider><Toaster richColors position="top-right"/><Routes><Route element={<PublicLayout/>}><Route index element={<LandingPage/>}/><Route element={<ProtectedLayout/>}><Route path="folders" element={<HomePage/>}/><Route path="cards" element={<CardManagerPage/>}/><Route path="add" element={<AddVocabularyPage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="review" element={<ReviewPage/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes></AuthProvider></BrowserRouter>
}
function PublicLayout() {
  const { session } = useAuth()
  const headerRef = useRef<HTMLElement>(null)
  const [headerHeight, setHeaderHeight] = useState(80)
  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header) return
    const measure = () => setHeaderHeight(header.getBoundingClientRect().height)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  return <>
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur-md">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6 md:grid-cols-[1fr_auto_1fr] md:py-3.5">
        <NavLink to={session ? '/folders' : '/'} className="flex w-fit items-center gap-2.5 text-sm font-bold tracking-tight text-slate-900 sm:text-base">
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-700 text-white"><BookOpen size={19}/></span>
          <span className="hidden sm:inline">Vocab Library</span><span className="sm:hidden">Vocab</span>
        </NavLink>
        {session && <nav aria-label="Điều hướng chính" className="order-3 col-span-2 flex items-center justify-center gap-1 rounded-xl bg-slate-100/80 p-1 md:order-2 md:col-span-1">
          {[{to:'/folders',label:'Bộ thẻ',icon:BookOpen},{to:'/review',label:'Ôn tập',icon:Brain}].map(({to,label,icon:Icon}) => <NavLink key={to} to={to} className={({isActive}) => `flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors md:flex-none ${isActive ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><Icon size={16}/>{label}</NavLink>)}
        </nav>}
        <div className={`order-2 flex items-center justify-end gap-2 ${session ? 'md:order-3' : 'md:col-span-2'}`}>
          {session && <>
            <VocabularySyncButton/>
            <NavLink to="/folders?add=1" aria-label="Thêm từ vựng" title="Thêm từ vựng" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"><Plus size={19}/></NavLink>
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-slate-200"/>
          </>}
          <GoogleAccountButton/>
        </div>
      </div>
    </header>
    <div aria-hidden="true" style={{height: headerHeight}}/>
    <Outlet/>
  </>

}
function ProtectedLayout() {
  const { session, loading } = useAuth()
  if (loading) return <main className="p-12 text-center text-slate-500" role="status">Đang kiểm tra đăng nhập…</main>
  if (!session) return <Navigate to="/" replace/>
  return <AccountWorkspace key={session.user.id} userId={session.user.id}><PreferencesSyncProvider><VocabularySyncProvider><AddVocabularyProvider><MeaningReminderProvider><Outlet/></MeaningReminderProvider></AddVocabularyProvider></VocabularySyncProvider></PreferencesSyncProvider></AccountWorkspace>
}
