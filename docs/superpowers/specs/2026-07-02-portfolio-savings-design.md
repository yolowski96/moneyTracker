# Portfolio & Savings Tracking — Design

Date: 2026-07-02
Status: approved (approach A — live fetch, no persisted positions)

## Goal

Track full net worth: investment positions (stocks/ETF/crypto/metals) served
by the user's own external API, plus manually managed savings accounts. At the
end of every reporting cycle the cycle's surplus (income − spending) is
automatically added to a dedicated "Cash" savings account. A pie chart shows
what share of net worth each asset holds, and a per-cycle history chart shows
net worth over time.

## Decisions (from brainstorming)

- **Positions**: fetched live from the user's external API on page load.
  Nothing persisted; on fetch failure the page falls back to the latest
  snapshot with a warning. (Approach A.)
- **Prices**: come from the API in EUR. No currency conversion.
- **Auth**: reuse the existing `User.apiToken` as the outbound Bearer token.
  Accepted risk: the inbound token leaves the app; rotating it breaks the
  portfolio API link too.
- **Cash**: one auto-managed "Cash" account per user. At each completed cycle
  the raw surplus (`Settings.incomeAmount` + income events − spending; may be
  negative) is posted to it. Additional savings accounts are manual
  (balance edited directly).
- **History**: net-worth snapshot per reporting cycle, captured lazily on
  portfolio page load (rolling upsert for the current cycle).

## External API contract (user implements)

Request: `GET <Settings.portfolioApiUrl>` with header
`Authorization: Bearer <User.apiToken>`.

Response `200`:

```json
{
  "positions": [
    {
      "ticker": "AAPL",
      "name": "Apple Inc.",
      "type": "stock",
      "quantity": 12.5,
      "avgPrice": 150.20,
      "currentPrice": 172.40
    }
  ]
}
```

- `type`: `stock | etf | crypto | metal` — optional, display only.
- `name`: optional, falls back to ticker.
- Prices are decimal EUR per unit; the app converts to cents.
- Derived in-app per position: `value = qty × current`, `cost = qty × avg`,
  `P/L = value − cost`, `P/L %`, `allocation %`.
- Non-200, invalid JSON, or a malformed shape → error banner + snapshot
  fallback. Timeout 8s.

## Data model (Prisma)

```prisma
model SavingsAccount {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  emoji     String   @default("💰")
  kind      String   @default("manual") // "cash" (auto) | "manual"
  balance   Int      @default(0)        // cents
  position  Int      @default(0)
  archived  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  entries SavingsEntry[]

  @@index([userId, archived, position])
}

model SavingsEntry {
  id         String    @id @default(cuid())
  userId     String
  accountId  String
  account    SavingsAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  amount     Int       // cents delta (+/−)
  kind       String    // "auto_surplus"
  cycleStart DateTime? // auto_surplus idempotency key
  note       String?
  occurredAt DateTime  @default(now())

  @@unique([accountId, cycleStart])
  @@index([userId, occurredAt])
}

model NetWorthSnapshot {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cycleStart  DateTime
  investments Int      // cents at capture
  cash        Int      // cents, all savings accounts at capture
  total       Int      // cents
  capturedAt  DateTime @default(now())

  @@unique([userId, cycleStart])
}
```

Plus `Settings.portfolioApiUrl String?` and the matching `User` relations.

`SavingsEntry` exists only as the idempotency ledger for auto-surplus posts
(unique on `[accountId, cycleStart]`; `NULL` cycleStart rows are unconstrained).
Manual accounts and manual corrections edit `balance` directly — no entry.

## Auto-surplus (lazy catch-up, mirrors lib/recurring.ts)

On portfolio page load, `materializeSurplus(userId, settings)`:

1. Ensure the cash account exists (`kind: "cash"`, created on first visit;
   its `createdAt` anchors the walk).
2. Walk cycles from `createdAt` to now (same walk as `lib/goals.ts`
   `cyclesSince`, capped at 120). Index 0 is in-flight — skipped.
3. For each completed cycle with no `SavingsEntry(accountId, cycleStart)`:
   surplus = `settings.incomeAmount` + income events in cycle − spending in
   cycle. Insert entry + increment balance inside one `$transaction`; the
   unique constraint makes concurrent page loads safe (P2002 → skip).
4. Fail open: errors are logged, never block the page.

## Snapshots

On every successful portfolio page load, upsert
`NetWorthSnapshot(userId, currentCycleStart)` with the live totals. History
therefore records "net worth as of the last visit within that cycle". The
history chart shows the last 12 snapshots as CSS bars (charts-page idiom).

## Page: /portfolio

Server component + inline `"use server"` actions (goals-page idiom).

1. **Summary**: total net worth, investments total with P/L (€ and %),
   savings total.
2. **Allocation pie**: static SVG donut, one slice per position plus one
   slice per savings account; legend with emoji/ticker, value, %. Fixed
   12-color palette; slices under 1% grouped into "Other".
3. **Positions table** (desktop table / mobile cards): ticker, name, qty,
   avg price, current price, value, P/L € + %, alloc %. Green/red P/L
   (`text-emerald-500` / `text-red-500`, charts idiom).
4. **Savings accounts**: list with balances; add / rename / set balance /
   delete for manual accounts. Cash account shows an "auto" badge, balance
   editable, not deletable.
5. **History**: last 12 cycle snapshots, CSS bar chart + cycle labels.
6. **Failure mode**: API unreachable/misconfigured → amber warning banner;
   investments section shows the latest snapshot value with "as of <date>",
   pie falls back to savings-only slices.
7. Not configured yet (no `portfolioApiUrl`) → setup hint linking to
   Settings.

Navigation: new `portfolio` entry in `AppPage`/`NAV` (app-header.tsx), en/bg
strings in lib/i18n.ts.

## Settings

New "Portfolio API" card on /settings: URL input + save (server action,
`updateTag(userSettingsTag)`). Reuses the API-key card's copy about the
Bearer token.

## Caching

- `userSavingsTag(userId)` — accounts + entries; invalidated by savings
  actions and materializeSurplus.
- `userNetWorthTag(userId)` — snapshots; invalidated by upsert.
- External API fetch: `cache: "no-store"` (always live).

## Out of scope

- Currency conversion, per-position transactions (buy/sell ledger),
  external price APIs, scheduled/cron capture, CSV export.

## Verification

`npx tsc --noEmit` + `npm run build` must pass. Manual user test before any
commit (per project memory). The user then implements the API side against
the contract above.
