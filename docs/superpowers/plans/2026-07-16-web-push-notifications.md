# Web Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push a notification to every subscribed device (incl. iOS Home Screen PWA) when a new uncategorized transaction arrives via `POST /api/transactions`.

**Architecture:** Standard Web Push (VAPID) via the `web-push` package. Subscriptions stored per device in Postgres. Send happens post-response with Next's `after()`. Opt-in via a Settings card; the existing minimal service worker gains `push`/`notificationclick` handlers.

**Tech Stack:** Next.js 16 (App Router, server actions, `after()`), Prisma/Postgres, `web-push`, TypeScript, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-07-16-web-push-notifications-design.md`

**Testing note:** Repo has no unit-test harness (no test script/framework in package.json) and adding one is out of scope. Verification per task = `npx tsc --noEmit` + targeted checks; end-to-end verification is manual on the deployed app (spec §Testing).

**Commit policy (overrides the usual per-task commits):** user rule — NO commits until the user has tested. Implement everything, verify, leave working tree uncommitted.

---

### Task 1: Dependencies + VAPID keys + env

**Files:**
- Modify: `package.json` (via npm)
- Modify: `.env` (append keys; never print private key to chat)

- [ ] **Step 1: Install packages**

Run: `npm install web-push && npm install -D @types/web-push`
Expected: both added to package.json without errors.

- [ ] **Step 2: Generate VAPID keys**

Run: `npx web-push generate-vapid-keys --json`
Expected: JSON with `publicKey` and `privateKey`.

- [ ] **Step 3: Append to `.env`**

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<publicKey from step 2>
VAPID_PRIVATE_KEY=<privateKey from step 2>
VAPID_SUBJECT=mailto:goranyolovski@gmail.com
```

- [ ] **Step 4: Remind user (in final summary): add the same three vars to the production (Vercel) environment before testing.**

### Task 2: Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add relation to `User` model** (after `netWorthSnapshots NetWorthSnapshot[]`):

```prisma
  pushSubscriptions PushSubscription[]
```

- [ ] **Step 2: Add model at end of schema:**

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

- [ ] **Step 3: Migrate**

Run: `npx prisma migrate dev --name push_subscriptions`
Expected: new folder `prisma/migrations/<ts>_push_subscriptions/` and regenerated client. If the dev DB is unreachable, run `npx prisma migrate dev --create-only --name push_subscriptions` and flag it in the final summary.

### Task 3: `lib/push.ts` — server send helper

**Files:**
- Create: `lib/push.ts`

- [ ] **Step 1: Create file with full content:**

```ts
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";

// Sends Web Push notifications to every subscription a user has. Fire-and-
// forget by design: never throws, dead subscriptions (404/410) are pruned.

const SCOPE = "push.send";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    log(SCOPE, null, "not_configured", "VAPID env vars missing; push disabled");
    configured = false;
    return configured;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return configured;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return;

    const json = JSON.stringify(payload);
    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          json,
        ),
      ),
    );

    const dead: string[] = [];
    results.forEach((r, i) => {
      if (r.status !== "rejected") return;
      const statusCode = (r.reason as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        dead.push(subs[i].endpoint);
      } else {
        log(SCOPE, 500, "send_failed", (r.reason as Error)?.message ?? "unknown", {
          userId,
          statusCode: statusCode ?? null,
        });
      }
    });

    if (dead.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: dead } },
      });
    }

    const ok = results.filter((r) => r.status === "fulfilled").length;
    log(SCOPE, 200, "sent", `pushed to ${ok}/${subs.length} subscriptions`, {
      userId,
      pruned: dead.length,
    });
  } catch (err) {
    log(SCOPE, 500, "send_error", (err as Error).message, { userId });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (PushSubscription client type exists after Task 2 migrate).

### Task 4: Service worker handlers

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1: Append after the existing `activate` listener:**

```js
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Bankopolis", {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "inbox",
      data: { url: payload.url || "/inbox" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/inbox";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(url);
            return;
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
```

- [ ] **Step 2: Update the header comment** — worker is no longer "deliberately empty"; keep the no-fetch-handler rationale, add one line about push. Replacement for lines 1–4:

```js
// Minimal service worker: exists so the app qualifies as an installable PWA
// and to receive Web Push. Deliberately no fetch handler — requests go
// straight to the network with zero interception overhead, and there is no
// offline cache to invalidate on deploys.
```

### Task 5: Server actions for subscribe/unsubscribe

**Files:**
- Create: `app/settings/push-actions.ts`

- [ ] **Step 1: Create file with full content:**

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { log } from "@/lib/log";

export async function subscribePush(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const userId = await requireUserId();
  const endpoint = String(input.endpoint ?? "").trim();
  const p256dh = String(input.p256dh ?? "").trim();
  const auth = String(input.auth ?? "").trim();
  if (!endpoint || !p256dh || !auth) {
    log("action.push.subscribe", 400, "missing_input", "endpoint, p256dh, or auth missing", {
      userId,
      hasEndpoint: !!endpoint,
    });
    return;
  }
  // Upsert by endpoint: a device that re-subscribes (or switches account)
  // refreshes keys and ownership instead of erroring on the unique endpoint.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh, auth },
    create: { userId, endpoint, p256dh, auth },
  });
  log("action.push.subscribe", 200, "subscribed", "push subscription saved", { userId });
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  const userId = await requireUserId();
  const ep = String(endpoint ?? "").trim();
  if (!ep) {
    log("action.push.unsubscribe", 400, "missing_endpoint", "no endpoint given", { userId });
    return;
  }
  const result = await prisma.pushSubscription.deleteMany({
    where: { endpoint: ep, userId },
  });
  log(
    "action.push.unsubscribe",
    result.count ? 200 : 404,
    result.count ? "unsubscribed" : "not_found",
    "push subscription removed",
    { userId, count: result.count },
  );
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`, expected clean.

### Task 6: i18n strings (en + bg)

**Files:**
- Modify: `lib/i18n.ts` (insert after `portfolioApiSub` in each block — en ≈ line 279, bg ≈ line 540)

- [ ] **Step 1: en block — insert:**

```ts
    // Push notifications
    pushTitle: "Notifications",
    pushSub: "Push alerts for new inbox items",
    pushDescribe:
      "Get a notification on this device when a new transaction lands in your inbox.",
    pushEnable: "Enable on this device",
    pushDisable: "Disable",
    pushWorking: "Working",
    pushEnabled: "Enabled on this device",
    pushDisabled: "Off on this device",
    pushUnsupported:
      "Not supported in this browser. On iPhone/iPad: add the app to your Home Screen first, then enable it from there.",
    pushDenied:
      "Notifications are blocked for this app. Allow them in system settings, then try again.",
    pushNewTransactionTitle: "New transaction",
```

- [ ] **Step 2: bg block — insert:**

```ts
    // Push notifications
    pushTitle: "Известия",
    pushSub: "Push известия за нови inbox записи",
    pushDescribe:
      "Получавай известие на това устройство, когато нова транзакция влезе в inbox.",
    pushEnable: "Включи на това устройство",
    pushDisable: "Изключи",
    pushWorking: "Момент",
    pushEnabled: "Включено на това устройство",
    pushDisabled: "Изключено на това устройство",
    pushUnsupported:
      "Не се поддържа в този браузър. На iPhone/iPad: първо добави приложението на началния екран и включи оттам.",
    pushDenied:
      "Известията са блокирани за това приложение. Разреши ги в настройките на системата и опитай пак.",
    pushNewTransactionTitle: "Нова транзакция",
```

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit`, expected clean (`StringKey` picks up new keys automatically).

### Task 7: Settings card component

**Files:**
- Create: `app/settings/notifications-card.tsx`

- [ ] **Step 1: Create file with full content:**

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";

type Labels = {
  describe: string;
  enable: string;
  disable: string;
  working: string;
  enabled: string;
  disabled: string;
  unsupported: string;
  denied: string;
};

type Props = {
  vapidPublicKey: string;
  labels: Labels;
  onSubscribe: (input: { endpoint: string; p256dh: string; auth: string }) => Promise<void>;
  onUnsubscribe: (endpoint: string) => Promise<void>;
};

type Status = "loading" | "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function NotificationsCard({
  vapidPublicKey,
  labels,
  onSubscribe,
  onUnsubscribe,
}: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (
        !vapidPublicKey ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      // getRegistration (not .ready): resolves undefined instead of hanging
      // when no worker is registered (dev mode registers none).
      const reg = await navigator.serviceWorker.getRegistration();
      if (cancelled) return;
      if (!reg) {
        setStatus("unsupported");
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      if (cancelled) return;
      setStatus(sub ? "on" : "off");
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  function enable() {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          setStatus("unsupported");
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          await sub.unsubscribe();
          setStatus("off");
          return;
        }
        await onSubscribe({
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        });
        setStatus("on");
      } catch {
        setStatus("off");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await onUnsubscribe(sub.endpoint);
        }
        setStatus("off");
      } catch {
        // keep current state; user can retry
      }
    });
  }

  if (status === "loading") return null;

  if (status === "unsupported" || status === "denied") {
    return (
      <div className="text-xs text-[color:var(--muted)]">
        {status === "unsupported" ? labels.unsupported : labels.denied}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[color:var(--muted)]">{labels.describe}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={status === "on" ? disable : enable}
          disabled={isPending}
          className="rounded-md border border-[color:var(--border)] px-3 py-1.5 text-xs hover:bg-[color:var(--background)] disabled:opacity-50"
        >
          {isPending
            ? `${labels.working}…`
            : status === "on"
              ? labels.disable
              : labels.enable}
        </button>
        <span className="text-xs text-[color:var(--muted)]">
          {status === "on" ? labels.enabled : labels.disabled}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`, expected clean.

### Task 8: Wire card into Settings page

**Files:**
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: Add imports** (next to the other card imports):

```ts
import { NotificationsCard } from "./notifications-card";
import { subscribePush, unsubscribePush } from "./push-actions";
```

- [ ] **Step 2: Add a third `<details>` block in the Integrations group**, after the portfolio `</details>` (before the group's closing `</div>` at ~line 713), matching sibling markup:

```tsx
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3.5 px-5 py-4 text-sm">
            <span
              aria-hidden
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--chip)] text-[15px]"
            >
              {"\u{1F514}"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold">
                {t(locale, "pushTitle")}
              </div>
              <div className="mt-0.5 truncate text-xs text-[color:var(--muted)]">
                {t(locale, "pushSub")}
              </div>
            </div>
            <span
              aria-hidden
              className="text-[color:var(--muted-soft,var(--muted))] transition-transform group-open:rotate-90"
            >
              {"›"}
            </span>
          </summary>
          <div className="space-y-4 border-t border-[color:var(--border-soft,var(--border))] px-5 py-4">
            <NotificationsCard
              vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
              labels={{
                describe: t(locale, "pushDescribe"),
                enable: t(locale, "pushEnable"),
                disable: t(locale, "pushDisable"),
                working: t(locale, "pushWorking"),
                enabled: t(locale, "pushEnabled"),
                disabled: t(locale, "pushDisabled"),
                unsupported: t(locale, "pushUnsupported"),
                denied: t(locale, "pushDenied"),
              }}
              onSubscribe={subscribePush}
              onUnsubscribe={unsubscribePush}
            />
          </div>
        </details>
```

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit`, expected clean.

### Task 9: Push trigger in transactions API

**Files:**
- Modify: `app/api/transactions/route.ts`

- [ ] **Step 1: Extend imports:**

```ts
import { after } from "next/server";
import { sendPushToUser } from "@/lib/push";
import { isLocale, t } from "@/lib/i18n";
import { formatAmount } from "@/lib/format";
```

- [ ] **Step 2: In `POST`, after the successful `prisma.transaction.create` (right after `revalidateTag(...)`), add:**

```ts
    // Only uncategorized rows land in the inbox — push for exactly those.
    if (transaction.category === null) {
      const locale = isLocale(settings.locale) ? settings.locale : "en";
      const payload = {
        title: t(locale, "pushNewTransactionTitle"),
        body: `${merchantStr} — ${formatAmount(cents, locale, transaction.currency)}`,
        url: "/inbox",
      };
      after(() => sendPushToUser(userId, payload));
    }
```

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit`, expected clean.

### Task 10: Verification

- [ ] **Step 1:** `npx tsc --noEmit` — clean.
- [ ] **Step 2:** `npm run lint` — clean (or only pre-existing warnings).
- [ ] **Step 3:** `npm run build` — succeeds.
- [ ] **Step 4:** Report to user with manual test checklist (deployed app): set 3 VAPID vars on Vercel → deploy → iPhone: install/reinstall PWA on Home Screen → Settings → Notifications → Enable → accept prompt → `curl -X POST .../api/transactions -H "Authorization: Bearer <key>" -H "Content-Type: application/json" -d '{"amount": 12.4, "merchant": "Lidl"}'` → notification arrives; tap opens `/inbox`. NO commit until user confirms.
