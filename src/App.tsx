import QuickGrammarSearch from './lib/QuickGrammarSearch'
import IrregularVerbsPage from './pages/IrregularVerbsPage'
import LearningRail from './lib/LearningRail'
import GrammarSyncProvider from './lib/GrammarSyncProvider'
import GrammarPage from './pages/GrammarPage'
import FloatingAIChat from './lib/FloatingAIChat'
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
  return <BrowserRouter><AuthProvider><DriveConnectionInitializer/><Toaster richColors position="top-right"/><Routes><Route element={<PublicLayout/>}><Route index element={<HomeEntry/>}/><Route element={<ProtectedLayout/>}><Route path="folders" element={<HomePage/>}/><Route path="speaking" element={<SpeakingPage key="list" mode="list"/>}/><Route path="speaking/lessons/:lessonId" element={<SpeakingPage key="detail" mode="detail"/>}/><Route path="speaking/practice" element={<SpeakingPage key="practice" mode="practice"/>}/><Route path="reading" element={<ReadingPage key="reading-list"/>}/><Route path="reading/articles/:articleId" element={<ReadingPage key="reading-detail"/>}/><Route path="grammar" element={<GrammarPage/>}/><Route path="irregular-verbs" element={<IrregularVerbsPage/>}/><Route path="cards" element={<CardManagerPage/>}/><Route path="add" element={<AddVocabularyPage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="review" element={<ReviewPage/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes></AuthProvider></BrowserRouter>
}
function HomeEntry() { const {session}=useAuth(); return session ? <Navigate to="/folders" replace/> : <LandingPage/> }
function PublicLayout() {
 const {session}=useAuth()
 const [mobileOpen,setMobileOpen]=useState(false)
 if(session)return <><FloatingAIChat key={session.user.id}/><AppSidebar mobileOpen={mobileOpen} onClose={()=>setMobileOpen(false)}/><header className="app-mobile-header fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden"><button type="button" className="flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100" aria-label="Mở menu" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)}><Menu size={22}/></button><NavLink to="/folders" className="flex min-w-0 items-center gap-2 font-semibold"><BookOpen size={20} className="text-emerald-700"/><span className="truncate">Vocab Library</span></NavLink></header><div className="app-workspace lg:pl-60"><Outlet/></div></>
 return <><header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-slate-200/70 bg-white/95 backdrop-blur-md"><div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6"><NavLink to="/" className="flex items-center gap-2.5 font-bold"><span className="rounded-xl bg-emerald-700 p-2 text-white"><BookOpen size={19}/></span>Vocab Library</NavLink><GoogleAccountButton/></div></header><div className="min-h-screen pt-16"><Outlet/></div></>
}
function ProtectedLayout() {
  const { session, loading } = useAuth()
  if (loading) return <main className="p-12 text-center text-slate-500" role="status">Đang kiểm tra đăng nhập…</main>
  if (!session) return <Navigate to="/" replace/>
  return <AccountWorkspace key={session.user.id} userId={session.user.id}><PreferencesSyncProvider><VocabularySyncProvider><GrammarSyncProvider><AddVocabularyProvider><MeaningReminderProvider><QuickGrammarSearch/><div className="learning-layout"><div className="learning-content"><Outlet/></div><LearningRail/></div></MeaningReminderProvider></AddVocabularyProvider></GrammarSyncProvider></VocabularySyncProvider></PreferencesSyncProvider></AccountWorkspace>
}
