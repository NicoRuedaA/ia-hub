import { describe, expect, it, beforeEach } from 'vitest'
import { createLocalStorageRepository } from './localStorageRepository'
import { defaultState, validateState } from './schema'
import type { PersistedState } from './repository'

function mockStorage(): Storage {
  let store: Record<string, string> = {}
  return {
    getItem(key: string) { return store[key] ?? null },
    setItem(key: string, value: string) { store[key] = value },
    removeItem(key: string) { delete store[key] },
    clear() { store = {} },
    get length() { return Object.keys(store).length },
    key(index: number) { return Object.keys(store)[index] ?? null },
  }
}

let storage: Storage

beforeEach(() => {
  storage = mockStorage()
})

function createRepo() {
  return createLocalStorageRepository(storage)
}

describe('defaultState', () => {
  it('returns default settings with a null claude config', () => {
    const state = defaultState()
    expect(state.schemaVersion).toBe(1)
    expect(state.settings.apiConfig).toEqual({ claude: null })
  })
})

describe('validateState', () => {
  it('accepts a valid state', () => {
    const state: PersistedState = {
      schemaVersion: 1,
      settings: { apiConfig: { claude: { sessionKey: 'abc', enabled: true } } },
    }
    expect(validateState(state)).toEqual(state)
  })

  it('accepts settings without apiConfig (backward compatible)', () => {
    const state = { schemaVersion: 1, settings: {} }
    expect(validateState(state)).toEqual(state)
  })

  it('rejects wrong schema version', () => {
    expect(validateState({ schemaVersion: 2, settings: {} })).toBeNull()
  })

  it('rejects missing settings', () => {
    expect(validateState({ schemaVersion: 1 })).toBeNull()
  })

  it('rejects a non-object apiConfig', () => {
    expect(validateState({ schemaVersion: 1, settings: { apiConfig: 'nope' } })).toBeNull()
  })

  it('rejects non-object', () => {
    expect(validateState('corrupt')).toBeNull()
  })

  it('rejects null', () => {
    expect(validateState(null)).toBeNull()
  })
})

describe('localStorageRepository round-trip', () => {
  it('returns default state on empty storage', () => {
    const repo = createRepo()
    const state = repo.load()
    expect(state).toEqual(defaultState())
  })

  it('persists and loads state', () => {
    const repo = createRepo()
    const state: PersistedState = {
      schemaVersion: 1,
      settings: { apiConfig: { codex: { sessionKey: 'x', enabled: true } } },
    }
    repo.save(state)
    const loaded = repo.load()
    expect(loaded).toEqual(state)
  })

  it('returns defaults and backs up corrupt data', () => {
    storage.setItem('ia-hub:v1', 'corrupt-json')
    const repo = createRepo()
    const state = repo.load()
    expect(state).toEqual(defaultState())
    expect(storage.getItem('ia-hub:backup-corrupt')).toBe('corrupt-json')
  })

  it('returns defaults on invalid JSON', () => {
    storage.setItem('ia-hub:v1', '{invalid')
    const repo = createRepo()
    const state = repo.load()
    expect(state).toEqual(defaultState())
  })
})
