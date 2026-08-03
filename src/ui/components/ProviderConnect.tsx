import { useState } from 'react'
import { useTranslation } from '../../i18n'

interface ProviderConnectProps {
  title: string
  description: string
  connected: boolean
  enabled: boolean
  onConnect: (
    setLoading: (v: boolean) => void,
    setError: (v: string | null) => void,
    setSuccess: (v: boolean) => void,
  ) => Promise<void>
  onDisconnect: (
    setLoading: (v: boolean) => void,
    setError: (v: string | null) => void,
    setSuccess: (v: boolean) => void,
  ) => Promise<void>
  onRefresh: (
    setLoading: (v: boolean) => void,
    setError: (v: string | null) => void,
    setSuccess: (v: boolean) => void,
  ) => Promise<void>
}

function getProviderMark(title: string) {
  if (title === 'Claude.ai') return 'C'
  if (title === 'OpenCode Go') return 'O'
  if (title === 'Codex') return 'X'
  return 'G'
}

export default function ProviderConnect({
  title,
  description,
  connected,
  enabled,
  onConnect,
  onDisconnect,
  onRefresh,
}: ProviderConnectProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showDisconnect, setShowDisconnect] = useState(false)
  const providerMark = getProviderMark(title)
  const electronAvailable = typeof window !== 'undefined' && !!window.electronAPI

  async function handleConnect() {
    setSuccess(false)
    setError(null)
    await onConnect(setLoading, setError, setSuccess)
  }

  async function handleDisconnect() {
    setShowDisconnect(false)
    setError(null)
    setSuccess(false)
    await onDisconnect(setLoading, setError, setSuccess)
  }

  async function handleRefresh() {
    setSuccess(false)
    setError(null)
    await onRefresh(setLoading, setError, setSuccess)
  }

  return (
    <article aria-busy={loading} className="provider-row">
      <div className="provider-row-header">
        <div className="provider-identity">
          <span className="provider-mark" aria-hidden="true">{providerMark}</span>
          <div>
            <h3 className="provider-name">{title}</h3>
            <p className="provider-meta">{t('provider.browserSession')}</p>
          </div>
        </div>
        <span className={`status-pill ${connected && enabled ? 'is-positive' : ''}`}>
          <span className={`status-dot ${connected && enabled ? 'status-dot-positive' : ''}`} aria-hidden="true" />
          {connected && enabled ? t('provider.active') : t('provider.notConnected')}
        </span>
      </div>

      <p className="provider-row-description">{description}</p>

      <div className="provider-row-actions">
        {connected ? (
          <>
            <button type="button" onClick={handleRefresh} disabled={loading} className="button-secondary">
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14" className={loading ? 'is-loading' : undefined} aria-hidden="true">
                <path d="M20 6v5h-5M4 18v-5h5M18 9a7 7 0 0 0-11.3-2.3L4 11m16 2-2.7 4.3A7 7 0 0 1 6 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {loading ? t('provider.refreshing') : t('provider.refresh')}
            </button>
            <button type="button" onClick={() => setShowDisconnect(true)} disabled={loading} className="button-quiet">{t('provider.disconnect')}</button>
          </>
        ) : (
          <button type="button" onClick={handleConnect} disabled={loading || !electronAvailable} className="button-primary">
             {loading ? <><span className="is-loading" aria-hidden="true">◌</span> {t('provider.waitingLogin')}</> : t('provider.connect', { provider: title })}
          </button>
        )}
      </div>

      {connected && <p className="provider-row-note">{t('provider.sessionExpires')}</p>}
      {!connected && !electronAvailable && !loading && <p className="provider-row-note">{t('provider.desktopRequired')}</p>}

      {showDisconnect && (
        <div className="inline-confirm">
            <strong>{t('provider.disconnectQuestion')}</strong>
            <div className="inline-confirm-actions">
             <button type="button" onClick={handleDisconnect}>{t('provider.yesDisconnect')}</button>
             <button type="button" onClick={() => setShowDisconnect(false)}>{t('confirm.cancel')}</button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="notice notice-error" style={{ marginTop: 14 }}>{error}</p>}
      {success && <p role="status" className="provider-row-note text-positive">{t('provider.usageRefreshed')}</p>}
    </article>
  )
}
