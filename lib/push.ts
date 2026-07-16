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
