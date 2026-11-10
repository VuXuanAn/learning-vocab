export interface Preferences { reminderEnabled: boolean; reminderMinutes: number; autoVoice: boolean }
export const defaultPreferences: Preferences = { reminderEnabled: true, reminderMinutes: 5, autoVoice: false }
export function normalizePreferences(value: Partial<Preferences> | null | undefined): Preferences {
  return { reminderEnabled: typeof value?.reminderEnabled === 'boolean' ? value.reminderEnabled : true, autoVoice: typeof value?.autoVoice === 'boolean' ? value.autoVoice : false, reminderMinutes: Number.isInteger(value?.reminderMinutes) && value!.reminderMinutes! >= 1 && value!.reminderMinutes! <= 120 ? value!.reminderMinutes! : 5 }
}
