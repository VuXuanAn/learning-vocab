import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultPreferences, normalizePreferences, type Preferences } from './preferences'
interface SettingsStore extends Preferences { update: (patch: Partial<Preferences>) => void }
export const useSettings = create<SettingsStore>()(persist((set, get) => ({ ...defaultPreferences, update: patch => set(normalizePreferences({ ...get(), ...patch })) }), { name: 'vocab-preferences', version: 1, merge: (persisted, current) => ({ ...current, ...normalizePreferences(persisted as Partial<Preferences>) }) }))

export function activateAccountSettings(userId: string, migrateLegacy = false) {
  const name = 'vocab-preferences-account-' + encodeURIComponent(userId)
  const saved = localStorage.getItem(name) ?? (migrateLegacy ? localStorage.getItem('vocab-preferences') : null)
  let preferences = defaultPreferences
  if (saved) {
    try { preferences = normalizePreferences(JSON.parse(saved).state) } catch { /* Use defaults for invalid saved preferences. */ }
  }
  useSettings.persist.setOptions({ name })
  useSettings.setState(preferences)
}
