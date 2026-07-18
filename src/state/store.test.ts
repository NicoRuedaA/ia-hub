import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UsageLimit } from '../domain/types'
import { useAppStore } from './store'

const claudeLimit: UsageLimit = {
  id: 'claude-five-hour',
  name: 'Claude · Session (5h)',
  provider: 'anthropic',
  used: 25,
  limit: 100,
  unit: 'percent',
  resetsAt: null,
}

const codexLimit: UsageLimit = {
  id: 'codex-weekly',
  name: 'Codex · Weekly Usage',
  provider: 'codex',
  used: 40,
  limit: 100,
  unit: 'percent',
  resetsAt: null,
}

function mockElectronApi(overrides: Partial<ElectronAPI> = {}): ElectronAPI {
  return {
    claudeLogin: vi.fn(),
    claudeLogout: vi.fn(),
    claudeFetchUsage: vi.fn(),
    opencodeLogin: vi.fn(),
    opencodeLogout: vi.fn(),
    opencodeFetchUsage: vi.fn(),
    opencodeDebugCookies: vi.fn(),
    codexLogin: vi.fn(),
    codexLogout: vi.fn(),
    codexFetchUsage: vi.fn(),
    geminiLogin: vi.fn(),
    geminiLogout: vi.fn(),
    geminiFetchUsage: vi.fn(),
    ...overrides,
  } as ElectronAPI
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function claudeResponse(utilization: number): Awaited<ReturnType<ElectronAPI['claudeFetchUsage']>> {
  return {
    usage: { five_hour: { utilization, resets_at: null } },
    organizations: [],
    overage: null,
  }
}

beforeEach(() => {
  localStorage.clear()
  delete window.electronAPI
  useAppStore.setState({
    settings: { apiConfig: { claude: null, codex: null, opencode: null, gemini: null } },
    currentPage: 'dashboard',
    usageLimits: [],
    usageLoading: false,
    usageError: null,
  })
})

describe('usage lifecycle', () => {
  it('removes only the disconnected provider usage and clears all usage after the last disconnect', () => {
    useAppStore.setState({
      settings: {
        apiConfig: {
          claude: { sessionKey: 'claude-session', enabled: true },
          codex: { sessionKey: 'codex-session', enabled: true },
        },
      },
      usageLimits: [claudeLimit, codexLimit],
      usageLoading: true,
      usageError: 'stale error',
    })

    useAppStore.getState().updateClaudeConfig(null)
    expect(useAppStore.getState().usageLimits).toEqual([codexLimit])
    expect(useAppStore.getState().usageError).toBeNull()
    expect(useAppStore.getState().usageLoading).toBe(false)

    useAppStore.getState().updateCodexConfig(null)
    expect(useAppStore.getState().usageLimits).toEqual([])
    expect(useAppStore.getState().usageLoading).toBe(false)
  })

  it('clears transient usage state when imported data replaces settings', () => {
    useAppStore.setState({ usageLimits: [claudeLimit], usageLoading: true, usageError: 'old error' })

    useAppStore.getState().importData({
      schemaVersion: 1,
      settings: { apiConfig: { gemini: { sessionKey: 'gemini-session', enabled: true } } },
    })

    expect(useAppStore.getState().usageLimits).toEqual([])
    expect(useAppStore.getState().usageLoading).toBe(false)
    expect(useAppStore.getState().usageError).toBeNull()
  })

  it('returns an explicit failure when a provider refresh fails', async () => {
    window.electronAPI = mockElectronApi({
      claudeFetchUsage: vi.fn().mockRejectedValue(new Error('session expired')),
    })
    useAppStore.setState({
      settings: { apiConfig: { claude: { sessionKey: 'claude-session', enabled: true } } },
    })

    const result = await useAppStore.getState().fetchUsage()

    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(['Claude: session expired'])
    expect(result.limitsCount).toBe(0)
    expect(useAppStore.getState().usageError).toBe('Claude: session expired')
    expect(useAppStore.getState().usageLoading).toBe(false)
  })

  it('does not restore stale usage if a provider disconnects during refresh', async () => {
    const request = deferred<Awaited<ReturnType<ElectronAPI['claudeFetchUsage']>>>()
    window.electronAPI = mockElectronApi({ claudeFetchUsage: vi.fn(() => request.promise) })
    useAppStore.setState({
      settings: { apiConfig: { claude: { sessionKey: 'claude-session', enabled: true } } },
    })

    const refresh = useAppStore.getState().fetchUsage()
    useAppStore.getState().updateClaudeConfig(null)
    request.resolve(claudeResponse(35))

    const result = await refresh
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('superseded')
    expect(useAppStore.getState().usageLimits).toEqual([])
  })

  it('discards a late rejection after imported settings replace the session', async () => {
    const request = deferred<Awaited<ReturnType<ElectronAPI['claudeFetchUsage']>>>()
    window.electronAPI = mockElectronApi({ claudeFetchUsage: vi.fn(() => request.promise) })
    useAppStore.setState({
      settings: { apiConfig: { claude: { sessionKey: 'old-session', enabled: true } } },
    })

    const refresh = useAppStore.getState().fetchUsage()
    useAppStore.getState().importData({
      schemaVersion: 1,
      settings: { apiConfig: { gemini: { sessionKey: 'imported-session', enabled: true } } },
    })
    request.reject(new Error('expired old session'))

    const result = await refresh
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('superseded')
    expect(useAppStore.getState().usageError).toBeNull()
    expect(useAppStore.getState().usageLoading).toBe(false)
    expect(useAppStore.getState().settings.apiConfig?.gemini?.sessionKey).toBe('imported-session')
  })

  it('discards old-session results after reconnecting the same provider', async () => {
    const request = deferred<Awaited<ReturnType<ElectronAPI['claudeFetchUsage']>>>()
    window.electronAPI = mockElectronApi({ claudeFetchUsage: vi.fn(() => request.promise) })
    useAppStore.setState({
      settings: { apiConfig: { claude: { sessionKey: 'old-session', enabled: true } } },
    })

    const refresh = useAppStore.getState().fetchUsage()
    useAppStore.getState().updateClaudeConfig({ sessionKey: 'new-session', enabled: true })
    request.resolve(claudeResponse(88))

    const result = await refresh
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('superseded')
    expect(useAppStore.getState().settings.apiConfig?.claude?.sessionKey).toBe('new-session')
    expect(useAppStore.getState().usageLimits).toEqual([])
    expect(useAppStore.getState().usageLoading).toBe(false)
  })

  it('keeps only the newest result when usage refreshes overlap', async () => {
    const firstRequest = deferred<Awaited<ReturnType<ElectronAPI['claudeFetchUsage']>>>()
    const secondRequest = deferred<Awaited<ReturnType<ElectronAPI['claudeFetchUsage']>>>()
    window.electronAPI = mockElectronApi({
      claudeFetchUsage: vi.fn()
        .mockImplementationOnce(() => firstRequest.promise)
        .mockImplementationOnce(() => secondRequest.promise),
    })
    useAppStore.setState({
      settings: { apiConfig: { claude: { sessionKey: 'claude-session', enabled: true } } },
    })

    const firstRefresh = useAppStore.getState().fetchUsage()
    const secondRefresh = useAppStore.getState().fetchUsage()

    secondRequest.resolve(claudeResponse(22))
    const secondResult = await secondRefresh
    expect(secondResult).toEqual({ ok: true, errors: [], limitsCount: 1 })
    expect(useAppStore.getState().usageLimits[0]?.used).toBe(22)

    firstRequest.resolve(claudeResponse(91))
    const firstResult = await firstRefresh
    expect(firstResult.ok).toBe(false)
    expect(firstResult.errors[0]).toContain('superseded')
    expect(useAppStore.getState().usageLimits[0]?.used).toBe(22)
    expect(useAppStore.getState().usageLoading).toBe(false)
  })
})
