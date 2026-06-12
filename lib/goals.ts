import { unstable_cache } from "next/cache";
import type { Goal } from "@prisma/client";
import { prisma } from "./prisma";
import { userGoalsTag } from "./cache-tags";
import { log } from "./log";
import { getCycleBounds, type CycleBounds, type Settings } from "./cycle";
import { getTransactionsSince, getIncomeEventsSince } from "./queries";

// unstable_cache JSON-serializes its result, so Date fields round-trip as
// strings. Revive them before handing the row to callers.
type SerializedGoal = Omit<
  Goal,
  "startCycle" | "achievedAt" | "createdAt" | "updatedAt"
> & {
  startCycle: string | Date;
  achievedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function reviveGoalDates(g: SerializedGoal): Goal {
  return {
    ...g,
    startCycle: new Date(g.startCycle),
    achievedAt: g.achievedAt ? new Date(g.achievedAt) : null,
    createdAt: new Date(g.createdAt),
    updatedAt: new Date(g.updatedAt),
  };
}

export async function getActiveGoal(userId: string): Promise<Goal | null> {
  const fn = unstable_cache(
    async (uid: string) => {
      const row = await prisma.goal.findFirst({
        where: { userId: uid, archived: false },
        orderBy: { createdAt: "desc" },
      });
      log("db", 200, "goals.active", "query ok", { found: !!row, userId: uid });
      return row;
    },
    ["goals:active:v1", userId],
    { tags: [userGoalsTag(userId)] },
  );
  const row = (await fn(userId)) as SerializedGoal | null;
  return row ? reviveGoalDates(row) : null;
}

export async function getArchivedGoals(userId: string): Promise<Goal[]> {
  const fn = unstable_cache(
    async (uid: string) => {
      const rows = await prisma.goal.findMany({
        where: { userId: uid, archived: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
      });
      log("db", 200, "goals.archived", "query ok", {
        rows: rows.length,
        userId: uid,
      });
      return rows;
    },
    ["goals:archived:v1", userId],
    { tags: [userGoalsTag(userId)] },
  );
  const rows = (await fn(userId)) as SerializedGoal[];
  return rows.map(reviveGoalDates);
}

export type GoalProgress = {
  saved: number; // cents; honest value, can be negative
  pct: number; // 0–100, clamped for the bar
  remaining: number; // cents, never negative
  achieved: boolean;
  etaCycles: number | null;
  etaDate: Date | null;
};

// Bounds the backwards cycle walk for very old goals (10 years of months).
const MAX_CYCLES = 120;

// Cycles from the goal's start to now, newest first. Index 0 is in-flight.
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

// Saved = base income for every cycle the goal has seen (including the
// in-flight one) + extra income − spending since the goal's start cycle.
// The same per-cycle income formula the charts use.
export async function computeGoalProgress(
  goal: Goal,
  settings: Settings,
  now = new Date(),
): Promise<GoalProgress> {
  const sinceIso = goal.startCycle.toISOString();
  const [txns, income] = await Promise.all([
    getTransactionsSince(goal.userId, sinceIso),
    getIncomeEventsSince(goal.userId, sinceIso),
  ]);
  const cycles = cyclesSince(settings, goal.startCycle, now);

  const spent = txns.reduce((sum, t) => sum + t.amount, 0);
  const bonus = income.reduce((sum, e) => sum + e.amount, 0);
  const saved = settings.incomeAmount * cycles.length + bonus - spent;

  const remaining = Math.max(0, goal.targetAmount - saved);
  const achieved = saved >= goal.targetAmount;
  const pct =
    goal.targetAmount > 0
      ? Math.min(100, Math.max(0, Math.round((saved / goal.targetAmount) * 100)))
      : 0;

  // Projection: mean savings of up to the 6 most recent completed cycles.
  let etaCycles: number | null = null;
  let etaDate: Date | null = null;
  const completed = cycles.slice(1, 7);
  if (!achieved && completed.length > 0) {
    const perCycle = completed.map((c) => {
      const s = txns
        .filter((t) => t.occurredAt >= c.start && t.occurredAt < c.end)
        .reduce((sum, t) => sum + t.amount, 0);
      const b = income
        .filter((e) => e.occurredAt >= c.start && e.occurredAt < c.end)
        .reduce((sum, e) => sum + e.amount, 0);
      return settings.incomeAmount + b - s;
    });
    const avg = perCycle.reduce((sum, n) => sum + n, 0) / perCycle.length;
    if (avg > 0) {
      etaCycles = Math.ceil(remaining / avg);
      // Approximate: future cycles assumed as long as the current one.
      const current = cycles[0];
      const cycleMs = current.end.getTime() - current.start.getTime();
      etaDate = new Date(current.end.getTime() + (etaCycles - 1) * cycleMs);
    }
  }

  return { saved, pct, remaining, achieved, etaCycles, etaDate };
}
