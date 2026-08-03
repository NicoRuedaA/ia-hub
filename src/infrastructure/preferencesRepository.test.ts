import { beforeEach, describe, expect, it } from 'vitest'
import { createPreferencesRepository, defaultPreferences, PREFERENCES_STORAGE_KEY } from './preferencesRepository'

beforeEach(() => {
  localStorage.clear()
})

describe('preferencesRepository', () => {
  it('defaults to light theme and first-run language selection', () => {
    const repository = createPreferencesRepository(localStorage)

    expect(repository.load()).toEqual(defaultPreferences())
  })

  it('persists preferences under their own storage key', () => {
    const repository = createPreferencesRepository(localStorage)
    const preferences = { theme: 'dark' as const, language: 'es' as const }

    repository.save(preferences)

    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBe(JSON.stringify(preferences))
    expect(repository.load()).toEqual(preferences)
  })

  it('ignores malformed preferences without touching provider data', () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, '{bad json')
    localStorage.setItem('ia-hub:v1', JSON.stringify({ schemaVersion: 1, settings: { apiConfig: { claude: null } } }))

    const repository = createPreferencesRepository(localStorage)

    expect(repository.load()).toEqual(defaultPreferences())
    expect(localStorage.getItem('ia-hub:v1')).toContain('claude')
  })
})
