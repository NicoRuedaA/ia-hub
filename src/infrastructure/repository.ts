import type { Settings } from '../domain/types'

export interface PersistedState {
  schemaVersion: 1
  settings: Settings
}

export interface Repository {
  load(): PersistedState
  save(state: PersistedState): void
}
