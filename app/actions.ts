"use server";

import { signOut } from "@/auth";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseAmount } from "@/lib/format";
import { getSettings } from "@/lib/cycle";
import { requireUserId } from "@/lib/session";
import { userTxnTag, userIncomeTag } from "@/lib/cache-tags";
import { log } from "@/lib/log";
import { materializeDueRules } from "@/lib/recurring";

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function addTransaction(formData: FormData) {
  const uid = await requireUserId();
  const amount = parseAmount(formData.get("amount"));
  const merchant = String(formData.get("merchant") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  if (!Number.isFinite(amount) || amount <= 0) {
    log("action.addTransaction", 400, "invalid_input", "rejected form submission", {
      amountRaw: formData.get("amount"),
      merchantLen: merchant.length,
      userId: uid,
    });
    return;
  }
  const settingsRow = await getSettings(uid);
  let categoryId: string | null = null;
  if (category) {
    const cat = await prisma.category.findFirst({
      where: { id: category, userId: uid },
      select: { id: true },
    });
    categoryId = cat?.id ?? null;
  }
  const row = await prisma.transaction.create({
    data: {
      userId: uid,
      amount: Math.round(amount * 100),
      currency: settingsRow.currency,
      merchant,
      category: categoryId,
      source: "web",
    },
  });
  log("action.addTransaction", 201, "created", `transaction ${row.id}`, {
    id: row.id,
    amount: row.amount,
    merchant: row.merchant,
    category: row.category,
    userId: uid,
  });
  updateTag(userTxnTag(uid));
}

export async function deleteTransaction(formData: FormData) {
  const uid = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) {
    log("action.deleteTransaction", 400, "missing_id", "no id in form");
    return;
  }
  const result = await prisma.transaction.deleteMany({
    where: { id, userId: uid },
  });
  log("action.deleteTransaction", result.count ? 200 : 404, result.count ? "deleted" : "not_owned", `transaction ${id}`, {
    id,
    userId: uid,
    count: result.count,
  });
  updateTag(userTxnTag(uid));
}

export async function runRecurring() {
  const uid = await requireUserId();
  const inserted = await materializeDueRules(uid);
  if (inserted > 0) updateTag(userTxnTag(uid));
}

export async function addIncomeEvent(formData: FormData) {
  const uid = await requireUserId();
  const amount = parseAmount(formData.get("amount"));
  const note = String(formData.get("note") ?? "").trim();
  if (!Number.isFinite(amount) || amount <= 0) {
    log("action.addIncomeEvent", 400, "invalid_amount", "rejected form submission", {
      amountRaw: formData.get("amount"),
      userId: uid,
    });
    return;
  }
  const settingsRow = await getSettings(uid);
  const row = await prisma.incomeEvent.create({
    data: {
      userId: uid,
      amount: Math.round(amount * 100),
      currency: settingsRow.currency,
      note: note || null,
    },
  });
  log("action.addIncomeEvent", 201, "created", `income event ${row.id}`, {
    id: row.id,
    amount: row.amount,
    note: row.note,
    userId: uid,
  });
  updateTag(userIncomeTag(uid));
}

export async function deleteIncomeEvent(formData: FormData) {
  const uid = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) {
    log("action.deleteIncomeEvent", 400, "missing_id", "no id in form");
    return;
  }
  const result = await prisma.incomeEvent.deleteMany({
    where: { id, userId: uid },
  });
  log("action.deleteIncomeEvent", result.count ? 200 : 404, result.count ? "deleted" : "not_owned", `income event ${id}`, {
    id,
    userId: uid,
    count: result.count,
  });
  updateTag(userIncomeTag(uid));
}
