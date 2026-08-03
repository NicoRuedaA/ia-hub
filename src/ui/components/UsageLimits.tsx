import type { UsageLimit } from '../../domain/types'
import type { TranslationKey } from '../../i18n'
import { useTranslation } from '../../i18n'
import { calculateUsagePercentage, formatUsagePercentage, getUsageRiskLevel } from '../usagePresentation'

interface UsageLimitsProps {
  limits: UsageLimit[]
  loading: boolean
  error: string | null
}

interface ProviderPresentation {
  label: string
  mark: string
}

const providerOrder = ['anthropic', 'opencode', 'codex', 'gemini']

const providerPresentation: Record<string, ProviderPresentation> = {
  anthropic: { label: 'Claude', mark: 'C' },
  opencode: { label: 'OpenCode Go', mark: 'O' },
  codex: { label: 'Codex', mark: 'X' },
  gemini: { label: 'Gemini', mark: 'G' },
}

function getUsagePresentation(pct: number, t: (key: TranslationKey) => string) {
  const risk = getUsageRiskLevel(pct)
  if (risk === 'normal') return { bar: 'progress-positive', text: 'text-positive', label: t('usage.inRange') }
  if (risk === 'watch') return { bar: 'progress-warning', text: 'text-warning', label: t('usage.keepWatch') }
  return { bar: 'progress-danger', text: 'text-danger', label: t('usage.highUsage') }
}

function formatResetTime(resetsAt: string | null, t: (key: TranslationKey, values?: Record<string, string | number>) => string): string {
  if (!resetsAt) return t('usage.noResetData')
  const resetDate = new Date(resetsAt)
  const diff = resetDate.getTime() - Date.now()

  if (Number.isNaN(resetDate.getTime())) return t('usage.noResetData')
  if (diff <= 0) return t('usage.resettingSoon')

  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return t('usage.resetsInDays', { days, hours: hours % 24 })
  }
  if (hours < 1) return t('usage.resetsInMinutes', { minutes: Math.max(1, minutes) })
  return t('usage.resetsInHours', { hours, minutes })
}

function formatValue(limit: UsageLimit): string {
  if (limit.unit === 'currency') return `$${limit.used.toFixed(2)} / $${limit.limit.toFixed(2)}`
  return formatUsagePercentage(calculateUsagePercentage(limit))
}

const usageLabelTranslations: Record<NonNullable<UsageLimit['usageLabelKey']>, TranslationKey> = {
  session: 'usage.label.session',
  weeklyAllModels: 'usage.label.weeklyAllModels',
  weeklyOpus: 'usage.label.weeklyOpus',
  model: 'usage.label.model',
  rolling: 'usage.label.rolling',
  weekly: 'usage.label.weekly',
  monthly: 'usage.label.monthly',
  weeklyUsage: 'usage.label.weeklyUsage',
}

function formatLimitName(limit: UsageLimit, t: (key: TranslationKey, values?: Record<string, string | number>) => string): string {
  if (limit.usageLabelKey) {
    let values: Record<string, string | number> | undefined
    if (limit.usageLabelParams?.turns !== undefined) values = { turns: t('usage.turnsSuffix', { turns: limit.usageLabelParams.turns }) }
    else if (limit.usageLabelParams?.model !== undefined) values = { model: limit.usageLabelParams.model }
    return t(usageLabelTranslations[limit.usageLabelKey], values)
  }
  const separator = limit.name.indexOf('·')
  return separator >= 0 ? limit.name.slice(separator + 1).trim() : limit.name
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-lines" aria-live="polite" aria-label={label}>
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="loading-line" aria-hidden="true">
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}

export default function UsageLimits({ limits, loading, error }: UsageLimitsProps) {
  const { t } = useTranslation()

  if (loading && limits.length === 0) return <LoadingState label={t('usage.fetching')} />

  if (error && limits.length === 0) {
    return (
      <div role="alert" className="notice notice-error">
        <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
          <path d="M12 8v5m0 3v.01M10.3 4.9 3.2 17.2A1.2 1.2 0 0 0 4.24 19h15.52a1.2 1.2 0 0 0 1.04-1.8L13.7 4.9a1.96 1.96 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <span><strong>{t('usage.refreshError')}</strong> {error}</span>
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
    <div>
      {error && <div role="alert" className="notice notice-warning" style={{ marginBottom: 14 }}>{t('usage.partialRefreshError')} {error}</div>}
      <div className="usage-list">
        {groups.map(([provider, providerLimits]) => {
          const presentation = providerPresentation[provider] ?? { label: provider, mark: provider.slice(0, 1).toUpperCase() }
          const highestProviderUsage = Math.max(...providerLimits.map(calculateUsagePercentage))
          const providerStatus = getUsagePresentation(highestProviderUsage, t)

          return (
            <article key={provider} className="usage-provider">
              <div className="usage-provider-header">
                <div className="provider-identity">
                  <span className="provider-mark" aria-hidden="true">{presentation.mark}</span>
                  <div>
                    <h3 className="provider-name">{presentation.label}</h3>
                    <p className="provider-meta">{providerLimits.length} {t(providerLimits.length === 1 ? 'usage.window' : 'usage.windows')}</p>
                  </div>
                </div>
                <span className={`status-pill ${providerStatus.text === 'text-positive' ? 'is-positive' : providerStatus.text === 'text-warning' ? 'is-warning' : 'is-danger'}`}>
                  <span className={`status-dot ${providerStatus.text === 'text-positive' ? 'status-dot-positive' : providerStatus.text === 'text-warning' ? 'status-dot-warning' : ''}`} aria-hidden="true" />
                  {providerStatus.label}
                </span>
              </div>

              {providerLimits.map((limit) => {
                const pct = calculateUsagePercentage(limit)
                const usage = getUsagePresentation(pct, t)
                const limitLabel = formatLimitName(limit, t)
                return (
                  <div key={limit.id} className="usage-row">
                    <div>
                      <p className="usage-row-name">{limitLabel}</p>
                      <p className="usage-row-reset">{formatResetTime(limit.resetsAt, t)}</p>
                    </div>
                    <div className="progress-track" role="progressbar" aria-label={t('usage.usageAria', { provider: presentation.label, limit: limitLabel })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                      <div className={usage.bar} style={{ width: `${pct}%` }} />
                    </div>
                    <p className={`usage-row-value ${usage.text}`}>{formatValue(limit)} <span className="sr-only">({usage.label})</span></p>
                  </div>
                )
              })}
            </article>
          )
        })}
      </div>
    </div>
  )
}
