export function publicSupabaseConfig(rawUrl?: string, rawKey?: string) {
  const url = rawUrl?.trim() ?? ''
  const key = rawKey?.trim() ?? ''
  if (!url || !key) return {url,key,error:''}
  let validUrl = false
  try { const parsed = new URL(url); validUrl = parsed.protocol === 'https:' && parsed.pathname === '/' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash } catch { /* Show configuration error below. */ }
  let validKey = key.startsWith('sb_publishable_')
  if (!key.startsWith('sb_')) {
    try { validKey = JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role === 'anon' } catch { validKey = false }
  }
  return {url,key,error:validUrl && validKey ? '' : 'Dùng URL project HTTPS và publishable/anon key. Không đặt secret hoặc service_role key vào frontend.'}
}
