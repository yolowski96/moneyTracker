import { unstable_cache } from "next/cache";
import type { Transaction, IncomeEvent } from "@prisma/client";
import { prisma } from "./prisma";
import { userTxnTag, userIncomeTag } from "./cache-tags";
import { log } from "./log";

// Wrapper that logs DB round-trips (cache misses). Cache hits skip the
// callback entirely and therefore don't log — which is exactly what we
// want: loud on the slow path, silent on the fast path.
async function query<T>(
  scope: string,
  fn: () => Promise<T>,
  summarize?: (result: T) => Record<string, unknown>,
): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - started;
    log("db", 200, scope, "query ok", { ms, ...summarize?.(result) });
    return result;
  } catch (err) {
    const ms = Date.now() - started;
    log("db", 500, scope, (err as Error).message, { ms });
    throw err;
  }
}

// unstable_cache JSON-serializes its result, so Date fields round-trip as
// strings. Revive them before handing the row to callers.
type SerializedTx = Omit<Transaction, "occurredAt" | "createdAt"> & {
  occurredAt: string | Date;
  createdAt: string | Date;
};

function reviveDates(t: SerializedTx): Transaction {
  return {
    ...t,
    occurredAt: new Date(t.occurredAt),
    createdAt: new Date(t.createdAt),
  };
}

const getRecentTransactionsCached = unstable_cache(
  async (userId: string, limit: number) => {
    return query(
      "transactions.recent",
      () =>
        prisma.transaction.findMany({
          where: { userId },
          orderBy: { occurredAt: "desc" },
          take: limit,
        }),
      (rows) => ({ rows: rows.length, limit, userId }),
    );
  },
  ["transactions:recent:v2"],
  { tags: [] },
);

export async function getRecentTransactions(userId: string, limit = 200): Promise<Transaction[]> {
  const fn = unstable_cache(
    (uid: string, l: number) => getRecentTransactionsCached(uid, l),
    ["transactions:recent:v2", userId],
    { tags: [userTxnTag(userId)] },
  );
  const rows = (await fn(userId, limit)) as SerializedTx[];
  return rows.map(reviveDates);
}

export async function getPendingCount(userId: string): Promise<number> {
  const fn = unstable_cache(
    async (uid: string) => {
      return query(
        "transactions.pending_count",
        () => prisma.transaction.count({ where: { userId: uid, category: null } }),
        (n) => ({ pending: n, userId: uid }),
      );
    },
    ["transactions:pending-count:v2", userId],
    { tags: [userTxnTag(userId)] },
  );
  return fn(userId);
}

export async function getCycleTransactions(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<Transaction[]> {
  const fn = unstable_cache(
    async (uid: string, s: string, e: string) => {
      return query(
        "transactions.cycle",
        () =>
          prisma.transaction.findMany({
            where: {
              userId: uid,
              occurredAt: { gte: new Date(s), lt: new Date(e) },
            },
            orderBy: { occurredAt: "desc" },
          }),
        (rows) => ({ rows: rows.length, startIso: s, endIso: e, userId: uid }),
      );
    },
    ["transactions:cycle:v2", userId],
    { tags: [userTxnTag(userId)] },
  );
  const rows = (await fn(userId, startIso, endIso)) as SerializedTx[];
  return rows.map(reviveDates);
}

export async function getPendingTransactions(userId: string): Promise<Transaction[]> {
  const fn = unstable_cache(
    async (uid: string) => {
      return query(
        "transactions.pending_list",
        () =>
          prisma.transaction.findMany({
            where: { userId: uid, category: null },
            orderBy: { occurredAt: "desc" },
          }),
        (rows) => ({ rows: rows.length, userId: uid }),
      );
    },
    ["transactions:pending:v2", userId],
    { tags: [userTxnTag(userId)] },
  );
  const rows = (await fn(userId)) as SerializedTx[];
  return rows.map(reviveDates);
}

export async function getTransactionsSince(
  userId: string,
  sinceIso: string,
): Promise<Transaction[]> {
  const fn = unstable_cache(
    async (uid: string, since: string) => {
      return query(
        "transactions.since",
        () =>
          prisma.transaction.findMany({
            where: { userId: uid, occurredAt: { gte: new Date(since) } },
            orderBy: { occurredAt: "asc" },
          }),
        (rows) => ({ rows: rows.length, sinceIso: since, userId: uid }),
      );
    },
    ["transactions:since:v2", userId],
    { tags: [userTxnTag(userId)] },
  );
  const rows = (await fn(userId, sinceIso)) as SerializedTx[];
  return rows.map(reviveDates);
}

export async function getMonthTransactions(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<Transaction[]> {
  const fn = unstable_cache(
    async (uid: string, s: string, e: string) => {
      return query(
        "transactions.month",
        () =>
          prisma.transaction.findMany({
            where: {
              userId: uid,
              occurredAt: { gte: new Date(s), lt: new Date(e) },
            },
            orderBy: { occurredAt: "desc" },
          }),
        (rows) => ({ rows: rows.length, startIso: s, endIso: e, userId: uid }),
      );
    },
    ["transactions:month:v2", userId],
    { tags: [userTxnTag(userId)] },
  );
  const rows = (await fn(userId, startIso, endIso)) as SerializedTx[];
  return rows.map(reviveDates);
}

type SerializedIncome = Omit<IncomeEvent, "occurredAt" | "createdAt"> & {
  occurredAt: string | Date;
  createdAt: string | Date;
};

function reviveIncomeDates(e: SerializedIncome): IncomeEvent {
  return {
    ...e,
    occurredAt: new Date(e.occurredAt),
    createdAt: new Date(e.createdAt),
  };
}

export async function getIncomeEventsSince(
  userId: string,
  sinceIso: string,
): Promise<IncomeEvent[]> {
  const fn = unstable_cache(
    async (uid: string, since: string) => {
      return query(
        "income_events.since",
        () =>
          prisma.incomeEvent.findMany({
            where: { userId: uid, occurredAt: { gte: new Date(since) } },
            orderBy: { occurredAt: "asc" },
          }),
        (rows) => ({ rows: rows.length, sinceIso: since, userId: uid }),
      );
    },
    ["income-events:since:v2", userId],
    { tags: [userIncomeTag(userId)] },
  );
  const rows = (await fn(userId, sinceIso)) as SerializedIncome[];
  return rows.map(reviveIncomeDates);
}

export async function getCycleIncomeEvents(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<IncomeEvent[]> {
  const fn = unstable_cache(
    async (uid: string, s: string, e: string) => {
      return query(
        "income_events.cycle",
        () =>
          prisma.incomeEvent.findMany({
            where: {
              userId: uid,
              occurredAt: { gte: new Date(s), lt: new Date(e) },
            },
            orderBy: { occurredAt: "desc" },
          }),
        (rows) => ({ rows: rows.length, startIso: s, endIso: e, userId: uid }),
      );
    },
    ["income-events:cycle:v2", userId],
    { tags: [userIncomeTag(userId)] },
  );
  const rows = (await fn(userId, startIso, endIso)) as SerializedIncome[];
  return rows.map(reviveIncomeDates);
}
