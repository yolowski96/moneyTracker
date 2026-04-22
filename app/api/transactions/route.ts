import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAuthorized } from "@/lib/auth";
import { toCents } from "@/lib/money";
import { TAG_TRANSACTIONS } from "@/lib/cache-tags";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100), 500);
  const transactions = await prisma.transaction.findMany({
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ transactions });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { amount, merchant } = body;
  if (amount === undefined || amount === null || merchant === undefined || merchant === null) {
    return NextResponse.json({ error: "amount and merchant are required" }, { status: 400 });
  }

  let cents: number;
  try {
    cents = toCents(amount as number | string);
  } catch {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const occurredAt = body.occurredAt ? new Date(body.occurredAt as string) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: "Invalid occurredAt" }, { status: 400 });
  }

  const transaction = await prisma.transaction.create({
    data: {
      amount: cents,
      currency: (body.currency as string) ?? "EUR",
      merchant: String(merchant).trim(),
      category: body.category ? String(body.category).trim() : null,
      note: body.note ? String(body.note).trim() : null,
      source: (body.source as string) ?? "manual",
      occurredAt,
    },
  });

  revalidateTag(TAG_TRANSACTIONS, "max");
  return NextResponse.json({ transaction }, { status: 201 });
}
