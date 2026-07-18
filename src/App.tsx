import type { ReactNode } from 'react'
import { useAppStore, type Page } from './state/store'
import DashboardPage from './ui/pages/DashboardPage'
import SettingsPage from './ui/pages/SettingsPage'

interface NavItem {
  id: Page
  label: string
  icon: ReactNode
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Overview',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
        <path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Connections',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
        <path d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="m19.25 13.2 1.3 1.02-1.75 3.03-1.55-.62a7.95 7.95 0 0 1-2.08 1.2L14.93 19.5h-3.5l-.25-1.67a7.95 7.95 0 0 1-2.08-1.2l-1.54.62-1.75-3.03L7.1 13.2a8.13 8.13 0 0 1 0-2.4L5.8 9.78l1.75-3.03 1.55.62a7.95 7.95 0 0 1 2.08-1.2l.25-1.67h3.5l.24 1.67a7.95 7.95 0 0 1 2.08 1.2l1.55-.62 1.75 3.03-1.3 1.02a8.13 8.13 0 0 1 0 2.4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export default function App() {
  const currentPage = useAppStore((s) => s.currentPage)
  const setPage = useAppStore((s) => s.setPage)

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07090d] text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.09),transparent_40%),radial-gradient(circle_at_82%_0%,rgba(139,92,246,0.08),transparent_38%)]" />

      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#090b10]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setPage('dashboard')}
            className="group flex items-center gap-3 rounded-lg text-left"
            aria-label="Go to overview"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/15 to-violet-400/10 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-[19px] w-[19px] text-cyan-200">
                <path d="M5 17.5 9 6l3 8 2.5-6L19 17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[-0.01em] text-white">IA Hub</span>
              <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 sm:block">Usage intelligence</span>
            </span>
          </button>

          <nav aria-label="Primary navigation" className="flex items-center rounded-xl border border-white/[0.06] bg-white/[0.025] p-1">
            {navItems.map((item) => {
              const active = currentPage === item.id
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:px-4 ${
                    active
                      ? 'bg-white/[0.09] text-white shadow-sm'
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1240px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        {currentPage === 'dashboard' && <DashboardPage />}
        {currentPage === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}
