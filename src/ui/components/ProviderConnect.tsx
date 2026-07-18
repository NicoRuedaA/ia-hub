import { useState } from 'react'

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

function getProviderPresentation(title: string) {
  if (title === 'Claude.ai') return { mark: 'C', color: 'bg-orange-300/10 text-orange-200 ring-orange-300/20' }
  if (title === 'OpenCode Go') return { mark: 'O', color: 'bg-violet-300/10 text-violet-200 ring-violet-300/20' }
  if (title === 'Codex') return { mark: 'X', color: 'bg-emerald-300/10 text-emerald-200 ring-emerald-300/20' }
  return { mark: 'G', color: 'bg-blue-300/10 text-blue-200 ring-blue-300/20' }
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showDisconnect, setShowDisconnect] = useState(false)
  const provider = getProviderPresentation(title)
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
    <article className="flex h-full flex-col rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-colors hover:border-white/[0.11]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold ring-1 ${provider.color}`} aria-hidden="true">
            {provider.mark}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-100">{title}</h3>
            <p className="mt-1 text-[11px] font-medium text-slate-400">Browser session</p>
          </div>
        </div>
        <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${
          connected && enabled
            ? 'bg-emerald-300/[0.08] text-emerald-300 ring-emerald-300/15'
            : 'bg-white/[0.035] text-slate-400 ring-white/[0.08]'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected && enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          {connected && enabled ? 'Active' : 'Not connected'}
        </span>
      </div>

      <p className="mt-4 min-h-10 text-xs leading-5 text-slate-400">{description}</p>

      <div className="mt-auto pt-5">
        {connected ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-white/[0.075] px-3.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.11] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}>
                  <path d="M20 6v5h-5M4 18v-5h5M18 9a7 7 0 0 0-11.3-2.3L4 11m16 2-2.7 4.3A7 7 0 0 1 6 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={() => setShowDisconnect(true)}
                disabled={loading}
                className="h-9 rounded-xl px-3 text-xs font-medium text-slate-400 transition-colors hover:bg-rose-300/[0.06] hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Disconnect
              </button>
            </div>
            <p className="text-[10px] leading-4 text-slate-400">Session cookies expire. Reconnect if updates stop.</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading || !electronAvailable}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3.5 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-400"
          >
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                Waiting for login…
              </>
            ) : (
              `Connect ${title}`
            )}
          </button>
        )}

        {showDisconnect && (
          <div className="mt-3 rounded-xl border border-rose-300/15 bg-rose-300/[0.045] p-3 text-xs">
            <p className="font-medium text-slate-300">Disconnect this account?</p>
            <div className="mt-2 flex items-center gap-3">
              <button type="button" onClick={handleDisconnect} className="font-semibold text-rose-300 hover:text-rose-200">Yes, disconnect</button>
              <button type="button" onClick={() => setShowDisconnect(false)} className="text-slate-400 hover:text-slate-300">Cancel</button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-rose-300/10 bg-rose-300/[0.05] px-3 py-2 text-xs leading-5 text-rose-300">{error}</p>
        )}
        {success && (
          <p role="status" className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
            <span aria-hidden="true">✓</span> Usage refreshed successfully.
          </p>
        )}
      </div>
    </article>
  )
}
