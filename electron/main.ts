import { app, BrowserWindow, ipcMain, net, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let authWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'IA Hub',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Auth Window (shared) ─────────────────────────────────────────

let resolveAuth: ((value: { sessionKey: string } | null) => void) | null = null
let activeCheckInterval: ReturnType<typeof setInterval> | null = null

interface LoginConfig {
  url: string
  cookieDomain: string
  title: string
  scrapeScript: string
  // Override the User-Agent for this window. Google refuses logins from
  // user-agents that expose "Electron", so Gemini passes a plain Chrome UA.
  userAgent?: string
}

function openLoginWindow(config: LoginConfig): Promise<{ sessionKey: string } | null> {
  return new Promise((resolve) => {
    resolveAuth = resolve

    authWindow = new BrowserWindow({
      width: 1000,
      height: 750,
      parent: mainWindow ?? undefined,
      modal: true,
      title: config.title,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    authWindow.loadURL(config.url, config.userAgent ? { userAgent: config.userAgent } : undefined)

    activeCheckInterval = setInterval(async () => {
      if (!authWindow || authWindow.isDestroyed()) {
        if (activeCheckInterval) clearInterval(activeCheckInterval)
        activeCheckInterval = null
        return
      }

      try {
        const result = await authWindow.webContents.executeJavaScript(config.scrapeScript)
        if (result) {
          console.log('[IA Hub] Scrape result:', result)
          if (activeCheckInterval) { clearInterval(activeCheckInterval); activeCheckInterval = null }
          if (authWindow && !authWindow.isDestroyed()) { authWindow.close(); authWindow = null }
          if (resolveAuth) { resolveAuth({ sessionKey: result }); resolveAuth = null }
        }
      } catch (err) {
        // Page not ready yet, keep polling
      }
    }, 2000)

    authWindow.on('closed', () => {
      if (activeCheckInterval) { clearInterval(activeCheckInterval); activeCheckInterval = null }
      authWindow = null
      if (resolveAuth) { resolveAuth(null); resolveAuth = null }
    })
  })
}

// ── Claude.ai ────────────────────────────────────────────────────

const claudeScrapeScript = `
  (() => {
    // Just check if session cookie exists — Claude works via cookie auth
    return document.cookie.includes('sessionKey') ? JSON.stringify({ auth: 'cookie' }) : null
  })()
`

ipcMain.handle('claude-login', () =>
  openLoginWindow({
    url: 'https://claude.ai/login',
    cookieDomain: 'claude.ai',
    title: 'Log in to Claude',
    scrapeScript: claudeScrapeScript,
  })
)

ipcMain.handle('claude-logout', async () => {
  try { await session.defaultSession.cookies.remove('https://claude.ai', 'sessionKey') } catch {}
})

// ── OpenCode Go ──────────────────────────────────────────────────

const opencodeScrapeScript = `
  (async () => {
    // Click on the "Go" tab in the sidebar
    const goLink = [...document.querySelectorAll('a, button')].find(el =>
      el.textContent?.trim() === 'Go' || el.textContent?.includes('Go')
    )
    if (goLink && !document.body.innerText.includes('Rolling Usage')) {
      goLink.click()
      await new Promise(r => setTimeout(r, 1500))
    }

    const fullText = document.body.innerText || ''

    // Find percentages with labels (label and % may be on separate lines)
    const percentages = []
    const pctRegex = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\\s]*?)\\s*(\\d+)%/g
    let m
    while ((m = pctRegex.exec(fullText)) !== null) {
      percentages.push({ label: m[1].trim(), value: parseInt(m[2]) })
    }

    // Find reset times
    const resets = []
    const resetRegex = /Resets?\\s+in\\s+([^.\\n]+)/gi
    let rm
    while ((rm = resetRegex.exec(fullText)) !== null) {
      resets.push(rm[1].trim())
    }

    // Only resolve once we actually scraped usage. Returning null keeps the
    // poll loop alive so the SPA has time to render before we capture (avoids
    // grabbing an empty result on the first tick).
    if (percentages.length > 0 || resets.length > 0) {
      return JSON.stringify({ usage: percentages, resets, url: window.location.href })
    }

    return null
  })()
`

ipcMain.handle('opencode-login', () =>
  openLoginWindow({
    url: 'https://opencode.ai/auth',
    cookieDomain: 'opencode.ai',
    title: 'Log in to OpenCode',
    scrapeScript: opencodeScrapeScript,
  })
)

ipcMain.handle('opencode-logout', () => {})

// ── Codex (ChatGPT) ──────────────────────────────────────────────

const codexScrapeScript = `
  (async () => {
    const ANALYTICS_URL = 'https://chatgpt.com/codex/cloud/settings/analytics#usage'
    const onAnalytics = window.location.pathname.includes('/codex/cloud/settings/analytics')
    const onAuth = /auth|login/i.test(window.location.pathname) || window.location.hostname.includes('auth.openai.com')

    // The ChatGPT login flow redirects to the chat home and drops our analytics
    // URL. If we're logged in (on chatgpt.com, not an auth page) but not on the
    // analytics page, navigate there. Capped via sessionStorage so a redirect
    // loop can never hammer forever.
    if (!onAnalytics && !onAuth && window.location.hostname.includes('chatgpt.com')) {
      const tries = parseInt(sessionStorage.getItem('iahub_codex_nav') || '0')
      if (tries < 5) {
        sessionStorage.setItem('iahub_codex_nav', String(tries + 1))
        window.location.href = ANALYTICS_URL
      }
      return null
    }

    // Still on the auth/login page — wait for the user to finish logging in.
    if (!onAnalytics) return null

    await new Promise(r => setTimeout(r, 2000))
    const fullText = document.body.innerText || ''

    const result = { usage: [], resets: [], turns: null, url: window.location.href }

    // Pattern 1: "35%\\nremaining" or "35% remaining"
    // Codex shows REMAINING %, so used = 100 - remaining
    const remainingMatch = fullText.match(/(\\d+)%\\s*\\n?\\s*remaining/i)
    if (remainingMatch) {
      const remaining = parseInt(remainingMatch[1])
      const used = 100 - remaining
      result.usage.push({ label: 'Weekly Usage', value: used, remaining: remaining, display: remaining + '% remaining' })
    }

    // Pattern for reset date: "Resets Jul 23, 2026 12:07 PM"
    const resetMatch = fullText.match(/Resets?\\s+([A-Za-z]+ \\d+,? \\d{4}[\\s\\d:APMapm]+)/i)
    if (resetMatch) {
      result.resets.push(resetMatch[1].trim())
    }

    // Turns count: "Turns\\n369" or "Turns 369"
    const turnsMatch = fullText.match(/Turns[\\s\\n]*(\\d+)/)
    if (turnsMatch) {
      result.turns = parseInt(turnsMatch[1])
    }

    // Only resolve once we actually scraped the weekly limit. Returning null
    // keeps the poll loop alive so the user can finish logging in and the
    // analytics SPA has time to render before we capture.
    if (result.usage.length > 0) {
      return JSON.stringify(result)
    }

    return null
  })()
`

ipcMain.handle('codex-login', () =>
  openLoginWindow({
    url: 'https://chatgpt.com/codex/cloud/settings/analytics#usage',
    cookieDomain: 'chatgpt.com',
    title: 'Log in to ChatGPT',
    scrapeScript: codexScrapeScript,
  })
)

ipcMain.handle('codex-logout', () => {})

ipcMain.handle('codex-fetch-usage', async (_event, sessionKey: string) => {
  if (!sessionKey) throw new Error('Session key required')
  try {
    const parsed = JSON.parse(sessionKey)
    return { results: [{ url: 'dom-scrape', status: 200, data: parsed }] }
  } catch {
    return { results: [{ url: 'dom-scrape', status: 200, data: { usage: [], resets: [] } }] }
  }
})

// ── Gemini (Google) ──────────────────────────────────────────────

// Gemini shows "N % usado" (USED, not remaining) for two limits: a current
// session limit that resets at a time today, and a weekly limit that resets on
// a dated day. Reset timestamps are resolved to ISO here where the browser's
// clock and Spanish/English month names are easiest to handle.
const geminiScrapeScript = `
  (async () => {
    const USAGE_URL = 'https://gemini.google.com/usage'
    const onUsage = window.location.pathname.includes('/usage')
    const onAuth = window.location.hostname.includes('accounts.google.com')

    // Google's post-login redirect can drop us on the chat app instead of the
    // usage page. If we're on gemini but not the usage page, navigate there.
    if (!onUsage && !onAuth && window.location.hostname.includes('gemini.google.com')) {
      const tries = parseInt(sessionStorage.getItem('iahub_gemini_nav') || '0')
      if (tries < 5) {
        sessionStorage.setItem('iahub_gemini_nav', String(tries + 1))
        window.location.href = USAGE_URL
      }
      return null
    }

    // Still on the auth page — wait for the user to finish logging in.
    if (!onUsage) return null

    await new Promise(r => setTimeout(r, 2000))
    const fullText = document.body.innerText || ''

    const monthMap = {
      ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,set:8,oct:9,nov:10,dic:11,
      jan:0,apr:3,aug:7,dec:11,
    }
    function resetFromTime(hhmm) {
      const parts = hhmm.split(':')
      const d = new Date()
      d.setSeconds(0, 0)
      d.setHours(parseInt(parts[0]), parseInt(parts[1]))
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
      return d.toISOString()
    }
    function resetFromDate(day, mon, hhmm) {
      const mi = monthMap[mon.toLowerCase().slice(0, 3)]
      if (mi === undefined) return null
      const parts = hhmm.split(':')
      const now = new Date()
      const d = new Date(now.getFullYear(), mi, parseInt(day), parseInt(parts[0]), parseInt(parts[1]), 0, 0)
      if (d.getTime() < Date.now()) d.setFullYear(d.getFullYear() + 1)
      return d.toISOString()
    }

    const usage = []

    // Current usage: "N % usado" near "Uso actual", reset "Se restablece a las HH:MM"
    const currentPct = fullText.match(/Uso actual[\\s\\S]{0,80}?(\\d+)\\s*%/i) ||
                       fullText.match(/Current usage[\\s\\S]{0,80}?(\\d+)\\s*%/i)
    const currentReset = fullText.match(/Se restablece a las (\\d{1,2}:\\d{2})/i) ||
                         fullText.match(/Resets at (\\d{1,2}:\\d{2})/i)
    if (currentPct) {
      usage.push({
        id: 'gemini-current',
        name: 'Gemini · Current Usage',
        value: parseInt(currentPct[1]),
        resetsAt: currentReset ? resetFromTime(currentReset[1]) : null,
      })
    }

    // Weekly limit: "N % usado" near "Límite semanal", reset "Se restablece el DD mmm a las HH:MM"
    const weeklyPct = fullText.match(/L[íi]mite semanal[\\s\\S]{0,120}?(\\d+)\\s*%/i) ||
                      fullText.match(/Weekly limit[\\s\\S]{0,120}?(\\d+)\\s*%/i)
    const weeklyReset = fullText.match(/Se restablece el (\\d{1,2})\\s+([A-Za-z]+)\\.?\\s+a las (\\d{1,2}:\\d{2})/i)
    if (weeklyPct) {
      usage.push({
        id: 'gemini-weekly',
        name: 'Gemini · Weekly Limit',
        value: parseInt(weeklyPct[1]),
        resetsAt: weeklyReset ? resetFromDate(weeklyReset[1], weeklyReset[2], weeklyReset[3]) : null,
      })
    }

    if (usage.length > 0) {
      return JSON.stringify({ usage, url: window.location.href })
    }
    return null
  })()
`

ipcMain.handle('gemini-login', () =>
  openLoginWindow({
    url: 'https://gemini.google.com/usage',
    cookieDomain: 'google.com',
    title: 'Log in to Google',
    scrapeScript: geminiScrapeScript,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  })
)

ipcMain.handle('gemini-logout', () => {})

ipcMain.handle('gemini-fetch-usage', async (_event, sessionKey: string) => {
  if (!sessionKey) throw new Error('Session key required')
  try {
    const parsed = JSON.parse(sessionKey)
    return { results: [{ url: 'dom-scrape', status: 200, data: parsed }] }
  } catch {
    return { results: [{ url: 'dom-scrape', status: 200, data: { usage: [] } }] }
  }
})

function fetchJSON(url: string, headers: Record<string, string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: 'GET', headers })
    request.on('response', (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8')
        try {
          const data = JSON.parse(body)
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve(data)
          } else {
            reject(new Error(`HTTP ${response.statusCode}: ${JSON.stringify(data).slice(0, 200)}`))
          }
        } catch {
          reject(new Error(`Parse error: ${body.slice(0, 200)}`))
        }
      })
    })
    request.on('error', reject)
    request.end()
  })
}

function claudeHeaders(sessionKey: string): Record<string, string> {
  return {
    Cookie: `sessionKey=${sessionKey}`,
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    Referer: 'https://claude.ai',
    Origin: 'https://claude.ai',
  }
}

ipcMain.handle('claude-fetch-usage', async (_event, sessionKey: string) => {
  if (!sessionKey) throw new Error('Session key required')

  const orgs = await fetchJSON('https://claude.ai/api/organizations', claudeHeaders(sessionKey)) as Array<{ uuid: string }>
  if (!orgs || orgs.length === 0) throw new Error('No organizations found')

  const orgId = orgs[0].uuid
  const usage = await fetchJSON(`https://claude.ai/api/organizations/${orgId}/usage`, claudeHeaders(sessionKey))

  let overage = null
  try {
    overage = await fetchJSON(`https://claude.ai/api/organizations/${orgId}/overage_spend_limit`, claudeHeaders(sessionKey))
  } catch {}

  return { usage, organizations: orgs, overage }
})

// ── OpenCode Fetch (passthrough — data comes from scrape) ────────

ipcMain.handle('opencode-fetch-usage', async (_event, sessionKey: string) => {
  if (!sessionKey) throw new Error('Session key required')

  // sessionKey is the JSON string from the DOM scrape
  try {
    const parsed = JSON.parse(sessionKey)
    return { results: [{ url: 'dom-scrape', status: 200, data: parsed }], cookieHeader: '' }
  } catch {
    return { results: [{ url: 'dom-scrape', status: 200, data: { usage: [], resets: [] } }], cookieHeader: '' }
  }
})
