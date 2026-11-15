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

// Layout choices belong to this browser and stay independent of cloud learning preferences.
interface LayoutSettingsStore {
  sidebarCollapsed: boolean
  reviewCornerVisible: boolean
  update: (patch: Partial<Pick<LayoutSettingsStore, 'sidebarCollapsed' | 'reviewCornerVisible'>>) => void
}
export const useLayoutSettings = create<LayoutSettingsStore>()(persist(set => ({
  sidebarCollapsed: false,
  reviewCornerVisible: true,
  update: patch => set(patch),
}), {
  name: 'vocab-layout-preferences',
  merge: (persisted, current) => {
    const saved = persisted as Partial<LayoutSettingsStore> | null
    return {
      ...current,
      sidebarCollapsed: typeof saved?.sidebarCollapsed === 'boolean' ? saved.sidebarCollapsed : false,
      reviewCornerVisible: typeof saved?.reviewCornerVisible === 'boolean' ? saved.reviewCornerVisible : true,
    }
  },
}))
