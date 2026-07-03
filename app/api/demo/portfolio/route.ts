import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authUserIdFromBearer } from "@/lib/auth";
import { DEMO_EMAIL, demoEnabled } from "@/lib/demo";
import { DEMO_POSITIONS } from "@/lib/demo-seed";

export const dynamic = "force-dynamic";

// Static positions for the demo user's portfolio (spec:
// docs/superpowers/specs/2026-07-02-demo-mode-design.md). Served through the
// real fetchPortfolio() path: Settings.portfolioApiUrl points here and the
// demo user's apiToken is the Bearer token.
export async function GET(req: NextRequest) {
  if (!demoEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const userId = await authUserIdFromBearer(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (user?.email !== DEMO_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ positions: DEMO_POSITIONS });
}
