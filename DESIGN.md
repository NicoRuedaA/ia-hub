# IA Hub — Design & Implementation Spec

**Status:** Approved design. This document is the single source of truth for implementation.
**Audience:** The implementing model/developer. Follow this spec exactly. If something is ambiguous, choose the simplest option consistent with the architecture rules below and document the choice in the README.

---

## 1. Purpose

A **local-first web application** to track and visualize spending on AI subscriptions (Gemini, Claude, Codex, Kimi, OpenCode, and any future ones).

All data is **entered manually** by the user. The app performs no scraping, no API calls to providers, and no log parsing.

### Goals

- Register subscriptions with price, billing cycle, and lifecycle (start / price changes / cancellation).
- Dashboard with clear answers to: *How much am I spending per month? Per year? On what? What renews soon?*
- Data persisted locally, exportable/importable as JSON.
- Runs on `localhost` with a single command (`npm run dev`), no backend server, no cloud.

### Non-goals (v1)

- No automatic usage tracking (tokens, API costs, CLI logs).
- No authentication, no multi-user.
- No deployment target; it is a local tool.
- No automatic exchange-rate fetching (rates are manual, see §6).

---

## 2. Tech stack (fixed — do not substitute)

| Concern | Choice |
|---|---|
| Build tool | Vite (latest) |
| Language | TypeScript, `strict: true` |
| UI | React 19 |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| State | Zustand |
| Persistence | `localStorage` behind a repository interface |
| Dates | `date-fns` |
| IDs | `crypto.randomUUID()` |
| Tests | Vitest + React Testing Library |

No other runtime dependencies without a documented reason. No component libraries (no MUI/shadcn/etc.) — components are hand-built with Tailwind.

---

## 3. Architecture

Layered, dependency rule points inward. The domain layer is **pure TypeScript with zero imports from React, Zustand, or the DOM**.

```
UI (React, presentational)  →  State (Zustand store, containers)  →  Domain (pure functions)
                                          ↓
                              Infrastructure (repository: localStorage)
```

Rules:

1. `src/domain/**` imports nothing outside `src/domain` (and `date-fns`).
2. All money/date calculations live in the domain layer as pure functions. **The UI never computes totals.**
3. Persistence is accessed only through the `SubscriptionRepository` interface (§6). Swapping `localStorage` for a real backend later must require changes only in `src/infrastructure`.
4. UI follows container/presentational: pages (containers) read the store and pass plain props to presentational components. Presentational components have no store access and no side effects.

### Project structure

```
src/
  domain/
    types.ts            # entities and value types
    money.ts            # currency conversion helpers
    spend.ts            # all spend calculations
    renewals.ts         # renewal-date calculations
  infrastructure/
    repository.ts       # SubscriptionRepository interface (port)
    localStorageRepository.ts
    schema.ts           # persisted shape + version + migrations
  state/
    store.ts            # Zustand store (loads via repository, exposes actions)
  ui/
    pages/              # DashboardPage, SubscriptionsPage, SettingsPage
    components/         # presentational only
    charts/             # chart components (presentational, receive computed data)
  App.tsx
  main.tsx
```

Tests live next to the code they test (`spend.test.ts` beside `spend.ts`).

---

## 4. Domain model

```ts
// domain/types.ts

export type BillingCycle = 'monthly' | 'yearly';
export type CurrencyCode = string; // ISO 4217, e.g. 'USD', 'EUR', 'ARS'

export interface PricePoint {
  amount: number;          // > 0, in `currency` units
  currency: CurrencyCode;
  effectiveFrom: string;   // ISO date 'YYYY-MM-DD'
}

export interface Subscription {
  id: string;
  provider: string;        // e.g. 'Anthropic'
  name: string;            // e.g. 'Claude Pro'
  cycle: BillingCycle;
  startDate: string;       // ISO date — first day the subscription is active/paid
  canceledAt: string | null; // ISO date — spend stops from this date on (exclusive)
  priceHistory: PricePoint[]; // sorted asc by effectiveFrom; first entry effectiveFrom === startDate
  color: string;           // hex, used consistently in all charts
  notes: string;
}

export interface Settings {
  baseCurrency: CurrencyCode;              // default 'USD'
  exchangeRates: Record<CurrencyCode, number>; // units of baseCurrency per 1 unit of key currency
}
```

Model rules:

- **Price changes** are appended to `priceHistory`, never edited in place (except fixing typos via the edit form). The effective price at date `d` is the last `PricePoint` with `effectiveFrom <= d`.
- A subscription is **active** at date `d` when `startDate <= d` and (`canceledAt` is null or `d < canceledAt`).
- `exchangeRates[baseCurrency]` is implicitly `1`. If a rate for a subscription's currency is missing, use `1` and surface a visible warning badge on the dashboard ("missing rate for X").

---

## 5. Domain calculations (`domain/spend.ts`, `domain/renewals.ts`)

All functions are pure: `(data, settings, dates) → numbers`. All monetary results are in `baseCurrency`.

### 5.1 Normalized monthly cost

`monthlyCost(sub, atDate, settings): number`

- monthly cycle → effective price converted to base currency.
- yearly cycle → effective price / 12, converted.

### 5.2 Current totals

- `totalMonthlySpend(subs, today, settings)` — sum of `monthlyCost` over subscriptions active today.
- `annualProjection = totalMonthlySpend * 12`.

### 5.3 Spend timeline

`spendByMonth(subs, fromMonth, toMonth, settings, mode): MonthlySpend[]`

```ts
interface MonthlySpend {
  month: string;                    // 'YYYY-MM'
  total: number;                    // base currency
  byProvider: Record<string, number>;
}
```

Two modes (dashboard toggle, default `amortized`):

- **`amortized`** — every active month is charged the normalized monthly cost (yearly / 12). Answers "what does this cost me per month?".
- **`cashflow`** — monthly subs charge in every active month; yearly subs charge the full yearly price only in their anniversary month (derived from `startDate`). Answers "what leaves my wallet this month?".

A subscription contributes to month `M` if it is active on the 1st of `M` (amortized) or on its billing day within `M` (cashflow). Price used is the effective price on that day.

### 5.4 Renewals

`nextRenewal(sub, today): string | null`

- null if canceled.
- Otherwise the first date `>= today` in the series `startDate + n * cycle` (months or years, via `date-fns` `addMonths`/`addYears` — these already handle month-end clamping, e.g. Jan 31 → Feb 28).

`upcomingRenewals(subs, today, horizonDays = 30)` — sorted list of `{ subscription, date, amountInBaseCurrency }`.

### 5.5 Edge cases that MUST have unit tests

1. Yearly subscription amortized vs cashflow in anniversary and non-anniversary months.
2. Price change mid-year: months before `effectiveFrom` use the old price, after use the new one.
3. Cancellation: month containing `canceledAt` — the sub contributes only if active on the charging day per §5.3; months after contribute 0.
4. Subscription starting mid-range: months before `startDate` contribute 0.
5. Missing exchange rate falls back to 1 and the calculation still returns a number.
6. Renewal date clamping (start Jan 31, monthly cycle).
7. Empty subscription list → all totals 0, timeline of zeros, no crashes.

---

## 6. Persistence (`src/infrastructure`)

```ts
// repository.ts
export interface SubscriptionRepository {
  load(): PersistedState;      // returns defaults if nothing stored
  save(state: PersistedState): void;
}

// schema.ts
export interface PersistedState {
  schemaVersion: 1;
  subscriptions: Subscription[];
  settings: Settings;
}
```

- `localStorageRepository` stores the whole state as one JSON value under key `ia-hub:v1`.
- `load()` validates the parsed JSON structurally (hand-rolled guard is fine, no zod needed); on corrupt data it returns defaults **and keeps the corrupt payload under `ia-hub:backup-corrupt`** instead of destroying it.
- `schemaVersion` exists so future versions can migrate. v1 ships with no migrations, just the version check.
- **Export:** button in Settings downloads the current `PersistedState` as `ia-hub-export-YYYY-MM-DD.json`.
- **Import:** file picker in Settings; validates, then **replaces** the whole state after an explicit confirmation dialog.

The Zustand store loads once on startup and calls `repository.save()` after every mutation (persist-on-write, no debouncing needed at this scale).

---

## 7. UI specification

Three routes (client-side, no router library needed — a simple tab/nav state in the store or `useState` in `App` is acceptable):

### 7.1 Dashboard (default view)

Top → bottom:

1. **Stat tiles** (4, single row, wrap on small screens):
   - Monthly spend (amortized, base currency)
   - Annual projection
   - Active subscriptions (count)
   - Next renewal (name + date + amount)
2. **Spend over time** — stacked bar chart, last 12 months, one segment per subscription (its `color`), with the amortized/cashflow toggle. Tooltip shows per-subscription breakdown and month total.
3. **Spend share** — donut chart of current monthly spend by subscription, legend with name + amount + percentage.
4. **Upcoming renewals (30 days)** — compact table: name, date, days left, amount. Empty state: "No renewals in the next 30 days."

If there are zero subscriptions, the dashboard shows a single empty state with a call-to-action button to add the first subscription.

### 7.2 Subscriptions

- Table of all subscriptions: color dot, name, provider, cycle, current price (original currency + converted), status (Active / Canceled), start date, next renewal.
- Actions per row: **Edit**, **Change price**, **Cancel** (sets `canceledAt`, confirmation required), **Delete** (hard delete, confirmation required, warns it removes history).
- **Add subscription** button → form (modal or inline panel):
  - Fields: name*, provider*, price* (amount + currency), cycle*, start date* (default today), color (default from palette below), notes.
  - Creates the subscription with a single `PricePoint` at `startDate`.
- **Change price** → small form: new amount (+currency) and `effectiveFrom` (default today). Appends to `priceHistory`. Show the price history read-only inside the edit view.

Client-side validation: required fields, amount > 0, `effectiveFrom >= startDate`, `canceledAt >= startDate`. Show inline error messages; never save invalid state.

### 7.3 Settings

- Base currency selector (text input with common suggestions: USD, EUR, ARS).
- Exchange-rate table: one row per currency present in any subscription that differs from base; editable numeric rate ("1 EUR = ___ USD").
- Export / Import (see §6).
- Danger zone: "Delete all data" with a type-to-confirm dialog.

### 7.4 Visual design

- Dark theme by default (this is a developer tool); light theme optional, not required for v1.
- Layout: centered content column, `max-width` ~1100px, generous whitespace.
- Number formatting: `Intl.NumberFormat` with the base currency; two decimals.
- Default color palette for subscriptions (assigned in order at creation, user-overridable):
  `#6366f1`, `#22c55e`, `#f59e0b`, `#ef4444`, `#06b6d4`, `#a855f7`, `#ec4899`, `#84cc16`.
- Charts: no 3D, no gradients, labeled axes, currency-formatted ticks. Keep Recharts defaults except colors and tooltips.
- All UI text, labels, and messages in **English**.

---

## 8. Seed data

On first run (empty storage), offer — do not force — a "Load sample data" button in the empty state that creates these five subscriptions (prices are placeholders the user will edit; start date = first day of current month, currency USD, cycle monthly):

| Name | Provider | Price |
|---|---|---|
| Gemini AI Pro | Google | 19.99 |
| Claude Pro | Anthropic | 20.00 |
| ChatGPT Plus (Codex) | OpenAI | 20.00 |
| Kimi | Moonshot AI | 19.00 |
| OpenCode Go | OpenCode | 10.00 |

---

## 9. Testing requirements

- **Domain layer: mandatory.** Every function in §5 covered, including every edge case in §5.5. This is the core value of the app — if the numbers are wrong, the app is worthless.
- **Repository:** load/save round-trip, corrupt-data fallback, default state.
- **UI:** smoke tests only — Dashboard renders with sample data; subscription form validates required fields. No exhaustive UI testing in v1.
- `npm test` must pass and `npm run build` must succeed with zero TypeScript errors before the work is considered done.

---

## 10. Implementation plan (do in this order)

1. **Scaffold** — Vite + React + TS strict + Tailwind + Vitest configured; empty page renders.
2. **Domain** — `types.ts`, `money.ts`, `spend.ts`, `renewals.ts` **with their tests**. No UI yet.
3. **Infrastructure** — repository interface, localStorage implementation, schema guard + tests.
4. **State** — Zustand store wiring repository + actions (add/edit/changePrice/cancel/delete/settings/import/export).
5. **Subscriptions page** — table + forms + validation. At this point the app is usable.
6. **Dashboard** — stat tiles, charts, renewals table, empty states.
7. **Settings page** — currency, rates, export/import, delete all.
8. **Polish** — number/date formatting, responsive pass, README with screenshots and run instructions.

Each step ends with passing tests and a conventional commit (`feat: …`, `test: …`). Do not start a step before the previous one compiles and its tests pass.

## 11. Acceptance criteria

- [ ] I can add, edit, cancel, and delete a subscription with validation.
- [ ] I can record a price change and the timeline reflects old/new prices correctly per month.
- [ ] Dashboard shows correct monthly total, annual projection, 12-month stacked chart (both modes), share donut, and 30-day renewals.
- [ ] Multi-currency subscriptions convert using manual rates; missing rates warn but never crash.
- [ ] Data survives reload; export produces a JSON I can re-import on a clean profile and get identical state.
- [ ] `npm run dev` is the only command needed to use the app; `npm test` and `npm run build` pass clean.
