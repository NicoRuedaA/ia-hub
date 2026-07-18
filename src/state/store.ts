import { create } from 'zustand'
import type { Settings, UsageLimit, AnthropicUsageResponse, ClaudeAPIConfig, OpenCodeAPIConfig, CodexAPIConfig, GeminiAPIConfig } from '../domain/types'
import type { PersistedState } from '../infrastructure/repository'
import { createLocalStorageRepository } from '../infrastructure/localStorageRepository'

const repo = createLocalStorageRepository(localStorage)

export type Page = 'dashboard' | 'settings'

export interface UsageFetchResult {
  ok: boolean
  errors: string[]
  limitsCount: number
}

function discardedFetchResult(): UsageFetchResult {
  return {
    ok: false,
    errors: ['Usage refresh was superseded by a newer request or connection change.'],
    limitsCount: 0,
  }
}

export interface AppState {
  settings: Settings
  currentPage: Page
  usageLimits: UsageLimit[]
  usageLoading: boolean
  usageError: string | null

  setPage: (page: Page) => void
  updateClaudeConfig: (config: ClaudeAPIConfig | null) => void
  updateOpenCodeConfig: (config: OpenCodeAPIConfig | null) => void
  updateCodexConfig: (config: CodexAPIConfig | null) => void
  updateGeminiConfig: (config: GeminiAPIConfig | null) => void
  fetchUsage: () => Promise<UsageFetchResult>
  importData: (state: PersistedState) => void
  exportData: () => PersistedState
}

function persist(get: () => AppState) {
  const { settings } = get()
  repo.save({ schemaVersion: 1, settings })
}

function isLimitProviderEnabled(settings: Settings, provider: UsageLimit['provider']): boolean {
  if (provider === 'anthropic') return !!(settings.apiConfig?.claude?.enabled && settings.apiConfig.claude.sessionKey)
  if (provider === 'opencode') return !!(settings.apiConfig?.opencode?.enabled && settings.apiConfig.opencode.sessionKey)
  if (provider === 'codex') return !!(settings.apiConfig?.codex?.enabled && settings.apiConfig.codex.sessionKey)
  if (provider === 'gemini') return !!(settings.apiConfig?.gemini?.enabled && settings.apiConfig.gemini.sessionKey)
  return false
}

// ── Parsers ──────────────────────────────────────────────────────

function parseClaudeUsage(usage: AnthropicUsageResponse): UsageLimit[] {
  const limits: UsageLimit[] = []

  if (usage.five_hour) {
    const fh = usage.five_hour
    limits.push({
      id: 'claude-five-hour',
      name: 'Claude · Session (5h)',
      provider: 'anthropic',
      used: Number(fh.utilization ?? 0),
      limit: 100,
      unit: 'percent',
      resetsAt: fh.resets_at ?? null,
    })
  }

  if (usage.seven_day) {
    const sd = usage.seven_day
    limits.push({
      id: 'claude-seven-day',
      name: 'Claude · Weekly (All Models)',
      provider: 'anthropic',
      used: Number(sd.utilization ?? 0),
      limit: 100,
      unit: 'percent',
      resetsAt: sd.resets_at ?? null,
    })
  }

  if (usage.seven_day_opus) {
    const sd = usage.seven_day_opus
    limits.push({
      id: 'claude-seven-day-opus',
      name: 'Claude · Weekly (Opus)',
      provider: 'anthropic',
      used: Number(sd.utilization ?? 0),
      limit: 100,
      unit: 'percent',
      resetsAt: null,
    })
  }

  if (Array.isArray(usage.limits)) {
    for (const limit of usage.limits) {
      if (limit.kind !== 'weekly_scoped') continue
      const modelName = limit.scope?.model?.display_name
      if (!modelName) continue
      const percent = Number(limit.percent ?? 0)
      const resetAt = limit.resets_at ?? null
      const id = `claude-${modelName.toLowerCase().replace(/\s+/g, '-')}`
      const name = `Claude · ${modelName}`

      const existing = limits.findIndex((l) => l.name.toLowerCase() === name.toLowerCase())
      if (existing >= 0) limits.splice(existing, 1)

      limits.push({ id, name, provider: 'anthropic', used: percent, limit: 100, unit: 'percent', resetsAt: resetAt })
    }
  }

  return limits
}

// OpenCode Go — scrape parser for DOM-extracted usage data

function parseResetTime(text: string): string | null {
  const match = text.match(/(\d+)\s*(hour|minute|day|second)/gi)
  if (!match) return null
  let ms = 0
  for (const part of match) {
    const n = parseInt(part)
    if (/hour/i.test(part)) ms += n * 3600000
    else if (/minute/i.test(part)) ms += n * 60000
    else if (/day/i.test(part)) ms += n * 86400000
    else if (/second/i.test(part)) ms += n * 1000
  }
  return ms > 0 ? new Date(Date.now() + ms).toISOString() : null
}

// Codex shows "Reset Date" (e.g. "Jul 23, 2026 12:07 PM") instead of "Resets in X hours"
function parseResetDate(text: string): string | null {
  try {
    const d = new Date(text)
    return isNaN(d.getTime()) ? null : d.toISOString()
  } catch {
    return null
  }
}

function parseGeminiUsage(results: Array<{ url: string; status: number; data: unknown }>): UsageLimit[] {
  const domResult = results.find((r) => r.url === 'dom-scrape' && r.status === 200 && r.data)
  if (!domResult) return []

  const data = domResult.data as Record<string, unknown>
  const usage = data.usage as
    | Array<{ id?: string; name?: string; value?: number; resetsAt?: string | null }>
    | undefined
  if (!Array.isArray(usage)) return []

  return usage.map((u) => ({
    id: u.id || 'gemini',
    name: u.name || 'Gemini',
    provider: 'gemini' as const,
    used: u.value ?? 0,
    limit: 100,
    unit: 'percent' as const,
    resetsAt: u.resetsAt ?? null,
  }))
}

function parseCodexUsage(results: Array<{ url: string; status: number; data: unknown }>): UsageLimit[] {
  console.log('[IA Hub] Codex results:', JSON.stringify(results, null, 2))

  const domResult = results.find((r) => r.url === 'dom-scrape' && r.status === 200 && r.data)
  if (!domResult) return []

  const data = domResult.data as Record<string, unknown>
  const usage = data.usage as Array<{ label?: string; value?: number; remaining?: number; display?: string }> | undefined
  const resets = data.resets as string[] | undefined
  const turns = data.turns as number | null | undefined

  const limits: UsageLimit[] = []

  if (Array.isArray(usage)) {
    for (let i = 0; i < usage.length; i++) {
      const item = usage[i]
      const used = item.value ?? 0

      // Try to parse reset as "Resets in X" or as a date
      let resetsAt: string | null = null
      if (resets?.[i]) {
        resetsAt = parseResetTime(resets[i]) ?? parseResetDate(resets[i])
      }

      limits.push({
        id: `codex-weekly`,
        name: typeof turns === 'number' ? `Codex · Weekly Usage · ${turns} turns` : 'Codex · Weekly Usage',
        provider: 'codex' as const,
        used,
        limit: 100,
        unit: 'percent' as const,
        resetsAt,
      })
    }
  }

  // If we found turns, log it (we don't have a box for it yet, but we could add it)
  if (turns !== null && turns !== undefined) {
    console.log('[IA Hub] Codex turns:', turns)
  }

  if (limits.length === 0) {
    console.log('[IA Hub] Codex: no usage found. URL:', data.url)
  }

  return limits
}

function parseOpenCodeUsage(results: Array<{ url: string; status: number; data: unknown }>): UsageLimit[] {
  console.log('[IA Hub] OpenCode results:', JSON.stringify(results, null, 2))

  const domResult = results.find((r) => r.url === 'dom-scrape' && r.status === 200 && r.data)
  if (!domResult) return []

  const data = domResult.data as Record<string, unknown>

  // Format 1: { usage: [{ label, value }], resets: [...] }
  const usage = data.usage as Array<{ label?: string; name?: string; value?: number; percent?: number }> | undefined
  const resets = data.resets as string[] | undefined

  if (Array.isArray(usage) && usage.length > 0) {
    return usage.map((item, i) => {
      const label = item.label || item.name || 'Usage'
      const pct = item.value ?? item.percent ?? 0

      let id = 'opencode-unknown'
      let name = label
      if (/rolling|session|5h|5 hour/i.test(label)) {
        id = 'opencode-five-hour'
        name = 'OpenCode Go · Rolling (5h)'
      } else if (/weekly|week|7d/i.test(label)) {
        id = 'opencode-seven-day'
        name = 'OpenCode Go · Weekly'
      } else if (/monthly|month|30d/i.test(label)) {
        id = 'opencode-monthly'
        name = 'OpenCode Go · Monthly'
      }

      return {
        id,
        name,
        provider: 'opencode' as const,
        used: pct,
        limit: 100,
        unit: 'percent' as const,
        resetsAt: resets?.[i] ? parseResetTime(resets[i]) : null,
      }
    })
  }

  console.log('[IA Hub] OpenCode: no usage found. URL:', data.url)
  return []
}

// ── Store ────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => {
  let usageGeneration = 0
  const loaded = repo.load()

  const settings: Settings = {
    ...loaded.settings,
    apiConfig: loaded.settings.apiConfig ?? { claude: null },
  }

  return {
    settings,
    currentPage: 'dashboard',
    usageLimits: [],
    usageLoading: false,
    usageError: null,

    setPage: (page) => set({ currentPage: page }),

    updateClaudeConfig: (config) => {
      usageGeneration += 1
      set((s) => {
        const settings = {
          ...s.settings,
          apiConfig: {
            ...(s.settings.apiConfig ?? {}),
            claude: config,
          },
        }
        return {
          settings,
          usageLimits: config ? s.usageLimits : s.usageLimits.filter((limit) => limit.provider !== 'anthropic'),
          usageError: config ? s.usageError : null,
          usageLoading: false,
        }
      })
      persist(get)
    },

    updateOpenCodeConfig: (config) => {
      usageGeneration += 1
      set((s) => {
        const settings = {
          ...s.settings,
          apiConfig: {
            ...(s.settings.apiConfig ?? {}),
            opencode: config,
          },
        }
        return {
          settings,
          usageLimits: config ? s.usageLimits : s.usageLimits.filter((limit) => limit.provider !== 'opencode'),
          usageError: config ? s.usageError : null,
          usageLoading: false,
        }
      })
      persist(get)
    },

    updateCodexConfig: (config) => {
      usageGeneration += 1
      set((s) => {
        const settings = {
          ...s.settings,
          apiConfig: {
            ...(s.settings.apiConfig ?? {}),
            codex: config,
          },
        }
        return {
          settings,
          usageLimits: config ? s.usageLimits : s.usageLimits.filter((limit) => limit.provider !== 'codex'),
          usageError: config ? s.usageError : null,
          usageLoading: false,
        }
      })
      persist(get)
    },

    updateGeminiConfig: (config) => {
      usageGeneration += 1
      set((s) => {
        const settings = {
          ...s.settings,
          apiConfig: {
            ...(s.settings.apiConfig ?? {}),
            gemini: config,
          },
        }
        return {
          settings,
          usageLimits: config ? s.usageLimits : s.usageLimits.filter((limit) => limit.provider !== 'gemini'),
          usageError: config ? s.usageError : null,
          usageLoading: false,
        }
      })
      persist(get)
    },

    fetchUsage: async () => {
      const requestGeneration = ++usageGeneration
      const isCurrentRequest = () => requestGeneration === usageGeneration
      const { settings } = get()
      const claudeConfig = settings.apiConfig?.claude
      const opencodeConfig = settings.apiConfig?.opencode
      const codexConfig = settings.apiConfig?.codex
      const geminiConfig = settings.apiConfig?.gemini

      if (!claudeConfig?.enabled && !opencodeConfig?.enabled && !codexConfig?.enabled && !geminiConfig?.enabled) {
        set({ usageLimits: [], usageLoading: false, usageError: null })
        return { ok: true, errors: [], limitsCount: 0 }
      }

      if (!window.electronAPI) {
        const errors = ['Electron API not available. Run with npm run dev:electron']
        set({ usageLoading: false, usageError: errors[0] })
        return { ok: false, errors, limitsCount: 0 }
      }

      set({ usageLoading: true, usageError: null })

      const limits: UsageLimit[] = []
      const errors: string[] = []

      if (claudeConfig?.enabled && claudeConfig.sessionKey) {
        try {
          const result = await window.electronAPI.claudeFetchUsage(claudeConfig.sessionKey)
          const parsed = parseClaudeUsage(result.usage as AnthropicUsageResponse)
          limits.push(...parsed)
        } catch (error) {
          errors.push(`Claude: ${error instanceof Error ? error.message : String(error)}`)
        }
        if (!isCurrentRequest()) return discardedFetchResult()
      }

      if (opencodeConfig?.enabled && opencodeConfig.sessionKey) {
        try {
          const result = await window.electronAPI.opencodeFetchUsage(opencodeConfig.sessionKey)
          const parsed = parseOpenCodeUsage(result.results)
          limits.push(...parsed)
        } catch (error) {
          errors.push(`OpenCode: ${error instanceof Error ? error.message : String(error)}`)
        }
        if (!isCurrentRequest()) return discardedFetchResult()
      }

      if (codexConfig?.enabled && codexConfig.sessionKey) {
        try {
          const result = await window.electronAPI.codexFetchUsage(codexConfig.sessionKey)
          const parsed = parseCodexUsage(result.results)
          limits.push(...parsed)
        } catch (error) {
          errors.push(`Codex: ${error instanceof Error ? error.message : String(error)}`)
        }
        if (!isCurrentRequest()) return discardedFetchResult()
      }

      if (geminiConfig?.enabled && geminiConfig.sessionKey) {
        try {
          const result = await window.electronAPI.geminiFetchUsage(geminiConfig.sessionKey)
          const parsed = parseGeminiUsage(result.results)
          limits.push(...parsed)
        } catch (error) {
          errors.push(`Gemini: ${error instanceof Error ? error.message : String(error)}`)
        }
        if (!isCurrentRequest()) return discardedFetchResult()
      }

      if (!isCurrentRequest()) return discardedFetchResult()
      const currentSettings = get().settings
      const activeLimits = limits.filter((limit) => isLimitProviderEnabled(currentSettings, limit.provider))

      set({
        usageLimits: activeLimits,
        usageLoading: false,
        usageError: errors.length > 0 ? errors.join(' | ') : null,
      })
      return { ok: errors.length === 0, errors, limitsCount: activeLimits.length }
    },

    importData: (state) => {
      usageGeneration += 1
      set({
        settings: {
          ...state.settings,
          apiConfig: state.settings.apiConfig ?? { claude: null },
        },
        usageLimits: [],
        usageLoading: false,
        usageError: null,
      })
      persist(get)
    },

    exportData: () => ({
      schemaVersion: 1,
      settings: get().settings,
    }),
  }
})
