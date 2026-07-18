export interface Settings {
  apiConfig?: APIConfig
}

// ── API Usage Tracking ─────────────────────────────────────────

export type Provider = 'anthropic' | 'opencode' | 'codex' | 'gemini'

export interface APIConfig {
  claude?: ClaudeAPIConfig | null
  opencode?: OpenCodeAPIConfig | null
  codex?: CodexAPIConfig | null
  gemini?: GeminiAPIConfig | null
}

export interface ClaudeAPIConfig {
  sessionKey: string
  enabled: boolean
}

export interface OpenCodeAPIConfig {
  sessionKey: string
  enabled: boolean
}

export interface CodexAPIConfig {
  sessionKey: string
  enabled: boolean
}

export interface GeminiAPIConfig {
  sessionKey: string
  enabled: boolean
}

export interface UsageLimit {
  id: string
  name: string
  provider: Provider
  used: number
  limit: number
  unit: 'percent' | 'currency'
  resetsAt: string | null
}

export interface AnthropicUsageResponse {
  five_hour?: { utilization?: number; resets_at?: string }
  seven_day?: { utilization?: number; resets_at?: string }
  seven_day_opus?: { utilization?: number; resets_at?: string }
  limits?: Array<{
    kind?: string
    percent?: number
    resets_at?: string
    scope?: { model?: { id?: string; display_name?: string } }
  }>
}

// OpenCode Go usage response — unknown structure, modeled loosely.
// Real shape will be logged in the store so we can refine this later.
export interface OpenCodeUsageResponse {
  [key: string]: unknown
}
