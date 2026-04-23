import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAuthorized } from "@/lib/auth";
import { TAG_TRANSACTIONS } from "@/lib/cache-tags";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const SCOPE = "api.transactions.:id.DELETE";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const started = Date.now();

  if (!(await isAuthorized(req))) {
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
    await prisma.transaction.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      log(SCOPE, 404, "not_found", `no transaction with id=${id}`, { id });
      return NextResponse.json({ error: "Not found", code: "not_found", id }, { status: 404 });
    }
    log(SCOPE, 500, "db_error", "transaction delete failed", {
      id,
      error: (err as Error).message,
      ms: Date.now() - started,
    });
    return NextResponse.json({ error: "Internal error", code: "db_error" }, { status: 500 });
  }

  revalidateTag(TAG_TRANSACTIONS, "max");
  log(SCOPE, 200, "deleted", `transaction ${id} deleted`, { id, ms: Date.now() - started });
  return NextResponse.json({ ok: true });
}
