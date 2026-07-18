import type { Repository, PersistedState } from './repository'
import { defaultState, validateState } from './schema'

const STORAGE_KEY = 'ia-hub:v1'
const BACKUP_KEY = 'ia-hub:backup-corrupt'

export function createLocalStorageRepository(storage: Storage): Repository {
  return {
    load(): PersistedState {
      try {
        const raw = storage.getItem(STORAGE_KEY)
        if (!raw) return defaultState()

        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch {
          storage.setItem(BACKUP_KEY, raw)
          return defaultState()
        }

        const validated = validateState(parsed)
        if (validated) return validated

        storage.setItem(BACKUP_KEY, raw)
        return defaultState()
      } catch {
        return defaultState()
      }
    },

    save(state: PersistedState): void {
      storage.setItem(STORAGE_KEY, JSON.stringify(state))
    },
  }
}
