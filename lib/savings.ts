import { unstable_cache } from "next/cache";
import type { SavingsAccount, NetWorthSnapshot } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { userSavingsTag, userNetWorthTag } from "./cache-tags";
import { log } from "./log";
import { getCycleBounds, type CycleBounds, type Settings } from "./cycle";

// Savings accounts + the auto-surplus materializer + net-worth snapshots
// (spec: docs/superpowers/specs/2026-07-02-portfolio-savings-design.md).
//
// One "cash" account per user receives each completed cycle's surplus
// (base income + income events − spending; may be negative). Manual accounts
// are plain balances the user edits directly. SavingsEntry rows exist only
// as the idempotency ledger for auto posts — unique on [accountId, cycleStart].

export const CASH_KIND = "cash";
export const MANUAL_KIND = "manual";

// unstable_cache round-trips Dates as strings; revive before use.
type SerializedAccount = Omit<SavingsAccount, "createdAt" | "updatedAt"> & {
  createdAt: string | Date;
  updatedAt: string | Date;
};

function reviveAccountDates(a: SerializedAccount): SavingsAccount {
  return {
    ...a,
    createdAt: new Date(a.createdAt),
    updatedAt: new Date(a.updatedAt),
  };
}

type SerializedSnapshot = Omit<NetWorthSnapshot, "cycleStart" | "capturedAt"> & {
  cycleStart: string | Date;
  capturedAt: string | Date;
};

function reviveSnapshotDates(s: SerializedSnapshot): NetWorthSnapshot {
  return {
    ...s,
    cycleStart: new Date(s.cycleStart),
    capturedAt: new Date(s.capturedAt),
  };
}

// The cash account anchors the surplus walk at its createdAt; created lazily
// by the maintenance action on first portfolio visit (mutations + tag
// invalidation live in server actions, never in render — RecurringTrigger
// idiom). The stored name is a fallback — the UI renders a localized label
// for kind === "cash". Returns { row, created } so the caller knows whether
// to invalidate the savings tag.
export async function ensureCashAccount(
  userId: string,
): Promise<{ row: SavingsAccount; created: boolean }> {
  const existing = await prisma.savingsAccount.findFirst({
    where: { userId, kind: CASH_KIND },
  });
  if (existing) return { row: existing, created: false };
  const row = await prisma.savingsAccount.create({
    data: { userId, name: "Cash", emoji: "💶", kind: CASH_KIND, position: -1 },
  });
  log("savings.cash", 201, "created", `cash account ${row.id}`, { userId });
  return { row, created: true };
}

export async function getSavingsAccounts(userId: string): Promise<SavingsAccount[]> {
  const fn = unstable_cache(
    async (uid: string) => {
      return prisma.savingsAccount.findMany({
        where: { userId: uid, archived: false },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      });
    },
    ["savings:accounts:v1", userId],
    { tags: [userSavingsTag(userId)] },
  );
  const rows = (await fn(userId)) as SerializedAccount[];
  return rows.map(reviveAccountDates);
}

// Bounds the backwards cycle walk (10 years of months) — same cap as goals.
const MAX_CYCLES = 120;

// Cycles from `since` to now, newest first. Index 0 is in-flight.
function cyclesSince(settings: Settings, since: Date, now: Date): CycleBounds[] {
  const cycles: CycleBounds[] = [];
  let ref = now;
  for (let i = 0; i < MAX_CYCLES; i++) {
    const c = getCycleBounds(settings, ref);
    if (c.start.getTime() < since.getTime()) break;
    cycles.push(c);
    ref = new Date(c.start.getTime() - 1);
  }
  return cycles;
}

// Lazy catch-up: posts each completed cycle's surplus to the cash account,
// one SavingsEntry per cycle. The [accountId, cycleStart] unique constraint
// claims a cycle — concurrent page loads race on the insert and the loser
// skips (P2002), so the balance can't be bumped twice. Fail open: a broken
// materializer must never block the page. Returns the number of changes
// (entries inserted + cash account creation) so the caller knows whether to
// invalidate the savings tag. Call from a server action only.
export async function materializeSurplus(
  userId: string,
  settings: Settings,
  now = new Date(),
): Promise<number> {
  let inserted = 0;
  let changed = 0;
  try {
    const { row: cash, created } = await ensureCashAccount(userId);
    if (created) changed++;
    // The cycle containing createdAt is the first one that can complete.
    const cycles = cyclesSince(settings, cash.createdAt, now);
    const completed = cycles.slice(1); // index 0 is in-flight
    if (completed.length === 0) return changed;

    const posted = await prisma.savingsEntry.findMany({
      where: { accountId: cash.id, cycleStart: { not: null } },
      select: { cycleStart: true },
    });
    const done = new Set(posted.map((e) => e.cycleStart!.getTime()));
    const missing = completed.filter((c) => !done.has(c.start.getTime()));
    if (missing.length === 0) return changed;

    const oldest = missing[missing.length - 1];
    const newest = missing[0];
    const [txns, income] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId,
          occurredAt: { gte: oldest.start, lt: newest.end },
        },
        select: { amount: true, occurredAt: true },
      }),
      prisma.incomeEvent.findMany({
        where: {
          userId,
          occurredAt: { gte: oldest.start, lt: newest.end },
        },
        select: { amount: true, occurredAt: true },
      }),
    ]);

    for (const c of missing) {
      const spent = txns
        .filter((t) => t.occurredAt >= c.start && t.occurredAt < c.end)
        .reduce((s, t) => s + t.amount, 0);
      const bonus = income
        .filter((e) => e.occurredAt >= c.start && e.occurredAt < c.end)
        .reduce((s, e) => s + e.amount, 0);
      const surplus = settings.incomeAmount + bonus - spent;

      try {
        await prisma.$transaction(async (tx) => {
          await tx.savingsEntry.create({
            data: {
              userId,
              accountId: cash.id,
              amount: surplus,
              kind: "auto_surplus",
              cycleStart: c.start,
              occurredAt: c.end,
            },
          });
          await tx.savingsAccount.update({
            where: { id: cash.id },
            data: { balance: { increment: surplus } },
          });
        });
        inserted++;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          continue; // another request claimed this cycle
        }
        throw err;
      }
    }

    if (inserted > 0) {
      log("savings.materialize", 201, "inserted", `${inserted} surplus entries`, {
        userId,
        inserted,
      });
    }
  } catch (err) {
    log("savings.materialize", 500, "error", (err as Error).message, { userId });
  }
  return changed + inserted;
}

// Rolling per-cycle capture: every successful portfolio load overwrites the
// current cycle's snapshot, so history reads "net worth as of the last visit
// within that cycle". Call from a server action only (the caller invalidates
// the net-worth tag).
export async function upsertSnapshot(
  userId: string,
  cycleStart: Date,
  investments: number,
  cash: number,
): Promise<boolean> {
  try {
    await prisma.netWorthSnapshot.upsert({
      where: { userId_cycleStart: { userId, cycleStart } },
      create: { userId, cycleStart, investments, cash, total: investments + cash },
      update: { investments, cash, total: investments + cash, capturedAt: new Date() },
    });
    return true;
  } catch (err) {
    // Snapshot is best-effort; never block the page on it.
    log("savings.snapshot", 500, "error", (err as Error).message, { userId });
    return false;
  }
}

export async function getSnapshots(
  userId: string,
  limit = 12,
): Promise<NetWorthSnapshot[]> {
  const fn = unstable_cache(
    async (uid: string, take: number) => {
      return prisma.netWorthSnapshot.findMany({
        where: { userId: uid },
        orderBy: { cycleStart: "desc" },
        take,
      });
    },
    ["net-worth:snapshots:v1", userId],
    { tags: [userNetWorthTag(userId)] },
  );
  const rows = (await fn(userId, limit)) as SerializedSnapshot[];
  return rows.map(reviveSnapshotDates);
}
