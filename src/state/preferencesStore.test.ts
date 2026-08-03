import { beforeEach, describe, expect, it } from 'vitest'
import { usePreferencesStore } from './preferencesStore'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.dataset.theme = 'light'
  document.documentElement.lang = 'en'
  usePreferencesStore.setState({ theme: 'light', language: null })
})

describe('preferencesStore', () => {
  it('applies and persists a theme change immediately', () => {
    usePreferencesStore.getState().setTheme('dark')

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('ia-hub:preferences:v1')).toContain('"theme":"dark"')
  })

  it('applies and persists a language change immediately', () => {
    usePreferencesStore.getState().setLanguage('es')

    expect(document.documentElement.lang).toBe('es')
    expect(localStorage.getItem('ia-hub:preferences:v1')).toContain('"language":"es"')
  })
})
