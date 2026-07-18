import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  claudeLogin: () => ipcRenderer.invoke('claude-login'),
  claudeLogout: () => ipcRenderer.invoke('claude-logout'),
  claudeFetchUsage: (sessionKey: string) =>
    ipcRenderer.invoke('claude-fetch-usage', sessionKey),

opencodeLogin: () => ipcRenderer.invoke('opencode-login'),
  opencodeLogout: () => ipcRenderer.invoke('opencode-logout'),
  opencodeFetchUsage: (sessionKey: string) =>
    ipcRenderer.invoke('opencode-fetch-usage', sessionKey),

  codexLogin: () => ipcRenderer.invoke('codex-login'),
  codexLogout: () => ipcRenderer.invoke('codex-logout'),
  codexFetchUsage: (sessionKey: string) =>
    ipcRenderer.invoke('codex-fetch-usage', sessionKey),

  geminiLogin: () => ipcRenderer.invoke('gemini-login'),
  geminiLogout: () => ipcRenderer.invoke('gemini-logout'),
  geminiFetchUsage: (sessionKey: string) =>
    ipcRenderer.invoke('gemini-fetch-usage', sessionKey),
})