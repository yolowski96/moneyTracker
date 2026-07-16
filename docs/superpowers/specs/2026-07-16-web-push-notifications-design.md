# Web Push Notifications — Design

**Date:** 2026-07-16
**Status:** Approved

## Goal

When a new uncategorized transaction arrives via `POST /api/transactions` (the
iOS Shortcut path) and lands in the inbox, the user receives a push
notification on every device where they enabled notifications — including
iPhones with the PWA installed on the Home Screen (iOS 16.4+).

## Scope

- Push trigger: **only** API-created transactions with `category === null`
  (i.e. exactly the rows that appear in the inbox and light up the bell).
  Recurring-rule transactions are excluded — they are generated while the user
  is actively using the app.
- Opt-in UI: a "Notifications" card on the Settings page. iOS requires the
  permission prompt to come from a user gesture, so a button is mandatory.
- Standard Web Push (VAPID) via the `web-push` npm package. No third-party
  push service.

## Architecture

### Data model (Prisma)

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())

  @@index([userId])
}
```

One row per device/browser subscription. `endpoint` is globally unique per the
Push API spec. Migration name: `push_subscriptions`.

### Environment variables

| Var | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | client + server | `applicationServerKey` for `pushManager.subscribe` |
| `VAPID_PRIVATE_KEY` | server only | signing push requests |
| `VAPID_SUBJECT` | server only | `mailto:` contact required by VAPID |

Generated once with `npx web-push generate-vapid-keys`. Must be set in
production (Vercel) env; keys in `.env` locally.

### Server: `lib/push.ts`

- Lazy-configures `web-push` with VAPID details (module-level, guarded so
  missing env degrades to a logged no-op instead of a crash).
- `sendPushToUser(userId, payload: { title, body, url })`:
  - loads all subscriptions for the user,
  - `webpush.sendNotification` to each, JSON payload,
  - on `410 Gone` / `404` deletes the dead subscription row,
  - logs successes/failures via existing `lib/log.ts` conventions
    (scope `push.send`).
- Never throws to callers.

### Trigger: `app/api/transactions/route.ts`

After a successful create in `POST`, when `transaction.category === null`:

```ts
after(() => sendPushToUser(userId, payload));
```

`after()` from `next/server` runs post-response — no latency added to the
Shortcut call. Notification text is localized with the user's `Settings.locale`
via `lib/i18n.ts`: title e.g. "Нова транзакция" / "New transaction", body
`"{merchant} — {formatted amount}"` using `formatAmount` from `lib/format.ts`.
`url: "/inbox"`.

### Service worker: `public/sw.js`

Add two handlers to the existing minimal worker (keep the no-fetch-handler
design):

- `push`: parse JSON payload, `self.registration.showNotification(title,
  { body, icon: "/icon-192.png", badge: "/icon-192.png", tag: "inbox",
  data: { url } })`. `tag: "inbox"` collapses multiple pending notifications
  into one.
- `notificationclick`: close notification, focus an existing app window and
  navigate it to `data.url`, else `clients.openWindow(data.url)`.

### Server actions: `app/settings/push-actions.ts`

- `subscribePush({ endpoint, p256dh, auth })` — `requireUserId()`, upsert by
  endpoint (re-subscribing an endpoint reassigns/refreshes it).
- `unsubscribePush(endpoint)` — `requireUserId()`, delete where endpoint AND
  userId match.

### Client: `app/settings/notifications-card.tsx`

Client component following the existing Settings card look
(`api-key-card.tsx` as style reference). States:

1. **Unsupported** (no `serviceWorker`/`PushManager`/`Notification` in
   browser, or iOS Safari not installed to Home Screen): muted hint text —
   on iOS instruct to add to Home Screen first.
2. **Off**: "Enable" button → `Notification.requestPermission()` →
   `registration.pushManager.subscribe({ userVisibleOnly: true,
   applicationServerKey: <VAPID public key> })` → `subscribePush` action.
3. **On** (existing subscription found on mount): "Disable" button →
   `subscription.unsubscribe()` + `unsubscribePush` action.
4. **Denied** (`Notification.permission === "denied"`): hint to re-allow in
   OS/browser settings.

The VAPID public key reaches the client as a prop from the Settings page
(server component reads env), avoiding reliance on build-time inlining.
Base64url→Uint8Array conversion helper included. New i18n strings (en + bg) in
`lib/i18n.ts`.

Note: the service worker registers in production builds only
(`sw-register.tsx`). The card needs `navigator.serviceWorker.ready`; in dev it
shows the unsupported state. End-to-end testing happens on the deployed app.

## Error handling

- Missing VAPID env: `lib/push.ts` logs once and no-ops; subscribe card hides
  Enable button if public key prop is empty.
- Push endpoint dead (device wiped, permission revoked): delete row on
  410/404, log others, keep sending to remaining devices.
- `after()` callback failures: caught and logged inside `sendPushToUser`;
  never affect the API response.

## Testing

- `npx tsc --noEmit` + `npm run lint` clean.
- Manual (user, on deployed app): install PWA on iPhone Home Screen → Settings
  → Enable notifications → accept prompt → POST a transaction without category
  via API → notification arrives; tap opens `/inbox`. Disable → no further
  notifications.

## Out of scope (YAGNI)

- Push for recurring-rule transactions, goals, budgets.
- Notification preferences beyond on/off.
- Offline caching / richer service worker.
- Badging API unread counts.
