import { useRef, useState, type ChangeEvent } from 'react'
import { useAppStore } from '../../state/store'
import { languageName, useTranslation } from '../../i18n'
import { usePreferencesStore } from '../../state/preferencesStore'
import type { UiLanguage } from '../../domain/types'
import { defaultState } from '../../infrastructure/schema'
import { validateState } from '../../infrastructure/schema'
import ConfirmDialog from '../components/ConfirmDialog'
import ProviderConnect from '../components/ProviderConnect'

export default function SettingsPage() {
  const { language, t } = useTranslation()
  const theme = usePreferencesStore((state) => state.theme)
  const setTheme = usePreferencesStore((state) => state.setTheme)
  const setLanguage = usePreferencesStore((state) => state.setLanguage)
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

  function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        const validated = validateState(parsed)
        if (!validated) {
           setImportError(t('settings.invalidFile'))
          return
        }
        importData(validated)
      } catch {
         setImportError(t('settings.parseFileError'))
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
     if (!result.ok) throw new Error(result.errors.join(' | ') || t('provider.refreshFailed'))
  }

  const hasElectron = typeof window !== 'undefined' && window.electronAPI

  const connectedCount = [claudeConfig, opencodeConfig, codexConfig, geminiConfig]
    .filter((config) => config?.enabled && config.sessionKey).length

  return (
    <div className="page-stack">
      <header className="document-header">
        <div>
          <div className="breadcrumb"><span>{t('app.workspace')}</span><span aria-hidden="true">/</span><strong>{t('settings.breadcrumb')}</strong></div>
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="page-description">
            {t('settings.description')}
          </p>
        </div>
        <div className="page-header-aside">
          <p className="page-header-aside-label">{t('settings.workspaceStatus')}</p>
          <p className="page-header-aside-value"><span className={`status-dot ${hasElectron ? 'status-dot-positive' : 'status-dot-warning'}`} /> {t('settings.activeOf', { connected: connectedCount })}</p>
          <p className="page-header-aside-copy">{hasElectron ? t('settings.desktopReady') : t('settings.desktopUnavailable')}</p>
        </div>
      </header>

      {!hasElectron && (
        <div role="status" className="notice notice-warning">
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
            <path d="M12 8v5m0 3v.01M10.3 4.9 3.2 17.2A1.2 1.2 0 0 0 4.24 19h15.52a1.2 1.2 0 0 0 1.04-1.8L13.7 4.9a1.96 1.96 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <div>
            <strong>{t('settings.desktopRequiredTitle')}</strong>
            <div>{t('settings.desktopRequiredCopy')}</div>
          </div>
        </div>
      )}

      <div className="settings-layout">
         <aside className="settings-index" aria-label={t('settings.sections')}>
           <p className="settings-index-label">{t('settings.onThisPage')}</p>
           <a href="#providers">{t('settings.providers')}</a>
           <a href="#preferences">{t('settings.preferences')}</a>
           <a href="#local-data">{t('settings.localData')}</a>
           <a href="#danger-zone">{t('settings.dangerZone')}</a>
        </aside>

        <div className="settings-sections">
      <section id="providers" aria-labelledby="providers-heading" className="document-section">
        <div>
           <h2 id="providers-heading" className="section-title">{t('settings.aiProviders')}</h2>
           <p className="section-copy mt-1">{t('settings.providersCopy')}</p>
        </div>
        <div className="provider-list">
          <ProviderConnect
          title="Claude.ai"
           description={t('settings.claudeDescription')}
          connected={!!claudeConfig?.sessionKey}
          enabled={!!claudeConfig?.enabled}
          onConnect={async (setLoading, setError, setSuccess) => {
            setLoading(true)
            setError(null)
            setSuccess(false)
            try {
               if (!window.electronAPI) throw new Error(t('settings.electronUnavailable'))
              const result = await window.electronAPI.claudeLogin()
               if (!result?.sessionKey) throw new Error(t('provider.loginCancelled'))
              updateClaudeConfig({ sessionKey: result.sessionKey, enabled: true })
              await new Promise((r) => setTimeout(r, 100))
              await fetchUsageOrThrow()
              setSuccess(true)
            } catch (e) {
               setError(e instanceof Error ? e.message : t('provider.loginFailed'))
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
               setError(e instanceof Error ? e.message : t('provider.refreshFailed'))
            } finally {
              setLoading(false)
            }
          }}
          />

          <ProviderConnect
          title="OpenCode Go"
           description={t('settings.opencodeDescription')}
          connected={!!opencodeConfig?.sessionKey}
          enabled={!!opencodeConfig?.enabled}
          onConnect={async (setLoading, setError, setSuccess) => {
            setLoading(true)
            setError(null)
            setSuccess(false)
            try {
               if (!window.electronAPI) throw new Error(t('settings.electronUnavailable'))
              const result = await window.electronAPI.opencodeLogin()
               if (!result?.sessionKey) throw new Error(t('provider.loginCancelled'))
              updateOpenCodeConfig({ sessionKey: result.sessionKey, enabled: true })
              await new Promise((r) => setTimeout(r, 100))
              await fetchUsageOrThrow()
              setSuccess(true)
            } catch (e) {
               setError(e instanceof Error ? e.message : t('provider.loginFailed'))
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
               if (!window.electronAPI) throw new Error(t('settings.electronUnavailable'))
              const result = await window.electronAPI.opencodeLogin()
               if (!result?.sessionKey) throw new Error(t('provider.refreshUnavailable'))
              updateOpenCodeConfig({ sessionKey: result.sessionKey, enabled: true })
              await new Promise((r) => setTimeout(r, 100))
              await fetchUsageOrThrow()
              setSuccess(true)
            } catch (e) {
               setError(e instanceof Error ? e.message : t('provider.refreshFailed'))
            } finally {
              setLoading(false)
            }
          }}
          />

          <ProviderConnect
          title="Codex"
           description={t('settings.codexDescription')}
          connected={!!codexConfig?.sessionKey}
          enabled={!!codexConfig?.enabled}
          onConnect={async (setLoading, setError, setSuccess) => {
            setLoading(true)
            setError(null)
            setSuccess(false)
            try {
               if (!window.electronAPI) throw new Error(t('settings.electronUnavailable'))
              const result = await window.electronAPI.codexLogin()
               if (!result?.sessionKey) throw new Error(t('provider.loginCancelled'))
              updateCodexConfig({ sessionKey: result.sessionKey, enabled: true })
              await new Promise((r) => setTimeout(r, 100))
              await fetchUsageOrThrow()
              setSuccess(true)
            } catch (e) {
               setError(e instanceof Error ? e.message : t('provider.loginFailed'))
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
               if (!window.electronAPI) throw new Error(t('settings.electronUnavailable'))
              const result = await window.electronAPI.codexLogin()
               if (!result?.sessionKey) throw new Error(t('provider.refreshUnavailable'))
              updateCodexConfig({ sessionKey: result.sessionKey, enabled: true })
              await new Promise((r) => setTimeout(r, 100))
              await fetchUsageOrThrow()
              setSuccess(true)
            } catch (e) {
               setError(e instanceof Error ? e.message : t('provider.refreshFailed'))
            } finally {
              setLoading(false)
            }
          }}
          />

          <ProviderConnect
          title="Gemini"
           description={t('settings.geminiDescription')}
          connected={!!geminiConfig?.sessionKey}
          enabled={!!geminiConfig?.enabled}
          onConnect={async (setLoading, setError, setSuccess) => {
            setLoading(true)
            setError(null)
            setSuccess(false)
            try {
               if (!window.electronAPI) throw new Error(t('settings.electronUnavailable'))
              const result = await window.electronAPI.geminiLogin()
               if (!result?.sessionKey) throw new Error(t('provider.loginCancelled'))
              updateGeminiConfig({ sessionKey: result.sessionKey, enabled: true })
              await new Promise((r) => setTimeout(r, 100))
              await fetchUsageOrThrow()
              setSuccess(true)
            } catch (e) {
               setError(e instanceof Error ? e.message : t('provider.loginFailed'))
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
               if (!window.electronAPI) throw new Error(t('settings.electronUnavailable'))
              const result = await window.electronAPI.geminiLogin()
               if (!result?.sessionKey) throw new Error(t('provider.refreshUnavailable'))
              updateGeminiConfig({ sessionKey: result.sessionKey, enabled: true })
              await new Promise((r) => setTimeout(r, 100))
              await fetchUsageOrThrow()
              setSuccess(true)
            } catch (e) {
               setError(e instanceof Error ? e.message : t('provider.refreshFailed'))
            } finally {
              setLoading(false)
            }
          }}
          />
        </div>
      </section>

       <section id="preferences" aria-labelledby="preferences-heading" className="document-section">
         <div className="section-heading">
           <div>
             <h2 id="preferences-heading" className="section-title">{t('settings.preferencesTitle')}</h2>
             <p className="section-copy">{t('settings.preferencesCopy')}</p>
           </div>
         </div>
         <div className="settings-panel">
           <div className="settings-panel-row">
             <div>
               <h3 className="settings-panel-title">{t('theme.label')}</h3>
               <p className="settings-panel-copy">{t(theme === 'light' ? 'theme.light' : 'theme.dark')} · {t('theme.switchTo', { theme: t(theme === 'light' ? 'theme.dark' : 'theme.light') })}</p>
             </div>
             <div className="settings-panel-actions" role="group" aria-label={t('theme.label')}>
               {(['light', 'dark'] as const).map((option) => (
                 <button key={option} type="button" className={theme === option ? 'button-primary' : 'button-secondary'} aria-pressed={theme === option} onClick={() => setTheme(option)}>
                   {t(option === 'light' ? 'theme.light' : 'theme.dark')}
                 </button>
               ))}
             </div>
           </div>
           <div className="settings-panel-row">
             <div>
               <h3 className="settings-panel-title">{t('language.label')}</h3>
               <p className="settings-panel-copy">{t('language.active', { language: languageName(language, language ?? 'en') })}</p>
             </div>
             <div className="settings-panel-actions" role="group" aria-label={t('language.label')}>
               {(['en', 'es'] as UiLanguage[]).map((option) => {
                 const label = languageName(language, option)
                 return (
                   <button key={option} type="button" className={language === option ? 'button-primary' : 'button-secondary'} aria-pressed={language === option} onClick={() => setLanguage(option)}>
                     {label}
                   </button>
                 )
               })}
             </div>
           </div>
         </div>
       </section>

       <section id="local-data" aria-labelledby="data-heading" className="document-section">
        <div className="section-heading">
          <div>
            <h2 id="data-heading" className="section-title">{t('settings.localData')}</h2>
            <p className="section-copy">{t('settings.localDataCopy')}</p>
          </div>
        </div>

        <div className="settings-panel">
          <div className="settings-panel-row">
            <div>
               <h3 className="settings-panel-title">{t('settings.backupRestore')}</h3>
               <p className="settings-panel-copy">{t('settings.backupRestoreCopy')}</p>
            </div>
            <div className="settings-panel-actions">
               <button type="button" onClick={handleExport} className="button-secondary">{t('settings.exportData')}</button>
              <label className="button-secondary">
                 {t('settings.importData')}
                <input ref={fileRef} type="file" accept=".json" onChange={handleImportFile} className="sr-only" />
              </label>
            </div>
          </div>
          <div id="danger-zone" className="settings-panel-row danger-section">
            <div>
               <h3 className="settings-panel-title">{t('settings.dangerZone')}</h3>
               <p className="settings-panel-copy"><strong>{t('settings.deleteLocalData')}</strong> {t('settings.deleteCopy')}</p>
            </div>
            <div className="settings-panel-actions">
               <button type="button" onClick={() => setShowDeleteConfirm(true)} className="button-danger">{t('settings.deleteAll')}</button>
            </div>
          </div>
        </div>
        {importError && <p role="alert" className="notice notice-error" style={{ marginTop: 12 }}>{importError}</p>}
      </section>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
         title={t('confirm.deleteTitle')}
         message={t('confirm.deleteMessage')}
         confirmLabel={t('confirm.deleteEverything')}
         danger
         requireType={t('confirm.deletePhrase')}
        onConfirm={handleDeleteAll}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
