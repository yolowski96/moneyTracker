import { NextRequest } from "next/server";
import { timingSafeEqual, randomBytes } from "crypto";
import { prisma } from "./prisma";
import { log } from "./log";

function bearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Resolves the bearer token to a userId. Used by /api/transactions so that
// webhook/Shortcut POSTs attribute the transaction to the right owner.
export async function authUserIdFromBearer(req: NextRequest): Promise<string | null> {
  const presented = bearer(req);
  if (!presented) {
    log("auth", null, "no_bearer", "no bearer token on request", {
      hasAuthHeader: !!req.headers.get("authorization"),
      path: req.nextUrl.pathname,
    });
    return null;
  }

  // apiToken is unique in the schema; a direct lookup is cheap and the
  // timing-safe comparison covers the remaining attack surface (early-exit
  // length mismatch is handled inside safeEqual).
  const user = await prisma.user.findUnique({
    where: { apiToken: presented },
    select: { id: true, apiToken: true },
  });

  if (user?.apiToken && safeEqual(presented, user.apiToken)) {
    return user.id;
  }

  log("auth", null, "bad_bearer", "presented token did not match any user", {
    path: req.nextUrl.pathname,
  });
  return null;
}

export function generateApiToken(): string {
  // 32 bytes -> 43 chars base64url. Plenty of entropy, URL-safe.
  return randomBytes(32).toString("base64url");
}
