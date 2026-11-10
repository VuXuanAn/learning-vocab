import CardManagerPage from './pages/CardManagerPage'
import { useLayoutEffect, useRef, useState } from 'react'
import AccountWorkspace from './lib/AccountWorkspace'
import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { BookOpen, Plus, Brain, Settings } from 'lucide-react'
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
  return <><header ref={headerRef} className="fixed inset-x-0 top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4"><NavLink to="/" className="flex items-center gap-3 font-bold text-slate-900"><span className="rounded-xl bg-emerald-700 p-2 text-white"><BookOpen size={21}/></span>Vocab Library</NavLink><nav aria-label="Điều hướng chính" className="flex flex-wrap items-center gap-2">{session && <>{[{to:'/folders',label:'Bộ thẻ',icon:BookOpen},{to:'/review',label:'Ôn tập',icon:Brain},{to:'/settings',label:'Cài đặt',icon:Settings}].map(({to,label,icon:Icon})=><NavLink key={to} to={to} className={({isActive})=>`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${isActive?'bg-emerald-700 text-white':'text-slate-500 hover:bg-emerald-50'}`}><Icon size={18}/>{label}</NavLink>)}<NavLink to="/folders?add=1" className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 hover:bg-emerald-50"><Plus size={18}/>Thêm từ vựng</NavLink></>}<GoogleAccountButton/></nav></div></header><div aria-hidden="true" style={{height: headerHeight}}/><Outlet/></>
}
function ProtectedLayout() {
  const { session, loading } = useAuth()
  if (loading) return <main className="p-12 text-center text-slate-500" role="status">Đang kiểm tra đăng nhập…</main>
  if (!session) return <Navigate to="/" replace/>
  return <AccountWorkspace key={session.user.id} userId={session.user.id}><AddVocabularyProvider><MeaningReminderProvider><Outlet/></MeaningReminderProvider></AddVocabularyProvider></AccountWorkspace>
}
