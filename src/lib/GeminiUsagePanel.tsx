import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
interface UsageTotals { requests: number; failures: number; inputTokens: number; outputTokens: number; totalTokens: number; missingUsage: number }
interface UsageData { storageMode?:'file'|'memory'; model: string; aiConfigured: boolean; startedAt: string; storageError: boolean; today: UsageTotals; monthUsage: UsageTotals }
const number = (value: number) => value.toLocaleString('vi-VN')
export default function GeminiUsagePanel() {
  const [data, setData] = useState<UsageData | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  const load = useCallback(async () => {
    active.current?.abort()
    const abort = new AbortController(); active.current = abort
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/ai/usage', {signal:abort.signal,cache:'no-store'})
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error()
      const result = await response.json() as UsageData
      if (!result.model || !result.today || !result.monthUsage || !Number.isFinite(result.today.totalTokens) || !Number.isFinite(result.monthUsage.totalTokens)) throw new Error()
      if (!abort.signal.aborted) setData(result)
    } catch { if (!abort.signal.aborted) setError('Chưa lấy được thống kê Gemini. Kiểm tra backend rồi thử lại.') }
    finally { if (active.current === abort) setBusy(false) }
  }, [])
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { if (!document.hidden) void load() },30_000)
    return () => { window.clearInterval(timer); active.current?.abort() }
  },[load])
  return <section className="panel mt-5 space-y-5 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-base font-semibold"><Sparkles size={19} className="text-emerald-700"/>Sử dụng Gemini</h2><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void load()}><RefreshCw size={14} className={busy ? 'animate-spin' : ''}/>Làm mới</Button></div>
    {error && <p role="alert" className="text-sm text-amber-700">{error}</p>}
    {!data && busy && <p role="status" className="text-sm text-slate-500">Đang lấy số liệu…</p>}
    {data && <><div className="flex flex-wrap items-center gap-2 text-xs"><code className="break-all rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-600">{data.model}</code><span className={data.aiConfigured ? 'text-emerald-700' : 'text-amber-700'}>{data.aiConfigured ? 'Đã cấu hình API key' : 'Chưa cấu hình API key'}</span></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs text-emerald-800">Token hôm nay</p><p className="mt-2 text-2xl font-semibold text-emerald-900">{number(data.today.totalTokens)}</p><p className="mt-2 text-xs text-emerald-700">Đầu vào {number(data.today.inputTokens)} · Đầu ra {number(data.today.outputTokens)}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Token tháng này</p><p className="mt-2 text-2xl font-semibold text-slate-800">{number(data.monthUsage.totalTokens)}</p><p className="mt-2 text-xs text-slate-500">Đầu vào {number(data.monthUsage.inputTokens)} · Đầu ra {number(data.monthUsage.outputTokens)}</p></div><div className="rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">Lượt gọi hôm nay</p><p className="mt-2 text-xl font-semibold">{number(data.today.requests)}</p></div><div className="rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">Lượt lỗi / chưa hoàn tất hôm nay</p><p className="mt-2 text-xl font-semibold">{number(data.today.failures)}</p></div></div>
      <p className="text-xs leading-6 text-slate-500">Số liệu của model này trên backend dùng chung, tính theo giờ Việt Nam, bắt đầu ghi nhận từ {new Date(data.startedAt).toLocaleString('vi-VN')}. Token đầu ra gồm token suy luận khi Gemini cung cấp.</p>
      {data.monthUsage.missingUsage > 0 && <p className="text-xs text-amber-700">{number(data.monthUsage.missingUsage)} lượt trong tháng chưa có số liệu token từ Gemini nên chưa được cộng vào tổng token.</p>}
      {data.storageMode==='memory'&&<p className="text-xs text-amber-700">Serverless: số liệu chỉ tạm lưu theo từng tiến trình và có thể reset. Xem Google AI Studio để lấy mức sử dụng toàn project.</p>}
      {data.storageError && <p className="text-xs text-amber-700">Lịch sử thống kê trên máy chủ gặp lỗi. Số liệu có thể thiếu sau khi khởi động lại backend.</p>}
    </>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="max-w-md text-xs leading-6 text-slate-500">Xem hạn mức và mức sử dụng toàn project trong Google AI Studio. Số token còn lại chưa được cung cấp trong thống kê này.</p><a href="https://aistudio.google.com/rate-limit?timeRange=last-28-days" target="_blank" rel="noopener noreferrer" className="secondary text-xs">Xem hạn mức<ExternalLink size={14}/></a></div>
  </section>
}
