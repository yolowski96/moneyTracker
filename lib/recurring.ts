import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { userRecurringTag } from "./cache-tags";
import { log } from "./log";

export type RecurringRuleView = {
  id: string;
  amount: number; // cents
  currency: string;
  merchant: string;
  category: string | null;
  note: string | null;
  dayOfMonth: number;
  active: boolean;
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Due date for a given year/month: dayOfMonth clamped to the month's length,
// at local midnight. Months may be out of range — the Date constructor wraps
// them into the right year.
export function monthDueDate(year: number, month: number, dayOfMonth: number): Date {
  const dim = daysInMonth(year, month);
  return new Date(year, month, Math.min(dayOfMonth, dim), 0, 0, 0, 0);
}

// First occurrence of dayOfMonth on or after `from`. A rule created on its own
// due day is due that same day (fires on the next page load).
export function firstRunAt(dayOfMonth: number, from = new Date()): Date {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const candidate = monthDueDate(start.getFullYear(), start.getMonth(), dayOfMonth);
  if (candidate >= start) return candidate;
  return monthDueDate(start.getFullYear(), start.getMonth() + 1, dayOfMonth);
}

// All occurrences from `nextRunAt` (inclusive) through `now`, plus the first
// occurrence strictly after `now`. Each month re-derives from dayOfMonth, so
// "day 31" lands on Feb 28 / Apr 30 / May 31 rather than sticking to the
// previously clamped day.
export function dueOccurrences(
  dayOfMonth: number,
  nextRunAt: Date,
  now = new Date(),
): { due: Date[]; next: Date } {
  const due: Date[] = [];
  let d = new Date(nextRunAt);
  // Hard cap of 100 years of catch-up guards against corrupt nextRunAt values.
  for (let i = 0; d <= now && i < 1200; i++) {
    due.push(d);
    d = monthDueDate(d.getFullYear(), d.getMonth() + 1, dayOfMonth);
  }
  return { due, next: d };
}

// Lazy catch-up materializer. Inserts one transaction per missed occurrence of
// every due rule and advances the rule's cursor. Safe to call concurrently:
// the conditional updateMany lets exactly one caller claim a rule, so
// simultaneous page loads (or strict-mode double effects) can't double-insert.
// Returns the number of transactions inserted.
export async function materializeDueRules(userId: string): Promise<number> {
  const now = new Date();
  let inserted = 0;
  try {
    const rules = await prisma.recurringRule.findMany({
      where: { userId, active: true, nextRunAt: { lte: now } },
    });
    for (const rule of rules) {
      const { due, next } = dueOccurrences(rule.dayOfMonth, rule.nextRunAt, now);
      if (due.length === 0) continue;
      await prisma.$transaction(async (tx) => {
        const claim = await tx.recurringRule.updateMany({
          where: { id: rule.id, nextRunAt: rule.nextRunAt },
          data: { nextRunAt: next },
        });
        if (claim.count === 0) return; // another request claimed this rule
        await tx.transaction.createMany({
          data: due.map((occurredAt) => ({
            userId,
            amount: rule.amount,
            currency: rule.currency,
            merchant: rule.merchant,
            category: rule.category,
            note: rule.note,
            source: "recurring",
            occurredAt,
          })),
        });
        inserted += due.length;
      });
    }
    if (inserted > 0) {
      log("recurring.materialize", 201, "inserted", `${inserted} transactions`, {
        userId,
        inserted,
        dueRules: rules.length,
      });
    }
  } catch (err) {
    // Fail open: a broken materializer must never block the page.
    log("recurring.materialize", 500, "error", (err as Error).message, { userId });
  }
  return inserted;
}

export async function getRecurringRules(userId: string): Promise<RecurringRuleView[]> {
  const fn = unstable_cache(
    async (uid: string): Promise<RecurringRuleView[]> => {
      const rows = await prisma.recurringRule.findMany({
        where: { userId: uid },
        orderBy: [{ dayOfMonth: "asc" }, { createdAt: "asc" }],
      });
      return rows.map((r) => ({
        id: r.id,
        amount: r.amount,
        currency: r.currency,
        merchant: r.merchant,
        category: r.category,
        note: r.note,
        dayOfMonth: r.dayOfMonth,
        active: r.active,
      }));
    },
    ["recurring:all:v1", userId],
    { tags: [userRecurringTag(userId)] },
  );
  return fn(userId);
}
