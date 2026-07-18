import { useEffect } from 'react'
import { useAppStore } from '../../state/store'
import UsageLimits from '../components/UsageLimits'
import { calculateUsagePercentage, formatUsagePercentage, getUsageRiskLevel } from '../usagePresentation'

function formatNextReset(resetsAt: string | null | undefined): string {
  if (!resetsAt) return 'Not available'
  const date = new Date(resetsAt)
  if (Number.isNaN(date.getTime())) return 'Not available'

  const diff = date.getTime() - Date.now()
  if (diff <= 0) return 'Resetting soon'

  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return `${Math.max(1, Math.floor(diff / 60_000))} min`
  if (hours < 24) return `${hours} hr`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

export default function DashboardPage() {
  const settings = useAppStore((s) => s.settings)
  const usageLimits = useAppStore((s) => s.usageLimits)
  const usageLoading = useAppStore((s) => s.usageLoading)
  const usageError = useAppStore((s) => s.usageError)
  const fetchUsage = useAppStore((s) => s.fetchUsage)
  const setPage = useAppStore((s) => s.setPage)

  const configs = [
    settings.apiConfig?.claude,
    settings.apiConfig?.opencode,
    settings.apiConfig?.codex,
    settings.apiConfig?.gemini,
  ]
  const connectedCount = configs.filter((config) => config?.enabled && config.sessionKey).length

  useEffect(() => {
    if (connectedCount > 0) fetchUsage()
  }, [connectedCount, fetchUsage])

  const hasUsageToShow = usageLimits.length > 0 || usageLoading || usageError
  const highestUsage = usageLimits.reduce((highest, limit) => {
    return Math.max(highest, calculateUsagePercentage(limit))
  }, 0)
  const nextReset = usageLimits
    .map((limit) => limit.resetsAt)
    .filter((value): value is string => !!value)
    .map((value) => ({ value, timestamp: new Date(value).getTime() }))
    .filter(({ timestamp }) => Number.isFinite(timestamp) && timestamp > Date.now())
    .sort((a, b) => a.timestamp - b.timestamp)[0]?.value

  const riskLevel = getUsageRiskLevel(highestUsage)
  const riskLabel = riskLevel === 'high' ? 'High usage' : riskLevel === 'watch' ? 'Keep watch' : 'In range'
  const riskTone = riskLevel === 'high' ? 'text-rose-300' : riskLevel === 'watch' ? 'text-amber-300' : 'text-emerald-300'

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
            <span className="h-px w-6 bg-cyan-300/60" />
            Usage overview
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Your AI capacity, at a glance.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-[15px]">
            Monitor every active usage window before it becomes a blocker.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchUsage()}
          disabled={usageLoading || connectedCount === 0}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] px-4 text-xs font-semibold text-cyan-100 transition-colors hover:border-cyan-300/35 hover:bg-cyan-300/[0.13] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`h-4 w-4 ${usageLoading ? 'animate-spin' : ''}`}>
            <path d="M20 6v5h-5M4 18v-5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18.1 9A7 7 0 0 0 6.7 6.7L4 11m16 2-2.7 4.3A7 7 0 0 1 5.9 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {usageLoading ? 'Refreshing…' : 'Refresh usage'}
        </button>
      </div>

      <section aria-label="Usage summary" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Connected</p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <p className="text-2xl font-semibold tracking-[-0.03em] text-white">{connectedCount}<span className="ml-1 text-sm font-medium text-slate-400">/ 4</span></p>
            <span className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
              <span className={`h-1.5 w-1.5 rounded-full ${connectedCount > 0 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.65)]' : 'bg-slate-600'}`} />
              providers
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Highest usage</p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <p className="text-2xl font-semibold tracking-[-0.03em] text-white">{usageLimits.length > 0 ? formatUsagePercentage(highestUsage) : '—'}</p>
            <span className={`mb-1 text-xs font-medium ${usageLimits.length > 0 ? riskTone : 'text-slate-400'}`}>
              {usageLimits.length > 0 ? riskLabel : 'Awaiting data'}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Next reset</p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <p className="text-2xl font-semibold tracking-[-0.03em] text-white">{formatNextReset(nextReset)}</p>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mb-1 h-4 w-4 text-slate-400">
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
              <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </section>

      {hasUsageToShow ? (
        <section aria-labelledby="limits-heading" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="limits-heading" className="text-base font-semibold text-slate-100">Usage windows</h2>
              <p className="mt-1 text-xs text-slate-400">Consumption is grouped by provider and reset period.</p>
            </div>
            {usageLimits.length > 0 && (
              <span className="hidden text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 sm:block">
                {usageLimits.length} active {usageLimits.length === 1 ? 'limit' : 'limits'}
              </span>
            )}
          </div>
          <UsageLimits limits={usageLimits} loading={usageLoading} error={usageError} />
        </section>
      ) : connectedCount === 0 ? (
        <section className="relative overflow-hidden rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.02] px-6 py-12 text-center sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(34,211,238,0.07),transparent_45%)]" />
          <div className="relative mx-auto max-w-md">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
                <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="mt-5 text-lg font-semibold text-white">Connect your first provider</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Link an account to bring Claude, OpenCode Go, Codex, and Gemini usage windows into one calm view.</p>
            <button
              type="button"
              onClick={() => setPage('settings')}
              className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-cyan-300 px-4 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-200"
            >
              Set up connections
            </button>
          </div>
        </section>
      ) : (
        <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025] px-6 py-12 text-center sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(139,92,246,0.07),transparent_45%)]" />
          <div className="relative mx-auto max-w-md">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-violet-300/20 bg-violet-300/[0.08] text-violet-200">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
                <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.5 3" />
              </svg>
            </div>
            <h2 className="mt-5 text-lg font-semibold text-white">No usage windows available</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Your providers are connected, but they returned no usage data. Refresh now or reconnect the affected account.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => fetchUsage()}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-cyan-300 px-4 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-200"
              >
                Refresh usage
              </button>
              <button
                type="button"
                onClick={() => setPage('settings')}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.08]"
              >
                Manage connections
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
