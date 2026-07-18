# IA Hub

**A local-first desktop app that tracks your AI usage limits in one place.**

Claude, OpenCode Go, Codex (ChatGPT), and Gemini each hide your rate-limit
status behind a different dashboard. IA Hub logs into each provider through an
embedded browser window, reads your current usage, and surfaces every limit —
session, weekly, model-specific — on a single screen, with clear reset times
and risk states.

No API keys. No scraping servers. No data leaves your machine.

Built with Electron, React 19, TypeScript (`strict`), Tailwind CSS 4, Zustand,
Recharts, and date-fns.

---

## Why it exists

The official provider APIs don't expose consumer plan limits. There is no
"usage endpoint" in the Anthropic API, no public quota API for ChatGPT or
Gemini. The only place that data lives is the same authenticated web UI you
already log into.

So IA Hub reuses **your own logged-in session** — the exact cookies your
browser holds — to read the same internal endpoints and dashboards the provider
UIs use. You log in normally, in a real browser window; IA Hub never sees your
password and stores no credentials of its own.

---

## Quick start

```bash
npm install
npm run dev:electron
```

The Electron window opens with HMR. Go to **Connections**, connect a provider,
and its limits appear on the **Overview** dashboard.

### Commands

| Command | Description |
|---|---|
| `npm run dev:electron` | Run the desktop app with hot reload |
| `npm run dev` | Run the renderer only, in the browser (no provider auth) |
| `npm run build` | Type-check + production build of the renderer |
| `npm run build:electron` | Build and package the desktop app (AppImage / dmg / nsis) |
| `npm test` | Run the test suite (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint with oxlint |

---

## Providers & how each connects

Every provider has a different auth surface, so the connection strategy differs.
All of it happens inside a modal Electron `BrowserWindow` you drive yourself.

| Provider | Login | How usage is read |
|---|---|---|
| **Claude** | claude.ai login window | Session cookie → internal `organizations/{id}/usage` endpoint (session 5h, weekly, weekly Opus) |
| **OpenCode Go** | opencode.ai/auth | DOM scrape of the usage panel (rolling usage + reset times) |
| **Codex** | chatgpt.com login | DOM scrape of the Codex analytics page (weekly usage %, turns, reset date) |
| **Gemini** | Google account login | DOM scrape of `gemini.google.com/usage` (current + weekly limits, localized reset parsing) |

Notes:

- **Claude** is the only cookie-based fetch: once the `sessionKey` cookie
  exists, the Electron main process calls the same internal API the web app
  uses (`net.request`, no CORS limits) and parses `five_hour`, `seven_day`, and
  `seven_day_opus` utilization.
- **Codex / Gemini** post-login redirects can drop you on the chat home; the
  scrape script navigates back to the usage/analytics page (capped retries via
  `sessionStorage` so it can never loop forever).
- **Gemini** uses a plain Chrome User-Agent because Google refuses logins from
  user-agents that advertise "Electron", and resolves Spanish/English month
  names when parsing reset dates.
- Sessions expire. When a provider goes stale, **Disconnect → Connect** again to
  refresh the login.

---

## Architecture

Layered, dependency rule pointing inward. The domain stays pure; Electron and
React sit at the edges.

```
Electron Main (Node.js)  ──IPC──▶  Preload bridge  ──▶  React Renderer
   auth windows                    window.electronAPI      Zustand store
   provider fetch/scrape                                   pure presentation
```

```
src/
  domain/
    types.ts                  # Provider, APIConfig, UsageLimit, provider responses
  infrastructure/
    repository.ts             # persistence port (interface)
    localStorageRepository.ts # localStorage adapter
    schema.ts                 # persisted shape + version
  state/
    store.ts                  # Zustand: config actions + fetchUsage() + import/export
  ui/
    usagePresentation.ts      # pure: usage → display state (labels, %, risk)
    pages/                    # DashboardPage, SettingsPage (containers)
    components/               # Modal, ProviderConnect, UsageLimits, ConfirmDialog
  App.tsx                     # shell + navigation
electron/
  main.ts                     # IPC handlers, auth windows, provider fetch/scrape
  preload.ts                  # contextBridge → electronAPI
```

Rules that hold the design together:

1. **The domain and presentation layers never touch Electron or the DOM.**
   Parsing a provider response into `UsageLimit[]` and turning a `UsageLimit`
   into display state are pure functions, tested in isolation.
2. **Persistence is behind a port.** The store talks to the repository
   interface, not to `localStorage` directly — swapping the backend touches
   only `src/infrastructure`.
3. **Containers read the store; presentational components receive plain props**
   and have no side effects.

### Stale-refresh safety

Usage refreshes are async and can overlap with disconnects, imports, deletes,
or a newer refresh. The store carries a **monotonic generation token**: any
result whose generation is no longer current is discarded and returns
`ok: false`, so a slow response can never resurrect a disconnected provider or
overwrite fresher data. This behavior is covered by the store tests.

---

## Privacy

- Everything runs locally. There is no IA Hub server and no telemetry.
- You authenticate directly with each provider in a real browser window; IA Hub
  never receives or stores your password.
- Session state lives in Electron's own session storage and your local
  `localStorage`. Export/import is a plain JSON file you control.

---

## Testing

Vitest + React Testing Library, tests colocated with the code they cover:
the store's fetch/generation logic, the repository, the pure usage-presentation
mapping, the Modal, and the Dashboard.

```bash
npm test
```

---

## Tech stack

| Concern | Choice |
|---|---|
| Desktop shell | Electron |
| Build | Vite + `vite-plugin-electron` |
| Language | TypeScript, `strict` |
| UI | React 19, hand-built components |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| State | Zustand |
| Persistence | `localStorage` behind a repository port |
| Dates | date-fns |
| Tests | Vitest + React Testing Library |
| Lint | oxlint |

No component library — every component is hand-built with Tailwind.
