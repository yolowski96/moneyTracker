import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authUserIdFromBearer } from "@/lib/auth";
import { toCents } from "@/lib/money";
import { userTxnTag } from "@/lib/cache-tags";
import { log } from "@/lib/log";
import { getSettings } from "@/lib/cycle";

export const dynamic = "force-dynamic";

const SCOPE_GET = "api.transactions.GET";
const SCOPE_POST = "api.transactions.POST";

type FailCode =
  | "invalid_json"
  | "missing_amount"
  | "missing_merchant"
  | "invalid_amount"
  | "invalid_occurred_at"
  | "empty_merchant";

function fail(
  req: NextRequest,
  code: FailCode,
  message: string,
  detail?: Record<string, unknown>,
) {
  log(SCOPE_POST, 400, code, message, {
    ua: req.headers.get("user-agent") ?? null,
    contentType: req.headers.get("content-type") ?? null,
    ...detail,
  });
  return NextResponse.json({ error: message, code, ...detail }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const started = Date.now();
  const userId = await authUserIdFromBearer(req);
  if (!userId) {
    log(SCOPE_GET, 401, "unauthorized", "missing or invalid bearer token", {
      hasAuthHeader: !!req.headers.get("authorization"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100), 500);

  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
    log(SCOPE_GET, 200, "ok", `returned ${transactions.length} transactions`, {
      userId,
      limit,
      ms: Date.now() - started,
    });
    return NextResponse.json({ transactions });
  } catch (err) {
    log(SCOPE_GET, 500, "db_error", "transaction list query failed", {
      userId,
      error: (err as Error).message,
      ms: Date.now() - started,
    });
    return NextResponse.json({ error: "Internal error", code: "db_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const started = Date.now();

  const userId = await authUserIdFromBearer(req);
  if (!userId) {
    log(SCOPE_POST, 401, "unauthorized", "missing or invalid bearer token", {
      hasAuthHeader: !!req.headers.get("authorization"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.text();
  let body: Record<string, unknown>;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch (err) {
    return fail(req, "invalid_json", "Invalid JSON body", {
      parseError: (err as Error).message,
      rawPreview: raw.slice(0, 200),
    });
  }

  const receivedKeys = Object.keys(body);
  const { amount, merchant } = body;

  if (amount === undefined || amount === null || amount === "") {
    return fail(req, "missing_amount", "amount is required", { receivedKeys });
  }
  if (merchant === undefined || merchant === null) {
    return fail(req, "missing_merchant", "merchant is required", { receivedKeys });
  }

  let cents: number;
  try {
    cents = toCents(amount as number | string);
  } catch {
    return fail(req, "invalid_amount", "Invalid amount — must be a finite number", {
      amount,
      amountType: typeof amount,
    });
  }

  const merchantStr = String(merchant).trim();
  if (!merchantStr) {
    return fail(req, "empty_merchant", "merchant must not be empty", { merchant });
  }

  const occurredAt = body.occurredAt ? new Date(body.occurredAt as string) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return fail(req, "invalid_occurred_at", "Invalid occurredAt — expected ISO 8601 date", {
      occurredAt: body.occurredAt,
    });
  }

  const settings = await getSettings(userId);

  // Validate provided category belongs to this user; otherwise drop it.
  let categoryId: string | null = null;
  if (body.category) {
    const candidate = String(body.category).trim();
    if (candidate) {
      const cat = await prisma.category.findFirst({
        where: { id: candidate, userId },
        select: { id: true },
      });
      categoryId = cat?.id ?? null;
    }
  }

  try {
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        amount: cents,
        currency: (body.currency as string) ?? settings.currency,
        merchant: merchantStr,
        category: categoryId,
        note: body.note ? String(body.note).trim() : null,
        source: (body.source as string) ?? "manual",
        occurredAt,
      },
    });

    revalidateTag(userTxnTag(userId), "max");
    log(SCOPE_POST, 201, "created", `transaction ${transaction.id}`, {
      id: transaction.id,
      userId,
      amount: cents,
      currency: transaction.currency,
      merchant: merchantStr,
      category: transaction.category,
      source: transaction.source,
      ms: Date.now() - started,
    });
    return NextResponse.json({ transaction }, { status: 201 });
  } catch (err) {
    log(SCOPE_POST, 500, "db_error", "transaction create failed", {
      userId,
      error: (err as Error).message,
      ms: Date.now() - started,
    });
    return NextResponse.json({ error: "Internal error", code: "db_error" }, { status: 500 });
  }
}
