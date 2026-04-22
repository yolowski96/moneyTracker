# EuroTrack

A minimal, Notion-styled money tracker you run yourself. SQLite + Next.js. Quick-add on the web, or POST from an iOS Shortcut after an Apple Wallet purchase.

## Stack

- Next.js 16 (App Router) + Tailwind v4
- **Supabase Postgres** via Prisma
- Server Actions for the web form
- Bearer-token-protected JSON API for Shortcuts

## Setup

### 1. Create a Supabase project

1. [supabase.com](https://supabase.com/) → New Project (any region close to you).
2. Once provisioned: **Project Settings → Database → Connection string**. Copy **both**:
   - **Transaction pooler** (port `6543`) — use as `DATABASE_URL`. Append `?pgbouncer=true&connection_limit=1`.
   - **Session / direct** (port `5432`) — use as `DIRECT_URL`. Prisma uses this for migrations only.

### 2. Configure env

```bash
cp .env.example .env
```

Fill in `DATABASE_URL`, `DIRECT_URL`, and a long random `API_TOKEN`.

### 3. Run migrations + dev server

```bash
npx prisma migrate dev --name init    # creates the tables in Supabase
npm run dev
```

Open http://localhost:3000.

> **Heads up:** the pooler URL (port 6543) is the one the app uses at runtime — it's pgBouncer in transaction mode, which is safe for serverless and for many concurrent requests. The direct URL (5432) is only used by `prisma migrate`. Never ship the direct URL into serverless runtime code — it will exhaust Postgres connection slots.

## API

All endpoints require `Authorization: Bearer $API_TOKEN`.

### `POST /api/transactions`

```json
{
  "amount": 12.50,
  "merchant": "Rosa Cafe",
  "category": "coffee",
  "note": "optional",
  "currency": "EUR",
  "occurredAt": "2026-04-21T09:14:00Z",
  "source": "shortcut"
}
```

Only `amount` and `merchant` are required. `amount` is in major units (euros, not cents) and gets stored as integer cents.

### `GET /api/transactions?limit=100`

Returns the most recent transactions.

### `DELETE /api/transactions/:id`

## iOS Shortcut

There's no public API for Apple Wallet transactions on third-party cards — Apple keeps that data sandboxed. These are the realistic capture flows:

> **Inbox flow:** transactions posted without a `category` land in `/inbox` as "unprocessed". Tap a category chip in the inbox to file them. The homepage shows a red badge with the pending count, so a glance tells you what's waiting.

### Option A — Manual quick-add (works with any card)

1. **Shortcuts app → New Shortcut.**
2. Add: **Ask for Input** → Number → "Amount?"
3. Add: **Ask for Input** → Text → "Merchant?"
4. *(Optional — you can skip this and categorize in the app Inbox later.)*
5. Add: **Dictionary** →
   - `amount` → *Provided Input* (step 2)
   - `merchant` → *Provided Input* (step 3)
   - `source` → `shortcut`
6. Add: **Get Contents of URL**
   - URL: `https://YOUR_HOST/api/transactions`
   - Method: `POST`
   - Headers: `Authorization` → `Bearer YOUR_API_TOKEN`, `Content-Type` → `application/json`
   - Request Body: JSON → the dictionary from step 5
7. Rename to "Log Expense". Add to Home Screen, Siri, or Back Tap.

Trigger with: "Hey Siri, log expense."

### Option B — Apple Card auto-trigger

If you have an Apple Card or Apple Cash:

1. **Shortcuts → Automation → New Personal Automation → Card Is Used.**
2. Pick the card.
3. Action: run the "Log Expense" shortcut (the Wallet automation gives you the amount as a magic variable — pre-fill it).
4. Set "Run Immediately" so it doesn't prompt.

For third-party cards in Wallet, Apple doesn't expose a transaction trigger. Use Option A via Back Tap or Siri.

### Option C — Bank sync (future)

If you want fully automatic sync, add a GoCardless Bank Account Data integration (free in the EU, covers ~2,400 banks under PSD2). Not included here — it's a separate piece of work.

## Data model

```prisma
model Transaction {
  id         String   @id @default(cuid())
  amount     Int       // cents
  currency   String   @default("EUR")
  merchant   String
  category   String?
  note       String?
  source     String   @default("manual")  // manual | web | shortcut | bank
  occurredAt DateTime @default(now())
  createdAt  DateTime @default(now())
}
```

## Notion mirror (optional, later)

Ship transactions to a Notion database nightly for browsing/filtering there. Source of truth stays in SQLite — Notion's API is rate-limited and slow for the write path.
