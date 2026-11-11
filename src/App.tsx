import DriveConnectionInitializer from './lib/DriveConnectionInitializer'
import AppSidebar from './lib/AppSidebar'
import SpeakingPage from './pages/SpeakingPage'
import ReadingPage from './pages/ReadingPage'
import VocabularySyncProvider from './lib/VocabularySyncProvider'
import PreferencesSyncProvider from './lib/PreferencesSyncProvider'
import CardManagerPage from './pages/CardManagerPage'
import { useState } from 'react'
import AccountWorkspace from './lib/AccountWorkspace'
import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { BookOpen, Menu } from 'lucide-react'
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
  return <BrowserRouter><AuthProvider><DriveConnectionInitializer/><Toaster richColors position="top-right"/><Routes><Route element={<PublicLayout/>}><Route index element={<HomeEntry/>}/><Route element={<ProtectedLayout/>}><Route path="folders" element={<HomePage/>}/><Route path="speaking" element={<SpeakingPage key="list" mode="list"/>}/><Route path="speaking/lessons/:lessonId" element={<SpeakingPage key="detail" mode="detail"/>}/><Route path="speaking/practice" element={<SpeakingPage key="practice" mode="practice"/>}/><Route path="reading" element={<ReadingPage key="reading-list"/>}/><Route path="reading/articles/:articleId" element={<ReadingPage key="reading-detail"/>}/><Route path="cards" element={<CardManagerPage/>}/><Route path="add" element={<AddVocabularyPage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="review" element={<ReviewPage/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes></AuthProvider></BrowserRouter>
}
function HomeEntry() { const {session}=useAuth(); return session ? <Navigate to="/folders" replace/> : <LandingPage/> }
function PublicLayout() {
 const {session}=useAuth()
 const [mobileOpen,setMobileOpen]=useState(false)
 if(session)return <><AppSidebar mobileOpen={mobileOpen} onClose={()=>setMobileOpen(false)}/><button type="button" className="fixed bottom-4 left-4 z-30 flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg md:hidden" aria-label="Mở menu" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)}><Menu size={21}/></button><div className="app-workspace md:pl-60"><Outlet/></div></>
 return <><header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-slate-200/70 bg-white/95 backdrop-blur-md"><div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6"><NavLink to="/" className="flex items-center gap-2.5 font-bold"><span className="rounded-xl bg-emerald-700 p-2 text-white"><BookOpen size={19}/></span>Vocab Library</NavLink><GoogleAccountButton/></div></header><div className="min-h-screen pt-16"><Outlet/></div></>
}
function ProtectedLayout() {
  const { session, loading } = useAuth()
  if (loading) return <main className="p-12 text-center text-slate-500" role="status">Đang kiểm tra đăng nhập…</main>
  if (!session) return <Navigate to="/" replace/>
  return <AccountWorkspace key={session.user.id} userId={session.user.id}><PreferencesSyncProvider><VocabularySyncProvider><AddVocabularyProvider><MeaningReminderProvider><Outlet/></MeaningReminderProvider></AddVocabularyProvider></VocabularySyncProvider></PreferencesSyncProvider></AccountWorkspace>
}
