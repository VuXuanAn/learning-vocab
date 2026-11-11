import { create } from 'zustand'
import type { RowSyncStatus, RowSyncMode } from './row-sync'
interface VocabularySyncState {
  status: RowSyncStatus | { phase: 'idle' }
  pending: boolean
  ready: boolean
  firstSync: boolean
  lastSyncAt?: string
  canRestore: boolean
  sync: (mode?: RowSyncMode) => void
  restore: () => Promise<void>
}
export const useVocabularySyncState = create<VocabularySyncState>(() => ({
  status: { phase: 'idle' }, pending: false, ready: false, firstSync: true, canRestore: false, sync: () => {}, restore: async () => {},
}))
