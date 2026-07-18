import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore, type UsageFetchResult } from '../../state/store'
import DashboardPage from './DashboardPage'

const emptyResult: UsageFetchResult = { ok: true, errors: [], limitsCount: 0 }

beforeEach(() => {
  useAppStore.setState({
    settings: { apiConfig: { claude: null, codex: null, opencode: null, gemini: null } },
    currentPage: 'dashboard',
    usageLimits: [],
    usageLoading: false,
    usageError: null,
    fetchUsage: vi.fn(async () => emptyResult),
  })
})

describe('DashboardPage empty states', () => {
  it('asks for a first connection only when no provider is connected', () => {
    render(<DashboardPage />)
    expect(screen.getByRole('heading', { name: 'Connect your first provider' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'No usage windows available' })).not.toBeInTheDocument()
  })

  it('shows a no-data state when a connected provider returns no limits', () => {
    useAppStore.setState({
      settings: { apiConfig: { claude: { sessionKey: 'claude-session', enabled: true } } },
    })

    render(<DashboardPage />)

    expect(screen.getByRole('heading', { name: 'No usage windows available' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Connect your first provider' })).not.toBeInTheDocument()
  })
})
