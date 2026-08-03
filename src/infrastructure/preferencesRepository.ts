import type { Language, Theme } from '../domain/types'

export const PREFERENCES_STORAGE_KEY = 'ia-hub:preferences:v1'

export interface Preferences {
  theme: Theme
  language: Language
}

export interface PreferencesRepository {
  load(): Preferences
  save(preferences: Preferences): void
}

export function defaultPreferences(): Preferences {
  return { theme: 'light', language: null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

function isLanguage(value: unknown): value is Language {
  return value === null || value === 'en' || value === 'es'
}

function parsePreferences(value: unknown): Preferences | null {
  if (!isRecord(value) || !isTheme(value.theme) || !isLanguage(value.language)) return null
  return { theme: value.theme, language: value.language }
}

export function createPreferencesRepository(storage?: Storage): PreferencesRepository {
  return {
    load() {
      if (!storage) return defaultPreferences()
      try {
        const raw = storage.getItem(PREFERENCES_STORAGE_KEY)
        if (!raw) return defaultPreferences()
        const parsed = parsePreferences(JSON.parse(raw))
        return parsed ?? defaultPreferences()
      } catch {
        return defaultPreferences()
      }
    },
    save(preferences) {
      try {
        storage?.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
      } catch {
        // Preferences are best-effort when storage is unavailable or disabled.
      }
    },
  }
}
