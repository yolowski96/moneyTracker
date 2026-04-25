import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authUserIdFromBearer } from "@/lib/auth";
import { userTxnTag } from "@/lib/cache-tags";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const SCOPE = "api.transactions.:id.DELETE";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const started = Date.now();

  const userId = await authUserIdFromBearer(req);
  if (!userId) {
    log(SCOPE, 401, "unauthorized", "missing or invalid bearer token", {
      hasAuthHeader: !!req.headers.get("authorization"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    log(SCOPE, 400, "missing_id", "path param :id is empty");
    return NextResponse.json({ error: "id is required", code: "missing_id" }, { status: 400 });
  }

  try {
    const result = await prisma.transaction.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) {
      log(SCOPE, 404, "not_found", `no transaction with id=${id} for user`, { id, userId });
      return NextResponse.json({ error: "Not found", code: "not_found", id }, { status: 404 });
    }
  } catch (err) {
    log(SCOPE, 500, "db_error", "transaction delete failed", {
      id,
      userId,
      error: (err as Error).message,
      ms: Date.now() - started,
    });
    return NextResponse.json({ error: "Internal error", code: "db_error" }, { status: 500 });
  }

  revalidateTag(userTxnTag(userId), "max");
  log(SCOPE, 200, "deleted", `transaction ${id} deleted`, { id, userId, ms: Date.now() - started });
  return NextResponse.json({ ok: true });
}
