import { create } from 'zustand'
import type { Language, Theme } from '../domain/types'
import { createPreferencesRepository, type Preferences } from '../infrastructure/preferencesRepository'

const storage = typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : undefined
const repository = createPreferencesRepository(storage)
const initialPreferences = repository.load()

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}

export function applyLanguage(language: Language): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = language ?? 'en'
}

applyTheme(initialPreferences.theme)
applyLanguage(initialPreferences.language)

export interface PreferencesState extends Preferences {
  setTheme: (theme: Theme) => void
  setLanguage: (language: Exclude<Language, null>) => void
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  ...initialPreferences,
  setTheme: (theme) => {
    applyTheme(theme)
    set((state) => {
      const preferences = { ...state, theme }
      repository.save({ theme: preferences.theme, language: preferences.language })
      return { theme }
    })
  },
  setLanguage: (language) => {
    applyLanguage(language)
    set((state) => {
      const preferences = { ...state, language }
      repository.save({ theme: preferences.theme, language: preferences.language })
      return { language }
    })
  },
}))
