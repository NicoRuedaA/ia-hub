import type { PersistedState } from './repository'
import type { Settings } from '../domain/types'

const CURRENT_VERSION = 1 as const

export function defaultState(): PersistedState {
  return {
    schemaVersion: CURRENT_VERSION,
    settings: {
      apiConfig: {
        claude: null,
      },
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidSettings(value: unknown): value is Settings {
  if (!isRecord(value)) return false
  // apiConfig is optional for backward compatibility
  if (value.apiConfig !== undefined && value.apiConfig !== null) {
    if (!isRecord(value.apiConfig)) return false
  }
  return true
}

export function validateState(value: unknown): PersistedState | null {
  if (!isRecord(value)) return null
  if (value.schemaVersion !== CURRENT_VERSION) return null
  if (!isValidSettings(value.settings)) return null
  return value as unknown as PersistedState
}
