import { useEffect } from 'react'
import { useAppStore } from '../../state/store'
import { useTranslation, type TranslationKey } from '../../i18n'
import UsageLimits from '../components/UsageLimits'
import { calculateUsagePercentage, formatUsagePercentage, getUsageRiskLevel } from '../usagePresentation'

function formatNextReset(resetsAt: string | null | undefined, t: (key: TranslationKey, values?: Record<string, string | number>) => string): string {
  if (!resetsAt) return t('usage.noResetData')
  const date = new Date(resetsAt)
  if (Number.isNaN(date.getTime())) return t('usage.noResetData')

  const diff = date.getTime() - Date.now()
  if (diff <= 0) return t('usage.resettingSoon')

  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return t('usage.resetsInMinutes', { minutes: Math.max(1, Math.floor(diff / 60_000)) })
  if (hours < 24) return t('usage.resetsInHours', { hours, minutes: 0 })
  const days = Math.floor(hours / 24)
  return t('usage.resetsInDays', { days, hours: hours % 24 })
}

function PageIcon() {
  return (
    <span className="page-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" width="19" height="19">
        <path d="M5 5.5h14v13H5v-13Zm3 3h8M8 12h8M8 15.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function EmptyState({ connected, onConnect, onRefresh, onManage }: {
  connected: boolean
  onConnect: () => void
  onRefresh: () => void
  onManage: () => void
}) {
  const { t } = useTranslation()

  return (
    <section className="empty-state" aria-labelledby="empty-state-title">
      <div className="empty-state-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
          <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h2 id="empty-state-title" className="empty-state-title">
        {connected ? t('dashboard.noUsageTitle') : t('dashboard.connectTitle')}
      </h2>
      <p className="empty-state-copy">
        {connected
          ? t('dashboard.noUsageCopy')
          : t('dashboard.connectCopy')}
      </p>
      <div className="empty-state-actions">
        {connected ? (
          <>
            <button type="button" onClick={onRefresh} className="button-primary">{t('dashboard.refreshUsage')}</button>
            <button type="button" onClick={onManage} className="button-secondary">{t('dashboard.manageConnections')}</button>
          </>
        ) : (
          <button type="button" onClick={onConnect} className="button-primary">{t('dashboard.setUpConnections')}</button>
        )}
      </div>
    </section>
  )
}

export default function DashboardPage() {
  const settings = useAppStore((s) => s.settings)
  const usageLimits = useAppStore((s) => s.usageLimits)
  const usageLoading = useAppStore((s) => s.usageLoading)
  const usageError = useAppStore((s) => s.usageError)
  const fetchUsage = useAppStore((s) => s.fetchUsage)
  const setPage = useAppStore((s) => s.setPage)
  const { t } = useTranslation()

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
  const highestUsage = usageLimits.reduce((highest, limit) => Math.max(highest, calculateUsagePercentage(limit)), 0)
  const nextReset = usageLimits
    .map((limit) => limit.resetsAt)
    .filter((value): value is string => !!value)
    .map((value) => ({ value, timestamp: new Date(value).getTime() }))
    .filter(({ timestamp }) => Number.isFinite(timestamp) && timestamp > Date.now())
    .sort((a, b) => a.timestamp - b.timestamp)[0]?.value

  const riskLevel = getUsageRiskLevel(highestUsage)
  const riskLabel = riskLevel === 'high' ? t('usage.highUsage') : riskLevel === 'watch' ? t('usage.keepWatch') : t('usage.inRange')
  const riskTone = riskLevel === 'high' ? 'text-danger' : riskLevel === 'watch' ? 'text-warning' : 'text-positive'

  return (
    <div className="page-stack">
      <header className="document-header">
        <div>
          <div className="breadcrumb"><span>{t('app.workspace')}</span><span aria-hidden="true">/</span><strong>{t('dashboard.breadcrumb')}</strong></div>
          <div style={{ marginTop: 18 }}><PageIcon /></div>
          <h1 className="page-title">{t('dashboard.title')}</h1>
          <p className="page-description">{t('dashboard.description')}</p>
        </div>
        <div className="page-header-aside">
          <p className="page-header-aside-label">{t('dashboard.lastChecked')}</p>
          <p className="page-header-aside-value">{t('dashboard.localProviderData')}</p>
          <p className="page-header-aside-copy">{t('dashboard.refreshWhenNeeded')}</p>
        </div>
      </header>

       <section className="document-section" aria-label={t('dashboard.usageSummary')}>
        <div className="section-heading">
          <div>
            <h2 className="section-title">{t('dashboard.atAGlance')}</h2>
            <p className="section-copy">{t('dashboard.quickRead')}</p>
          </div>
          <button type="button" onClick={() => fetchUsage()} disabled={usageLoading || connectedCount === 0} className="button-secondary">
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14" className={usageLoading ? 'is-loading' : undefined} aria-hidden="true">
              <path d="M20 6v5h-5M4 18v-5h5M18.1 9A7 7 0 0 0 6.7 6.7L4 11m16 2-2.7 4.3A7 7 0 0 1 5.9 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
             {usageLoading ? t('dashboard.refreshing') : t('dashboard.refreshUsage')}
          </button>
        </div>
        <div className="usage-summary">
          <div className="summary-block">
             <p className="summary-label">{t('dashboard.connected')}</p>
            <p className="summary-value">{connectedCount}<span style={{ color: 'var(--ink-muted)', fontSize: 14 }}> / 4</span></p>
             <p className="summary-note">{t('dashboard.activeProviders')}</p>
          </div>
          <div className="summary-block">
             <p className="summary-label">{t('dashboard.highestUsage')}</p>
            <p className="summary-value">{usageLimits.length > 0 ? formatUsagePercentage(highestUsage) : '—'}</p>
             <p className={`summary-note ${usageLimits.length > 0 ? riskTone : ''}`}>{usageLimits.length > 0 ? riskLabel : t('dashboard.awaitingData')}</p>
          </div>
          <div className="summary-block">
             <p className="summary-label">{t('dashboard.nextReset')}</p>
             <p className="summary-value">{formatNextReset(nextReset, t)}</p>
             <p className="summary-note">{t('dashboard.earliestWindow')}</p>
          </div>
        </div>
      </section>

      {hasUsageToShow ? (
        <section aria-labelledby="limits-heading" className="document-section">
          <div className="section-heading">
            <div>
               <h2 id="limits-heading" className="section-title">{t('dashboard.providerUsage')}</h2>
               <p className="section-copy">{t('dashboard.usageGrouped')}</p>
            </div>
             {usageLimits.length > 0 && <span className="section-count">{usageLimits.length === 1 ? t('dashboard.activeLimit', { count: usageLimits.length }) : t('dashboard.activeLimits', { count: usageLimits.length })}</span>}
          </div>
          <UsageLimits limits={usageLimits} loading={usageLoading} error={usageError} />
        </section>
      ) : (
        <section className="document-section">
          <EmptyState connected={connectedCount > 0} onConnect={() => setPage('settings')} onRefresh={() => fetchUsage()} onManage={() => setPage('settings')} />
        </section>
      )}
    </div>
  )
}
