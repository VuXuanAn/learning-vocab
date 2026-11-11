import { activateAccountDatabase } from './db'
import { activateAccountSettings } from './settings'
const preparations = new Map<string, Promise<void>>()
export function prepareAccountWorkspace(userId: string) {
  const existing = preparations.get(userId)
  if (existing) return existing
  const preparation = (async () => {
    const account = activateAccountDatabase(userId)
    activateAccountSettings(userId)
    await account.open()
  })()
  preparations.set(userId, preparation)
  void preparation.catch(() => preparations.delete(userId))
  return preparation
}
