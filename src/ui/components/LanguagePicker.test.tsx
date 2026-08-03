import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePreferencesStore } from '../../state/preferencesStore'
import LanguagePicker from './LanguagePicker'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.dataset.theme = 'light'
  usePreferencesStore.setState({ theme: 'light', language: null })
})

describe('LanguagePicker', () => {
  it('requires a language and ignores Escape and outside clicks', () => {
    render(<LanguagePicker open />)
    screen.getByRole('dialog', { name: 'Choose your language' })

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.mouseDown(document.querySelector('.modal-overlay') as HTMLElement)

    expect(screen.getByRole('dialog', { name: 'Choose your language' })).toBeInTheDocument()
  })

  it('persists the selected language and applies it immediately', () => {
    render(<LanguagePicker open />)

    fireEvent.click(screen.getByRole('button', { name: /Continue in Español/ }))

    expect(usePreferencesStore.getState().language).toBe('es')
    expect(document.documentElement.lang).toBe('es')
    expect(localStorage.getItem('ia-hub:preferences:v1')).toContain('"language":"es"')
  })
})
