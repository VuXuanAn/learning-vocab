import { normalizePreferences, type Preferences } from './preferences'
export type SyncStatus = { phase: 'loading' | 'pending' | 'saving' | 'saved' | 'error'; error?: unknown }
const keys = ['reminderEnabled', 'reminderMinutes', 'autoVoice'] as const
export function preferencePatch(value: unknown): Partial<Preferences> {
  const data = value as Partial<Preferences> | null
  const patch: Partial<Preferences> = {}
  if (typeof data?.autoVoice === 'boolean') patch.autoVoice = data.autoVoice
  if (typeof data?.reminderEnabled === 'boolean') patch.reminderEnabled = data.reminderEnabled
  if (Number.isInteger(data?.reminderMinutes) && data!.reminderMinutes! >= 1 && data!.reminderMinutes! <= 120) patch.reminderMinutes = data!.reminderMinutes
  return patch
}
interface Options {
  userId: string
  read: () => Preferences
  apply: (value: Preferences) => void
  subscribe: (listener: () => void) => () => void
  remote: { load: () => Promise<Preferences | null>; save: (patch: Partial<Preferences>) => Promise<Preferences> }
  storage: Pick<Storage, 'getItem' | 'setItem'>
  status: (status: SyncStatus) => void
  debounceMs?: number
}
export function createPreferencesSync(options: Options) {
  const key = 'vocab-settings-sync-' + encodeURIComponent(options.userId)
  let pending: Partial<Preferences> = {}
  try { pending = preferencePatch(JSON.parse(options.storage.getItem(key) || '{}')) } catch { /* Invalid pending data is ignored. */ }
  let last = normalizePreferences(options.read())
  let stopped = false, applying = false, running = false, loaded = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const persist = () => options.storage.setItem(key, JSON.stringify(pending))
  function apply(value: Preferences) {
    applying = true
    try { options.apply(value); last = normalizePreferences(options.read()) } finally { applying = false }
  }
  function schedule() {
    clearTimeout(timer)
    options.status({ phase: 'pending' })
    timer = setTimeout(() => void sync(), options.debounceMs ?? 500)
  }
  async function sync() {
    if (stopped || running) return
    running = true
    clearTimeout(timer)
    try {
      if (!loaded) {
        options.status({ phase: 'loading' })
        const remote = await options.remote.load()
        if (stopped) return
        if (remote) apply(normalizePreferences({ ...remote, ...pending }))
        else pending = { ...normalizePreferences(options.read()), ...pending }
        persist(); loaded = true
      }
      while (!stopped && Object.keys(pending).length) {
        const sent = { ...pending }
        options.status({ phase: 'saving' })
        const saved = await options.remote.save(sent)
        if (stopped) return
        for (const field of keys) if (field in sent && pending[field] === sent[field]) delete pending[field]
        persist()
        apply(normalizePreferences({ ...saved, ...pending }))
      }
      if (!stopped) options.status({ phase: 'saved' })
    } catch (error) { if (!stopped) options.status({ phase: 'error', error }) }
    finally { running = false }
  }
  const unsubscribe = options.subscribe(() => {
    const next = normalizePreferences(options.read())
    if (applying || stopped) { last = next; return }
    const changes = Object.fromEntries(keys.filter(field => last[field] !== next[field]).map(field => [field, next[field]]))
    last = next
    if (!Object.keys(changes).length) return
    pending = { ...pending, ...changes }
    try { persist(); schedule() } catch (error) { options.status({ phase: 'error', error }) }
  })
  void sync()
  return {
    retry: () => { if (!running) { loaded = false; void sync() } },
    stop: () => { stopped = true; clearTimeout(timer); unsubscribe() },
  }
}
