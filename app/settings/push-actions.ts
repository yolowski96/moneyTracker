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
