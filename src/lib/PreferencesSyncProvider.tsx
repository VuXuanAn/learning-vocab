import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPreferencesSync, type SyncStatus } from './preferences-sync'
import { normalizePreferences } from './preferences'
import { useSettings } from './settings'
import { useAuth } from './AuthProvider'
import { supabase } from './supabase'
const Context = createContext<{ status: SyncStatus; retry: () => void }>({ status: { phase: 'loading' }, retry: () => {} })
export const usePreferencesSync = () => useContext(Context)
export default function PreferencesSyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [status, setStatus] = useState<SyncStatus>({ phase: 'loading' })
  const [retry, setRetry] = useState<() => void>(() => () => {})
  const userId = session?.user.id
  useEffect(() => {
    const client = supabase
    if (!userId || !client) return
    const sync = createPreferencesSync({
      userId, storage: localStorage, read: () => normalizePreferences(useSettings.getState()),
      apply: value => useSettings.getState().update(value),
      subscribe: listener => useSettings.subscribe(listener), status: setStatus,
      remote: {
        load: async () => {
          const { data, error } = await client.from('user_preferences').select('preferences').eq('user_id', userId).maybeSingle()
          if (error) throw error
          return data ? normalizePreferences(data.preferences) : null
        },
        save: async patch => {
          const { data, error } = await client.rpc('save_user_preferences', { p_user_id: userId, p_patch: patch })
          if (error) throw error
          if (!data?.[0]?.preferences) throw new Error('Missing preferences')
          return normalizePreferences(data[0].preferences)
        },
      },
    })
    setRetry(() => sync.retry)
    window.addEventListener('online', sync.retry)
    window.addEventListener('focus', sync.retry)
    return () => { sync.stop(); window.removeEventListener('online', sync.retry); window.removeEventListener('focus', sync.retry) }
  }, [userId])
  return <Context value={{ status, retry }}>{children}</Context>
}
