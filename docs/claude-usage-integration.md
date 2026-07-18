# Claude.ai Usage Integration — How We Built It

**Date:** 2026-07-17
**Status:** Working
**Scope:** Automatically fetch Claude.ai usage limits (session, weekly, per-model) into IA Hub's Dashboard.

---

## 1. The goal

Track the usage limits shown on Claude.ai's settings page (the "Weekly Limits: All Models 10%, Fable 18%" screen) automatically, without the user copy-pasting anything.

---

## 2. Why this is hard (three dead ends)

### 2.1 Anthropic official API has NO usage endpoint

The first instinct was to call `https://api.anthropic.com/v1/organizations/{org_id}/usage` with an API key from the Anthropic Console.

**Result:** `HTTP 404 Not Found`.

Tested directly with curl:

```bash
curl -I -H "x-api-key: test" -H "anthropic-version: 2023-06-01" https://api.anthropic.com/v1/organizations
# HTTP/2 404
```

Consulted the official API docs at `https://docs.anthropic.com/en/api`. Available endpoints are:

- `POST /v1/messages`
- `GET /v1/models`
- `POST /v1/messages/count_tokens`
- Message Batches, Files, Skills, Agents, Sessions (beta)

**There is no `/usage` endpoint in the official Anthropic API.**

### 2.2 The usage data lives on claude.ai, not on api.anthropic.com

The usage screen the user shared lives at `https://claude.ai/settings/billing`. That data is served by claude.ai's internal API, the same one the Claude web UI uses. It is undocumented.

The macOS app `Claude-Usage-Tracker` (3.1k stars) uses this internal API. From their source (`ClaudeAPIService.swift`):

```
GET https://claude.ai/api/organizations/{org_id}/usage
Cookie: sessionKey=...
```

### 2.3 Browsers cannot call claude.ai directly (CORS)

IA Hub is a browser app on `localhost:5173`. Any request from the browser to `claude.ai` would be blocked by CORS because `claude.ai` doesn't whitelist `localhost` in `Access-Control-Allow-Origin`.

Verified:

```bash
curl -I -H "Origin: http://localhost:5173" https://api.anthropic.com/v1/messages
# no access-control-allow-origin header returned
```

Claude-Usage-Tracker escapes CORS because it's a **native macOS Swift app** — it uses `URLSession`, not a browser. No CORS restrictions apply to native apps.

---

## 3. The solution: Electron + session cookie extraction

### 3.1 Why Electron

Electron wraps our existing React/TypeScript web app inside a native shell. The native main process (Node.js) can make HTTP requests without CORS restrictions — effectively the same escape hatch Claude-Usage-Tracker uses.

This let us keep 100% of the existing UI and only add a thin proxy layer for API calls.

### 3.2 Authentication without copy-pasting cookies

Claude-Usage-Tracker's older versions required the user to open DevTools, find the `sessionKey` cookie, and paste it into the app. That's painful.

Electron gives us a better way: **an embedded BrowserWindow**.

Flow:

1. User clicks **Connect Claude Account** in Settings.
2. Electron opens a modal `BrowserWindow` pointed at `https://claude.ai/login`.
3. The user logs in normally (email, Google SSO, whatever).
4. We poll `session.defaultSession.cookies.get({ domain: 'claude.ai', name: 'sessionKey' })` every second.
5. As soon as the cookie appears, we grab it, close the auth window, and store the `sessionKey` in our Zustand store.
6. From then on, every usage fetch uses that stored `sessionKey`.

No DevTools, no copy-paste. The user just logs in once. Cookies are persisted between app launches via `session.defaultSession.cookies.allowFile = true`.

---

## 4. API endpoints we use

From studying Claude-Usage-Tracker's `ClaudeAPIService.swift` and `ClaudeUsage.swift`:

### 4.1 List organizations

```
GET https://claude.ai/api/organizations
Cookie: sessionKey=<key>
Accept: application/json
Referer: https://claude.ai
Origin: https://claude.ai
User-Agent: Mozilla/5.0 ...
```

Response: array of `{ uuid: string, name: string }`. We auto-select the first org (same as Claude-Usage-Tracker).

### 4.2 Fetch usage

```
GET https://claude.ai/api/organizations/{org_id}/usage
Cookie: sessionKey=<key>
```

**Critical:** The response field names are `utilization` and `resets_at` — NOT `utilization_pct` and `reset_at` (which appear in some older docs). This was the bug that made our bars show `%` with no numbers.

Real response structure (verified by tracing the parser):

```json
{
  "five_hour": { "utilization": 0, "resets_at": "2026-07-17T20:00:00.000Z" },
  "seven_day": { "utilization": 10, "resets_at": "..." },
  "seven_day_opus": { "utilization": 18 },
  "limits": [
    {
      "kind": "weekly_scoped",
      "percent": 18,
      "resets_at": "...",
      "scope": { "model": { "id": null, "display_name": "Fable" } }
    }
  ]
}
```

The `limits[]` array is the **source of truth** when present — it overrides the legacy `seven_day_opus` / `seven_day_sonnet` / `seven_day_fable` / `seven_day_omelette` fields. Each entry has `kind: "weekly_scoped"`, `percent` (0-100), `resets_at`, and `scope.model.display_name` (e.g. "Fable", "Opus", "Sonnet", "Design").

### 4.3 Overage (optional, not implemented yet)

Claude-Usage-Tracker also fetches `/organizations/{org_id}/overage_spend_limit` and `/organizations/{org_id}/overage_credit_grant`. We don't need those for v1.

---

## 5. Architecture

```
React Renderer                Electron Main Process            claude.ai API
────────────                  ──────────────────────           ────────────
SettingsPage.tsx
   ↓ click "Connect"
window.electronAPI.claudeLogin()
   ↓ IPC: 'claude-login'  →
                              new BrowserWindow({ url: 'https://claude.ai/login' })
                              poll session.cookies.get('claude.ai', 'sessionKey')
                              ← cookie appears after user logs in
   ← returns { sessionKey }
updateClaudeConfig({ sessionKey, enabled: true })
fetchUsage()
   ↓ IPC: 'claude-fetch-usage', sessionKey →
                              GET https://claude.ai/api/organizations
                              pick orgs[0].uuid
                              GET https://claude.ai/api/organizations/{uuid}/usage
                              ← { five_hour, seven_day, limits }
   ← response
parse limits[] → set({ usageLimits })
   ↓
DashboardPage renders <UsageLimits limits={usageLimits} />
```

The renderer never touches `claude.ai` directly. It only talks to the main process via IPC (`contextBridge.exposeInMainWorld('electronAPI', ...)`). The main process uses the `net` module to make authenticated HTTP requests with the session cookie.

---

## 6. Key files

| File | Role |
|---|---|
| `electron/main.ts` | BrowserWindow creation, `claude-login` / `claude-fetch-usage` IPC handlers, cookie extraction |
| `electron/preload.ts` | `contextBridge` exposing `claudeLogin`, `claudeLogout`, `claudeFetchUsage` |
| `src/env.d.ts` | TypeScript declarations for `window.electronAPI` |
| `src/domain/types.ts` | `ClaudeAPIConfig`, `AnthropicUsageResponse`, `UsageLimit` |
| `src/state/store.ts` | `fetchUsage()` action — parses `five_hour` / `seven_day` / `limits[]` into `UsageLimit[]` |
| `src/ui/pages/SettingsPage.tsx` | "Connect Claude Account" button, Connected state, Disconnect, Refresh |
| `src/ui/pages/DashboardPage.tsx` | Renders `<UsageLimits>` both on dashboard and on empty state (so limits show even without subscriptions) |
| `src/ui/components/UsageLimits.tsx` | Progress bars colored by % (green/yellow/orange/red), reset countdown |
| `vite.config.ts` | `vite-plugin-electron` config |
| `package.json` | `dev:electron` and `build:electron` scripts, electron-builder config |

---

## 7. Pitfalls we hit (and how we fixed them)

### 7.1 `__dirname is not defined`

`"type": "module"` in `package.json` means ES modules. `__dirname` doesn't exist there.

**Fix:**
```ts
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
```

### 7.2 First run kept the old main process cached

After editing `electron/main.ts`, the electron watcher would re-bundle to `dist-electron/main.js`, but the running Electron instance kept the old code until we ran `rm -rf dist-electron` and restarted `npm run dev:electron`.

**Lesson:** When the main process keeps misbehaving after changes, delete `dist-electron/` and restart.

### 7.3 `toLowerCase of undefined` crash

We assumed the API returned a `limits[]` array with a `name` field. It doesn't — the per-model name lives at `scope.model.display_name`. Our code did `limit.name.toLowerCase()` and crashed.

**Fix:** Removed the assumption. Look up the model name via `limit.scope?.model?.display_name`. Skip any entry where the name is missing.

### 7.4 Bars showed `%` with no numbers

This was the Field-name mismatch. The README of Claude-Usage-Tracker listed `utilization_pct` / `reset_at`, but their actual code reads `utilization` / `resets_at`.

**Fix:** Always read the source (`ClaudeAPIService.swift`), trust it over docs. Updated `AnthropicUsageResponse` type and the parser in `src/state/store.ts`.

### 7.5 Usage Limits section never appeared

DashboardPage had an early-return `if (subscriptions.length === 0) { return <EmptyState /> }`. When there were no subscriptions, the whole Usage Limits section was skipped.

**Fix:** Render `<UsageLimits>` inside the empty-state branch too, when there are limits to show.

---

## 8. CORS research (for the record)

We did a real CORS probe against `api.anthropic.com`:

```
$ curl -s -I -X OPTIONS \
    -H "Origin: http://localhost:5173" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: x-api-key,anthropic-version" \
    https://api.anthropic.com/v1/organizations
HTTP/2 400
access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
access-control-allow-headers: x-api-key,anthropic-version
access-control-allow-credentials: true
vary: Origin
# (no access-control-allow-origin header)
```

Partial CORS configuration: methods and headers are allowed, but no origins are whitelisted. From the browser, any real request gets blocked. From Electron's main process (Node.js `net.request`), no CORS applies. Confirmed by manual build and live fetch in the running app.

---

## 9. How to operate

### 9.1 First-time setup

```bash
npm install
npm run dev:electron
```

Then in the app:

1. Go to **Settings → API Integration**.
2. Click **Connect Claude Account**.
3. A window opens with claude.ai — log in normally.
4. When the window closes automatically, you'll see **Connected** in Settings.
5. Go to **Dashboard** — the **Usage Limits** section appears at the top with colored bars.

### 9.2 Session expired

If limits stop updating (Refresh returns an authentication error):

1. Settings → **Disconnect**.
2. Settings → **Connect Claude Account** → log in again.

Cookies persist between app restarts, so usually the session survives multiple sessions.

### 9.3 Build a packaged desktop app

```bash
npm run build:electron
# output goes to ./release/
```

---

## 10. What we deliberately did NOT do

- **No backend server.** Stays local-first. The "proxy" is the Electron main process running inside the same desktop app.
- **No API key from the Anthropic Console.** The official API doesn't have the usage endpoint. Using the session cookie is the only way to get the real usage numbers from Claude's settings screen.
- **No OpenAI / Google integration yet.** Same approach can be reused once those providers expose usage via a scrapeable internal endpoint, but the session key flow only exists for Claude today.
- **No storage of the sessionKey in the OS keychain.** It lives in `localStorage` alongside the rest of the app state. Worth moving to Electron `safeStorage` (macOS Keychain / Linux libsecret) in a follow-up.

---

## 11. References

- Claude-Usage-Tracker repo: https://github.com/hamed-elfayome/Claude-Usage-Tracker
- Anthropic official API docs: https://docs.anthropic.com/en/api
- Electron docs: https://www.electronjs.org/docs/latest/
- vite-plugin-electron: https://github.com/electron-vite/vite-plugin-electron