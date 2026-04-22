import { unstable_cache } from "next/cache";
import type { Transaction, IncomeEvent } from "@prisma/client";
import { prisma } from "./prisma";
import { TAG_TRANSACTIONS, TAG_INCOME_EVENTS } from "./cache-tags";

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

// Recent transactions for the homepage list.
const getRecentTransactionsCached = unstable_cache(
  async (limit: number) => {
    return prisma.transaction.findMany({
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
  },
  ["transactions:recent:v1"],
  { tags: [TAG_TRANSACTIONS] },
);

export async function getRecentTransactions(limit = 200): Promise<Transaction[]> {
  const rows = (await getRecentTransactionsCached(limit)) as SerializedTx[];
  return rows.map(reviveDates);
}

// Count of unprocessed (categoryless) transactions for the inbox badge.
export const getPendingCount = unstable_cache(
  async () => {
    return prisma.transaction.count({ where: { category: null } });
  },
  ["transactions:pending-count:v1"],
  { tags: [TAG_TRANSACTIONS] },
);

// Transactions within a specific cycle window. Cache key encodes the bounds
// so a new cycle naturally misses the cache; mutations bust the tag.
const getCycleTransactionsCached = unstable_cache(
  async (startIso: string, endIso: string) => {
    return prisma.transaction.findMany({
      where: {
        occurredAt: { gte: new Date(startIso), lt: new Date(endIso) },
      },
      orderBy: { occurredAt: "desc" },
    });
  },
  ["transactions:cycle:v1"],
  { tags: [TAG_TRANSACTIONS] },
);

export async function getCycleTransactions(
  startIso: string,
  endIso: string,
): Promise<Transaction[]> {
  const rows = (await getCycleTransactionsCached(
    startIso,
    endIso,
  )) as SerializedTx[];
  return rows.map(reviveDates);
}

// Pending (uncategorized) list for the inbox page.
const getPendingTransactionsCached = unstable_cache(
  async () => {
    return prisma.transaction.findMany({
      where: { category: null },
      orderBy: { occurredAt: "desc" },
    });
  },
  ["transactions:pending:v1"],
  { tags: [TAG_TRANSACTIONS] },
);

export async function getPendingTransactions(): Promise<Transaction[]> {
  const rows = (await getPendingTransactionsCached()) as SerializedTx[];
  return rows.map(reviveDates);
}

// All transactions since a given ISO timestamp — used by the charts page
// for multi-cycle trend lines.
const getTransactionsSinceCached = unstable_cache(
  async (sinceIso: string) => {
    return prisma.transaction.findMany({
      where: { occurredAt: { gte: new Date(sinceIso) } },
      orderBy: { occurredAt: "asc" },
    });
  },
  ["transactions:since:v1"],
  { tags: [TAG_TRANSACTIONS] },
);

export async function getTransactionsSince(
  sinceIso: string,
): Promise<Transaction[]> {
  const rows = (await getTransactionsSinceCached(sinceIso)) as SerializedTx[];
  return rows.map(reviveDates);
}

const getIncomeEventsSinceCached = unstable_cache(
  async (sinceIso: string) => {
    return prisma.incomeEvent.findMany({
      where: { occurredAt: { gte: new Date(sinceIso) } },
      orderBy: { occurredAt: "asc" },
    });
  },
  ["income-events:since:v1"],
  { tags: [TAG_INCOME_EVENTS] },
);

export async function getIncomeEventsSince(
  sinceIso: string,
): Promise<IncomeEvent[]> {
  const rows = (await getIncomeEventsSinceCached(
    sinceIso,
  )) as SerializedIncome[];
  return rows.map(reviveIncomeDates);
}

// One-off income events (bonuses, windfalls) within a cycle window.
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

const getCycleIncomeEventsCached = unstable_cache(
  async (startIso: string, endIso: string) => {
    return prisma.incomeEvent.findMany({
      where: {
        occurredAt: { gte: new Date(startIso), lt: new Date(endIso) },
      },
      orderBy: { occurredAt: "desc" },
    });
  },
  ["income-events:cycle:v1"],
  { tags: [TAG_INCOME_EVENTS] },
);

export async function getCycleIncomeEvents(
  startIso: string,
  endIso: string,
): Promise<IncomeEvent[]> {
  const rows = (await getCycleIncomeEventsCached(
    startIso,
    endIso,
  )) as SerializedIncome[];
  return rows.map(reviveIncomeDates);
}
