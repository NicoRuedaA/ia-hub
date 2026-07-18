import type { UsageLimit } from '../../domain/types'
import { calculateUsagePercentage, formatUsagePercentage, getUsageRiskLevel } from '../usagePresentation'

interface UsageLimitsProps {
  limits: UsageLimit[]
  loading: boolean
  error: string | null
}

interface ProviderPresentation {
  label: string
  mark: string
  accent: string
  border: string
  glow: string
}

const providerOrder = ['anthropic', 'opencode', 'codex', 'gemini']

const providerPresentation: Record<string, ProviderPresentation> = {
  anthropic: {
    label: 'Claude',
    mark: 'C',
    accent: 'bg-orange-300/10 text-orange-200 ring-orange-300/20',
    border: 'border-orange-300/10',
    glow: 'from-orange-300/[0.05]',
  },
  opencode: {
    label: 'OpenCode Go',
    mark: 'O',
    accent: 'bg-violet-300/10 text-violet-200 ring-violet-300/20',
    border: 'border-violet-300/10',
    glow: 'from-violet-300/[0.05]',
  },
  codex: {
    label: 'Codex',
    mark: 'X',
    accent: 'bg-emerald-300/10 text-emerald-200 ring-emerald-300/20',
    border: 'border-emerald-300/10',
    glow: 'from-emerald-300/[0.05]',
  },
  gemini: {
    label: 'Gemini',
    mark: 'G',
    accent: 'bg-blue-300/10 text-blue-200 ring-blue-300/20',
    border: 'border-blue-300/10',
    glow: 'from-blue-300/[0.05]',
  },
}

function getUsagePresentation(pct: number) {
  const risk = getUsageRiskLevel(pct)
  if (risk === 'normal') {
    return {
      bar: 'bg-gradient-to-r from-emerald-500 to-emerald-300',
      text: 'text-emerald-300',
      badge: 'bg-emerald-300/[0.08] text-emerald-300 ring-emerald-300/15',
      label: 'In range',
    }
  }
  if (risk === 'watch') {
    return {
      bar: 'bg-gradient-to-r from-amber-500 to-amber-300',
      text: 'text-amber-300',
      badge: 'bg-amber-300/[0.08] text-amber-300 ring-amber-300/15',
      label: 'Keep watch',
    }
  }
  return {
    bar: 'bg-gradient-to-r from-rose-600 to-rose-400',
    text: 'text-rose-300',
    badge: 'bg-rose-300/[0.08] text-rose-300 ring-rose-300/15',
    label: 'High usage',
  }
}

function formatResetTime(resetsAt: string | null): string {
  if (!resetsAt) return 'No reset data'
  const resetDate = new Date(resetsAt)
  const diff = resetDate.getTime() - Date.now()

  if (Number.isNaN(resetDate.getTime())) return 'No reset data'
  if (diff <= 0) return 'Resetting soon'

  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `Resets in ${days}d ${hours % 24}h`
  }
  if (hours < 1) return `Resets in ${Math.max(1, minutes)}m`
  return `Resets in ${hours}h ${minutes}m`
}

function formatValue(limit: UsageLimit): string {
  if (limit.unit === 'currency') return `$${limit.used.toFixed(2)} / $${limit.limit.toFixed(2)}`
  return formatUsagePercentage(calculateUsagePercentage(limit))
}

function formatLimitName(limit: UsageLimit): string {
  const separator = limit.name.indexOf('·')
  return separator >= 0 ? limit.name.slice(separator + 1).trim() : limit.name
}

function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-live="polite" aria-label="Fetching usage data">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/[0.06]" />
            <div className="h-3 w-28 rounded bg-white/[0.06]" />
          </div>
          <div className="mt-7 h-3 w-3/5 rounded bg-white/[0.05]" />
          <div className="mt-4 h-2 w-full rounded-full bg-white/[0.05]" />
        </div>
      ))}
    </div>
  )
}

export default function UsageLimits({ limits, loading, error }: UsageLimitsProps) {
  if (loading && limits.length === 0) return <LoadingState />

  if (error && limits.length === 0) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] p-4 text-rose-200">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0">
          <path d="M12 8v5m0 3v.01M10.3 4.9 3.2 17.2A1.2 1.2 0 0 0 4.24 19h15.52a1.2 1.2 0 0 0 1.04-1.8L13.7 4.9a1.96 1.96 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <div>
          <p className="text-sm font-semibold">Usage data could not be refreshed</p>
          <p className="mt-1 text-xs leading-5 text-rose-200/65">{error}</p>
        </div>
      </div>
    )
  }

  if (limits.length === 0) return null

  const groups = Array.from(
    limits.reduce((map, limit) => {
      const current = map.get(limit.provider) ?? []
      current.push(limit)
      map.set(limit.provider, current)
      return map
    }, new Map<string, UsageLimit[]>()),
  ).sort(([a], [b]) => providerOrder.indexOf(a) - providerOrder.indexOf(b))

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-4 py-3 text-xs leading-5 text-amber-200">
          Some providers could not refresh. Showing the data that is available. <span className="text-amber-200/60">{error}</span>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {groups.map(([provider, providerLimits]) => {
          const presentation = providerPresentation[provider] ?? {
            label: provider,
            mark: provider.slice(0, 1).toUpperCase(),
            accent: 'bg-slate-300/10 text-slate-200 ring-slate-300/20',
            border: 'border-white/[0.07]',
            glow: 'from-white/[0.03]',
          }
          const highestProviderUsage = Math.max(...providerLimits.map(calculateUsagePercentage))
          const providerStatus = getUsagePresentation(highestProviderUsage)

          return (
            <article
              key={provider}
              className={`relative overflow-hidden rounded-2xl border bg-[#0d1017]/90 ${presentation.border}`}
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${presentation.glow} to-transparent`} />
              <div className="relative flex items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <span className={`grid h-9 w-9 place-items-center rounded-xl text-xs font-bold ring-1 ${presentation.accent}`}>
                    {presentation.mark}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">{presentation.label}</h3>
                    <p className="mt-0.5 text-[11px] text-slate-400">{providerLimits.length} {providerLimits.length === 1 ? 'usage window' : 'usage windows'}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${providerStatus.badge}`}>
                  {providerStatus.label}
                </span>
              </div>

              <div className="relative divide-y divide-white/[0.055]">
                {providerLimits.map((limit) => {
                  const pct = calculateUsagePercentage(limit)
                  const usage = getUsagePresentation(pct)
                  return (
                    <div key={limit.id} className="px-4 py-4 sm:px-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-300">{formatLimitName(limit)}</p>
                          <p className="mt-1 text-[11px] tabular-nums text-slate-400">{formatResetTime(limit.resetsAt)}</p>
                        </div>
                        <span className={`text-sm font-semibold tabular-nums ${usage.text}`}>{formatValue(limit)}</span>
                      </div>
                      <div
                        className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"
                        role="progressbar"
                        aria-label={`${presentation.label} ${formatLimitName(limit)} usage`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(pct)}
                      >
                        <div
                          className={`h-full rounded-full transition-[width] duration-500 ${usage.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
