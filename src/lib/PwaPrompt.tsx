import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaPrompt() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installHidden, setInstallHidden] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisterError(error) { console.warn('Không thể đăng ký PWA:', error) },
  })

  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const installed = () => setInstallPrompt(null)
    const checkUpdate = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && 'serviceWorker' in navigator) {
        void navigator.serviceWorker.getRegistration().then(registration => registration?.update()).catch(() => {})
      }
    }
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', installed)
    window.addEventListener('online', checkUpdate)
    document.addEventListener('visibilitychange', checkUpdate)
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', installed)
      window.removeEventListener('online', checkUpdate)
      document.removeEventListener('visibilitychange', checkUpdate)
    }
  }, [])

  const install = async () => {
    if (!installPrompt) return
    setInstalling(true)
    setError('')
    try {
      await installPrompt.prompt()
      await installPrompt.userChoice
      setInstallPrompt(null)
    } catch {
      setError('Chưa cài được ứng dụng. Bạn có thể chọn Cài đặt trong menu trình duyệt.')
    } finally { setInstalling(false) }
  }

  const update = async () => {
    setUpdating(true)
    setError('')
    try { await updateServiceWorker(true) }
    catch { setError('Chưa cập nhật được. Vui lòng thử lại khi có mạng.') }
    finally { setUpdating(false) }
  }

  if (!needRefresh && (!installPrompt || installHidden)) return null

  return <aside aria-label={needRefresh ? 'Cập nhật ứng dụng' : 'Cài đặt ứng dụng'} className="fixed bottom-4 left-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-lg">
    <button type="button" aria-label="Để sau" disabled={installing || updating} className="absolute right-2 top-2 rounded p-2 text-slate-500 hover:bg-slate-100" onClick={() => { setNeedRefresh(false); setInstallHidden(true) }}><X size={16}/></button>
    <p className="pr-8 font-semibold">{needRefresh ? 'Đã có phiên bản mới' : 'Cài Vocab Library'}</p>
    <p className="mt-1 text-sm text-slate-600">{needRefresh ? 'Hãy lưu nội dung đang nhập trước khi cập nhật. Ứng dụng sẽ tải lại.' : 'Mở ứng dụng từ màn hình chính để học thuận tiện hơn.'}</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    <button type="button" disabled={installing || updating} onClick={() => { void (needRefresh ? update() : install()) }} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
      {needRefresh ? <RefreshCw size={16}/> : <Download size={16}/>}
      {updating ? 'Đang cập nhật…' : installing ? 'Đang cài…' : needRefresh ? 'Cập nhật' : 'Cài ứng dụng'}
    </button>
  </aside>
}
