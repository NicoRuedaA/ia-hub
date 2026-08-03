import type { ReactNode } from 'react'
import { useAppStore, type Page } from './state/store'
import { usePreferencesStore } from './state/preferencesStore'
import { useTranslation } from './i18n'
import DashboardPage from './ui/pages/DashboardPage'
import SettingsPage from './ui/pages/SettingsPage'
import LanguagePicker from './ui/components/LanguagePicker'

interface NavItem {
  id: Page
  label: string
  icon: ReactNode
}

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const currentPage = useAppStore((s) => s.currentPage)
  const setPage = useAppStore((s) => s.setPage)
  const { t } = useTranslation()

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: t('nav.dashboard'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="16" height="16">
          <path d="M4 5.5h6v6H4v-6Zm10 0h6v6h-6v-6ZM4 15.5h6v3H4v-3Zm10 0h6v3h-6v-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: t('nav.settings'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="16" height="16">
          <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" strokeWidth="1.6" />
          <path d="m19.2 13.1 1.2 1-1.6 2.8-1.5-.6c-.6.5-1.3.9-2.1 1.2l-.2 1.5h-3.3l-.2-1.5a8 8 0 0 1-2.1-1.2l-1.5.6-1.6-2.8 1.2-1a7.3 7.3 0 0 1 0-2.2l-1.2-1 1.6-2.8 1.5.6c.6-.5 1.3-.9 2.1-1.2l.2-1.5H15l.2 1.5c.8.3 1.5.7 2.1 1.2l1.5-.6 1.6 2.8-1.2 1a7.3 7.3 0 0 1 0 2.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      ),
    },
  ]

  return (
    <nav aria-label={t('app.primaryNavigation')} className={mobile ? 'mobile-nav' : 'workspace-nav'}>
      {navItems.map((item) => {
        const active = currentPage === item.id
        return (
          <button
            type="button"
            key={item.id}
            onClick={() => setPage(item.id)}
            aria-current={active ? 'page' : undefined}
            className={`${mobile ? 'mobile-nav-item' : 'nav-item'} ${active ? 'is-active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function Brand({ mobile = false }: { mobile?: boolean }) {
  const { t } = useTranslation()

  return (
    <span className={mobile ? 'mobile-brand' : 'brand-content'}>
      <span className="brand-mark" aria-hidden="true">IA</span>
      <span>
        <span className="brand-name">IA Hub</span>
        <span className="brand-caption">{t('app.brandCaption')}</span>
      </span>
    </span>
  )
}

function ThemeToggle({ mobile = false }: { mobile?: boolean }) {
  const theme = usePreferencesStore((state) => state.theme)
  const setTheme = usePreferencesStore((state) => state.setTheme)
  const { t } = useTranslation()
  const nextTheme = theme === 'light' ? 'dark' : 'light'
  const currentLabel = t(theme === 'light' ? 'theme.light' : 'theme.dark')
  const nextLabel = t(nextTheme === 'light' ? 'theme.light' : 'theme.dark')

  return (
    <button
      type="button"
      className={`theme-toggle ${mobile ? 'theme-toggle-mobile' : ''}`}
      aria-label={t('theme.switchTo', { theme: nextLabel })}
      aria-pressed={theme === 'dark'}
      onClick={() => setTheme(nextTheme)}
    >
      <span>{t('theme.label')}</span>
      <strong>{currentLabel}</strong>
      <span className="theme-toggle-next">{nextLabel}</span>
    </button>
  )
}

export default function App() {
  const currentPage = useAppStore((s) => s.currentPage)
  const { t } = useTranslation()
  const language = usePreferencesStore((state) => state.language)

  return (
    <>
      <div className="app-shell">
      <div className="mobile-topbar">
        <Brand mobile />
        <Navigation mobile />
        <ThemeToggle mobile />
      </div>

        <div className="workspace-layout">
        <aside className="workspace-sidebar" aria-label={t('app.workspaceSidebar')}>
          <button type="button" onClick={() => useAppStore.getState().setPage('dashboard')} className="brand-lockup" aria-label={t('app.goDashboard')}>
            <Brand />
          </button>

          <p className="sidebar-label">{t('app.workspace')}</p>
          <Navigation />

          <div className="sidebar-context">
            <p className="sidebar-label" style={{ margin: 0 }}>{t('app.context')}</p>
            <p className="context-name">{t('app.providerUsage')}</p>
            <p className="context-copy">{t('app.contextCopy')}</p>
          </div>

          <ThemeToggle />
          <div className="sidebar-footer">
            <strong>{t('app.localFirst')}</strong><br />{t('app.localDataStays')}
          </div>
        </aside>

        <main className="workspace-main">
          <div className="workspace-content">
            {currentPage === 'dashboard' && <DashboardPage />}
            {currentPage === 'settings' && <SettingsPage />}
          </div>
        </main>
        </div>
      </div>
      <LanguagePicker open={language === null} />
    </>
  )
}
