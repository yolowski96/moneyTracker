import { NextRequest } from "next/server";
import { timingSafeEqual, randomBytes } from "crypto";
import { prisma } from "./prisma";

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

// Authorizes against the Settings.apiToken first, then falls back to the
// env API_TOKEN for backward compatibility with existing Shortcuts.
export async function isAuthorized(req: NextRequest): Promise<boolean> {
  const presented = bearer(req);
  if (!presented) return false;

  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { apiToken: true },
  });
  if (settings?.apiToken && safeEqual(presented, settings.apiToken)) {
    return true;
  }

  const envToken = process.env.API_TOKEN;
  if (envToken && safeEqual(presented, envToken)) return true;

  return false;
}

export function generateApiToken(): string {
  // 32 bytes -> 43 chars base64url. Plenty of entropy, URL-safe.
  return randomBytes(32).toString("base64url");
}
