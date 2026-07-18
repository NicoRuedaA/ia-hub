import { useState, useRef } from 'react'
import { useAppStore } from '../../state/store'
import { defaultState } from '../../infrastructure/schema'
import { validateState } from '../../infrastructure/schema'
import ConfirmDialog from '../components/ConfirmDialog'
import ProviderConnect from '../components/ProviderConnect'

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings)
  const updateClaudeConfig = useAppStore((s) => s.updateClaudeConfig)
  const updateOpenCodeConfig = useAppStore((s) => s.updateOpenCodeConfig)
  const updateCodexConfig = useAppStore((s) => s.updateCodexConfig)
  const updateGeminiConfig = useAppStore((s) => s.updateGeminiConfig)
  const fetchUsage = useAppStore((s) => s.fetchUsage)
  const importData = useAppStore((s) => s.importData)
  const exportData = useAppStore((s) => s.exportData)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [importError, setImportError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const claudeConfig = settings.apiConfig?.claude
  const opencodeConfig = settings.apiConfig?.opencode
  const codexConfig = settings.apiConfig?.codex
  const geminiConfig = settings.apiConfig?.gemini

  function handleExport() {
    const data = exportData()
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `ia-hub-export-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        const validated = validateState(parsed)
        if (!validated) {
          setImportError('Invalid file format.')
          return
        }
        importData(validated)
      } catch {
        setImportError('Could not parse file.')
      }
    }
    reader.readAsText(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleDeleteAll() {
    importData(defaultState())
    setShowDeleteConfirm(false)
  }

  async function fetchUsageOrThrow() {
    const result = await fetchUsage()
    if (!result.ok) throw new Error(result.errors.join(' | ') || 'Failed to fetch usage')
  }

  const hasElectron = typeof window !== 'undefined' && window.electronAPI

  const connectedCount = [claudeConfig, opencodeConfig, codexConfig, geminiConfig]
    .filter((config) => config?.enabled && config.sessionKey).length

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
            <span className="h-px w-6 bg-cyan-300/60" />
            Connections
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Bring your providers together.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-[15px]">
            Connect browser sessions locally. Connection data stays on this device.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
          <span className={`h-2 w-2 rounded-full ${hasElectron ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]' : 'bg-amber-400'}`} />
          <div>
            <p className="text-xs font-semibold text-slate-300">{connectedCount} of 4 active</p>
            <p className="mt-0.5 text-[10px] text-slate-400">{hasElectron ? 'Desktop bridge ready' : 'Desktop bridge unavailable'}</p>
          </div>
        </div>
      </div>

      {!hasElectron && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4 text-amber-200">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0">
            <path d="M12 8v5m0 3v.01M10.3 4.9 3.2 17.2A1.2 1.2 0 0 0 4.24 19h15.52a1.2 1.2 0 0 0 1.04-1.8L13.7 4.9a1.96 1.96 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <div>
            <p className="text-xs font-semibold">Provider connections require the desktop app</p>
            <p className="mt-1 text-[11px] text-amber-200/60">Run with <code className="rounded bg-amber-300/[0.08] px-1.5 py-0.5">npm run dev:electron</code> to enable account login.</p>
          </div>
        </div>
      )}

      <section aria-labelledby="providers-heading" className="space-y-4">
        <div>
          <h2 id="providers-heading" className="text-base font-semibold text-slate-100">AI providers</h2>
          <p className="mt-1 text-xs text-slate-400">Each account opens in your browser and stores only its local session.</p>
        </div>
        <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <ProviderConnect
          title="Claude.ai"
          description="Track session, weekly, and model-specific usage windows from your Claude account."
          connected={!!claudeConfig?.sessionKey}
          enabled={!!claudeConfig?.enabled}
          onConnect={async (setLoading, setError, setSuccess) => {
            setLoading(true)
            setError(null)
            setSuccess(false)
            try {
              if (!window.electronAPI) throw new Error('Electron API not available')
              const result = await window.electronAPI.claudeLogin()
              if (!result?.sessionKey) throw new Error('Login cancelled or failed')
              updateClaudeConfig({ sessionKey: result.sessionKey, enabled: true })
              await new Promise((r) => setTimeout(r, 100))
              await fetchUsageOrThrow()
              setSuccess(true)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Login failed')
            } finally {
              setLoading(false)
            }
          }}
          onDisconnect={async (_setLoading, _setError, _setSuccess) => {
            try {
              if (window.electronAPI) await window.electronAPI.claudeLogout()
            } catch (err) {
              console.error('Logout error:', err)
            }
            updateClaudeConfig(null)
          }}
          onRefresh={async (setLoading, setError, setSuccess) => {
            setLoading(true)
            setError(null)
            try {
              await fetchUsageOrThrow()
              setSuccess(true)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed to fetch usage')
            } finally {
              setLoading(false)
            }
          }}
        />

        <ProviderConnect
          title="OpenCode Go"
          description="Track rolling, weekly, and monthly usage windows from your OpenCode Go plan."
          connected={!!opencodeConfig?.sessionKey}
          enabled={!!opencodeConfig?.enabled}
          onConnect={async (setLoading, setError, setSuccess) => {
            setLoading(true)
            setError(null)
            setSuccess(false)
            try {
              if (!window.electronAPI) throw new Error('Electron API not available')
              const result = await window.electronAPI.opencodeLogin()
              if (!result?.sessionKey) throw new Error('Login cancelled or failed')
              updateOpenCodeConfig({ sessionKey: result.sessionKey, enabled: true })
              await new Promise((r) => setTimeout(r, 100))
              await fetchUsageOrThrow()
              setSuccess(true)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Login failed')
            } finally {
              setLoading(false)
            }
          }}
          onDisconnect={async (_setLoading, _setError, _setSuccess) => {
            try {
              if (window.electronAPI) await window.electronAPI.opencodeLogout()
            } catch (err) {
              console.error('Logout error:', err)
            }
            updateOpenCodeConfig(null)
          }}
          onRefresh={async (setLoading, setError, setSuccess) => {
            // For OpenCode, "refresh" = re-open the auth window and re-scrape
            // (same as connect, since cookies persist the user won't need to log in again)
            setLoading(true)
            setError(null)
            setSuccess(false)
            try {
              if (!window.electronAPI) throw new Error('Electron API not available')
              const result = await window.electronAPI.opencodeLogin()
              if (!result?.sessionKey) throw new Error('Could not refresh — try disconnecting and reconnecting')
              updateOpenCodeConfig({ sessionKey: result.sessionKey, enabled: true })
              await new Promise((r) => setTimeout(r, 100))
              await fetchUsageOrThrow()
              setSuccess(true)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed to refresh')
            } finally {
              setLoading(false)
            }
          }}
        />

        <ProviderConnect
          title="Codex"
          description="Track Codex agentic usage, turns, and weekly reset timing from ChatGPT."
          connected={!!codexConfig?.sessionKey}
          enabled={!!codexConfig?.enabled}
          onConnect={async (setLoading, setError, setSuccess) => {
            setLoading(true)
            setError(null)
            setSuccess(false)
            try {
              if (!window.electronAPI) throw new Error('Electron API not available')
              const result = await window.electronAPI.codexLogin()
              if (!result?.sessionKey) throw new Error('Login cancelled or failed')
              updateCodexConfig({ sessionKey: result.sessionKey, enabled: true })
              await new Promise((r) => setTimeout(r, 100))
              await fetchUsageOrThrow()
              setSuccess(true)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Login failed')
            } finally {
              setLoading(false)
            }
          }}
          onDisconnect={async (_setLoading, _setError, _setSuccess) => {
            try {
              if (window.electronAPI) await window.electronAPI.codexLogout()
            } catch (err) {
              console.error('Logout error:', err)
            }
            updateCodexConfig(null)
          }}
          onRefresh={async (setLoading, setError, setSuccess) => {
            // For Codex, "refresh" = re-open the auth window and re-scrape
            // (same as connect, since cookies persist the user won't need to log in again)
            setLoading(true)
            setError(null)
            setSuccess(false)
            try {
              if (!window.electronAPI) throw new Error('Electron API not available')
              const result = await window.electronAPI.codexLogin()
              if (!result?.sessionKey) throw new Error('Could not refresh — try disconnecting and reconnecting')
              updateCodexConfig({ sessionKey: result.sessionKey, enabled: true })
              await new Promise((r) => setTimeout(r, 100))
              await fetchUsageOrThrow()
              setSuccess(true)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed to refresh')
            } finally {
              setLoading(false)
            }
          }}
        />

        <ProviderConnect
          title="Gemini"
          description="Track current-session and weekly Gemini usage windows with their reset times."
          connected={!!geminiConfig?.sessionKey}
          enabled={!!geminiConfig?.enabled}
          onConnect={async (setLoading, setError, setSuccess) => {
            setLoading(true)
            setError(null)
            setSuccess(false)
            try {
              if (!window.electronAPI) throw new Error('Electron API not available')
              const result = await window.electronAPI.geminiLogin()
              if (!result?.sessionKey) throw new Error('Login cancelled or failed')
              updateGeminiConfig({ sessionKey: result.sessionKey, enabled: true })
              await new Promise((r) => setTimeout(r, 100))
              await fetchUsageOrThrow()
              setSuccess(true)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Login failed')
            } finally {
              setLoading(false)
            }
          }}
          onDisconnect={async (_setLoading, _setError, _setSuccess) => {
            try {
              if (window.electronAPI) await window.electronAPI.geminiLogout()
            } catch (err) {
              console.error('Logout error:', err)
            }
            updateGeminiConfig(null)
          }}
          onRefresh={async (setLoading, setError, setSuccess) => {
            // For Gemini, "refresh" = re-open the auth window and re-scrape
            // (same as connect, since cookies persist the user won't need to log in again)
            setLoading(true)
            setError(null)
            setSuccess(false)
            try {
              if (!window.electronAPI) throw new Error('Electron API not available')
              const result = await window.electronAPI.geminiLogin()
              if (!result?.sessionKey) throw new Error('Could not refresh — try disconnecting and reconnecting')
              updateGeminiConfig({ sessionKey: result.sessionKey, enabled: true })
              await new Promise((r) => setTimeout(r, 100))
              await fetchUsageOrThrow()
              setSuccess(true)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed to refresh')
            } finally {
              setLoading(false)
            }
          }}
        />
        </div>
      </section>

      <section aria-labelledby="data-heading" className="space-y-4">
        <div>
          <h2 id="data-heading" className="text-base font-semibold text-slate-100">Local data</h2>
          <p className="mt-1 text-xs text-slate-400">Move your connection settings or reset this installation.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
          <div className="flex flex-col gap-4 border-b border-white/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Backup and restore</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">Export a JSON backup or restore data from another installation.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.045] px-3.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.08]"
              >
                Export data
              </button>
              <label className="flex h-9 cursor-pointer items-center rounded-xl border border-white/[0.08] bg-white/[0.045] px-3.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.08] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cyan-300">
                Import data
                <input ref={fileRef} type="file" accept=".json" onChange={handleImportFile} className="sr-only" />
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Delete local data</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">Remove all connections and settings from this device. This cannot be undone.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="h-9 shrink-0 self-start rounded-xl border border-rose-300/15 bg-rose-300/[0.055] px-3.5 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-300/[0.1] sm:self-auto"
            >
              Delete all data
            </button>
          </div>
        </div>
        {importError && <p role="alert" className="text-xs text-rose-300">{importError}</p>}
      </section>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete All Data"
        message="This will permanently remove all your connected accounts and settings. This cannot be undone."
        confirmLabel="Delete Everything"
        danger
        requireType="delete all"
        onConfirm={handleDeleteAll}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
