import { useEffect, useState, type ReactNode } from 'react'
import { liveQuery } from 'dexie'
import { useAuth } from './AuthProvider'
import { db } from './db'
import { supabase } from './supabase'
import { createRowTransport } from './row-transport'
import { readLocalRows, syncRowCycle } from './row-sync'
import { encodeRow, stable, type RowTable } from './row-codec'
import { rowSyncErrorMessage } from './row-sync-error'

const tables: readonly RowTable[] = ['grammarFolders', 'grammarEntries']
export default function GrammarSyncProvider({ children }: { children: ReactNode }) {
 const { session } = useAuth()
 const userId = session?.user.id
 const [error, setError] = useState<unknown>(null)
 useEffect(() => {
  if (!supabase || !userId) return
  const account = db, transport = createRowTransport(supabase, userId)
  let stopped = false, running = false, queued = false
  let timer: ReturnType<typeof setTimeout> | undefined
  async function run() {
   if (stopped) return
   if (running) { queued = true; return }
   if (navigator.onLine === false) return
   running = true; queued = false
   let failed = false
   try {
    const cycle = () => syncRowCycle(account, transport, () => !stopped, 'merge', tables)
    if (navigator.locks) await navigator.locks.request('vocab-rows-'+userId, cycle)
    else await cycle()
    if (!stopped) setError(null)
   } catch (error) { failed = true; if (!stopped) setError(error) }
   finally {
    running = false
    if (!stopped && (queued || failed)) schedule(failed ? 30_000 : 250)
   }
  }
  function schedule(delay = 250) {
   clearTimeout(timer)
   timer = setTimeout(() => { void run() }, delay)
  }
  // Observe only Grammar content changes; acknowledgements must not trigger a loop.
  let previous = ''
  const subscription = liveQuery(async () => {
   const local = await readLocalRows(account)
   return stable(tables.map(table => [table, [...local.tables[table].values()].map(row => [row.id, encodeRow(table, row)])]))
  }).subscribe({next:signature => {
   if (signature !== previous) { previous = signature; schedule() }
  }, error:reason => { if (!stopped) setError(reason) }})
  const retry = () => schedule()
  window.addEventListener('online', retry)
  window.addEventListener('focus', retry)
  return () => {
   stopped = true; clearTimeout(timer); subscription.unsubscribe()
   window.removeEventListener('online', retry); window.removeEventListener('focus', retry)
  }
 }, [userId])
 return <>{error != null && <p role="alert" className="shrink-0 px-6 py-2 text-sm text-amber-700">Grammar: {rowSyncErrorMessage(error)} Tự thử lại khi có mạng.</p>}{children}</>
}
