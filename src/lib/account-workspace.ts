import { activateAccountDatabase, migrateOwnedLegacy } from './db'
import { activateAccountSettings } from './settings'
import { restoreSnapshot } from './cloud-local'
import { supabase } from './supabase'

const preparations = new Map<string, Promise<void>>()
export function prepareAccountWorkspace(userId: string) {
  const existing = preparations.get(userId)
  if (existing) return existing
  const preparation = (async () => {
    const account = activateAccountDatabase(userId)
    const migrated = await migrateOwnedLegacy(account, userId)
    activateAccountSettings(userId, migrated)
    // Restore automatically only on a fresh account workspace. Existing local
    // work must never be overwritten by a background fetch.
    const empty = await account.transaction('r', account.tables, async () =>
      !await account.cloudMeta.get('current') && !await account.folders.count() &&
      !await account.notes.count() && !await account.templates.count() &&
      !await account.reviews.count() && !await account.reviewLogs.count())
    if (empty && supabase) {
      const { data, error } = await supabase.from('vocab_snapshots').select('payload,revision,updated_at').eq('user_id', userId).maybeSingle()
      if (error) throw error
      if (data) await restoreSnapshot(data.payload, userId, Number(data.revision))
    }
  })()
  preparations.set(userId, preparation)
  void preparation.catch(() => preparations.delete(userId))
  return preparation
}
