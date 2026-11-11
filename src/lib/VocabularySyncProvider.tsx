import { useEffect, type ReactNode } from 'react'
import { liveQuery } from 'dexie'
import { useAuth } from './AuthProvider'
import { db } from './db'
import { createRowTransport } from './row-transport'
import { createRowSync, syncRowCycle, readLocalRows, hasPendingRows, restoreSyncBackup, type RowSyncMode } from './row-sync'
import { rowSyncErrorMessage } from './row-sync-error'
import { useVocabularySyncState } from './vocabulary-sync-state'
import { supabase } from './supabase'
export default function VocabularySyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const status = useVocabularySyncState(state => state.status)
  useEffect(() => {
    if (!supabase || !userId) return
    const account = db
    const transport = createRowTransport(supabase, userId)
    let requestedMode: RowSyncMode = 'merge'
    const sync = createRowSync({
      status: next => useVocabularySyncState.setState({ status: next }),
      cycle: active => {
        const cycle = () => syncRowCycle(account, transport, active, requestedMode)
        return navigator.locks ? navigator.locks.request('vocab-rows-' + userId, cycle) : cycle()
      },
    })
    useVocabularySyncState.setState({ ready: true, status: { phase: 'idle' }, pending: false, sync: (mode = 'merge') => { if (useVocabularySyncState.getState().status.phase === 'syncing') return; requestedMode = mode; sync.retry() }, restore: () => restoreSyncBackup(account) })
    // Local observation only: no server calls until the header button is clicked.
    const subscription = liveQuery(async () => {
      const [local, meta, backups] = await Promise.all([readLocalRows(account), account.syncMeta.get('current'), account.syncBackups.count()])
      return { pending: hasPendingRows(local), firstSync: !meta, lastSyncAt: meta?.lastSyncAt, canRestore: backups > 0 }
    }).subscribe({
      next: state => useVocabularySyncState.setState(state),
      error: error => useVocabularySyncState.setState({ status: { phase: 'error', error } }),
    })
    return () => {
      subscription.unsubscribe(); sync.stop()
      useVocabularySyncState.setState({ ready: false, status: { phase: 'idle' }, pending: false, firstSync: true, lastSyncAt: undefined, canRestore: false, sync: () => {}, restore: async () => {} })
    }
  }, [userId])
  return <>{status.phase === 'error' && <p role="alert" className="mx-auto max-w-7xl px-6 pt-4 text-sm text-amber-700">{rowSyncErrorMessage(status.error)}</p>}{children}</>
}
