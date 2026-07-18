interface ElectronAPI {
  claudeLogin: () => Promise<{ sessionKey: string } | null>
  claudeLogout: () => Promise<void>
  claudeFetchUsage: (sessionKey: string) => Promise<{
    usage: unknown
    organizations: Array<{ uuid: string; name: string }>
    overage: unknown | null
  }>

  opencodeLogin: () => Promise<{ sessionKey: string } | null>
  opencodeLogout: () => Promise<void>
  opencodeFetchUsage: (sessionKey: string) => Promise<{
    results: Array<{
      url: string
      status: number
      data: unknown
      error?: string
    }>
    cookieHeader: string
  }>
  opencodeDebugCookies: () => Promise<Array<{ name: string; value: string; domain: string; path: string }> | { error: string }>

  codexLogin: () => Promise<{ sessionKey: string } | null>
  codexLogout: () => Promise<void>
  codexFetchUsage: (sessionKey: string) => Promise<{
    results: Array<{ url: string; status: number; data: unknown; error?: string }>
  }>

  geminiLogin: () => Promise<{ sessionKey: string } | null>
  geminiLogout: () => Promise<void>
  geminiFetchUsage: (sessionKey: string) => Promise<{
    results: Array<{ url: string; status: number; data: unknown; error?: string }>
  }>
}

interface Window {
  electronAPI?: ElectronAPI
}