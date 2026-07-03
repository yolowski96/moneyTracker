import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getRecentCycles, type CycleBounds, type Settings } from "./cycle";
import { firstRunAt } from "./recurring";

// Deterministic demo dataset (spec:
// docs/superpowers/specs/2026-07-02-demo-mode-design.md). Amounts are fixed
// so every derived number (budgets, goal progress, surpluses, snapshots)
// stays internally consistent; only dates are relative to "now".
//
// Invariants:
// - one full-cycle basket totals exactly 209_500 cents;
// - base income is 260_000 cents/cycle => surplus 50_500 per completed cycle
//   (+40_000 bonus in the last completed one);
// - the laptop goal (200_000, startCycle 2 cycles back) lands at ~70%.

export const DEMO_INCOME_CENTS = 260_000;
const BONUS_CENTS = 40_000;
const MANUAL_BALANCE_CENTS = 500_000;

// Sum of quantity × currentPrice below, in cents. The latest net-worth
// snapshot's `investments` must equal this so the portfolio page and the
// history chart agree.
export const DEMO_PORTFOLIO_VALUE_CENTS = 1_842_750;

export const DEMO_POSITIONS = [
  { ticker: "VWCE", name: "Vanguard FTSE All-World", type: "etf", quantity: 85, avgPrice: 105.1, currentPrice: 121.3 },
  { ticker: "IWDA", name: "iShares Core MSCI World", type: "etf", quantity: 40, avgPrice: 78.4, currentPrice: 89.2 },
  { ticker: "AAPL", name: "Apple Inc.", type: "stock", quantity: 12, avgPrice: 168.9, currentPrice: 189.5 },
  { ticker: "BTC", name: "Bitcoin", type: "crypto", quantity: 0.025, avgPrice: 58_000, currentPrice: 91_000 },
];

const CATEGORIES = [
  { key: "groceries", emoji: "🛒", label: "Groceries", budget: 40_000 },
  { key: "dining", emoji: "🍽", label: "Dining", budget: 15_000 },
  { key: "transport", emoji: "🚗", label: "Transport", budget: 10_000 },
  { key: "entertainment", emoji: "🎬", label: "Entertainment", budget: 8_000 },
  { key: "health", emoji: "💊", label: "Health", budget: null },
  { key: "shopping", emoji: "👕", label: "Shopping", budget: null },
  { key: "utilities", emoji: "🏠", label: "Utilities", budget: 20_000 },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

type TxTemplate = {
  merchant: string;
  amount: number; // cents
  day: number; // 1-28, day of the cycle
  cat: CategoryKey | null;
  recurring?: boolean; // seeded from a RecurringRule in real life
  note?: string;
};

// One full cycle of spending. Per-category sums (all in cents):
// groceries 36_000, dining 13_500, transport 9_000, entertainment 7_000,
// utilities 18_000, health 4_000, shopping 12_000, rent 110_000.
// Total: 209_500.
const BASKET: TxTemplate[] = [
  { merchant: "Rent", amount: 110_000, day: 1, cat: null, recurring: true, note: "Monthly rent" },
  { merchant: "Netflix", amount: 1_599, day: 5, cat: "entertainment", recurring: true },
  { merchant: "Lidl", amount: 5_240, day: 2, cat: "groceries" },
  { merchant: "Electrohold", amount: 8_500, day: 3, cat: "utilities" },
  { merchant: "Shell", amount: 3_500, day: 4, cat: "transport" },
  { merchant: "Kaufland", amount: 6_180, day: 5, cat: "groceries" },
  { merchant: "Happy Bar & Grill", amount: 4_200, day: 6, cat: "dining" },
  { merchant: "Sofiyska Voda", amount: 3_400, day: 7, cat: "utilities" },
  { merchant: "Billa", amount: 2_350, day: 8, cat: "groceries" },
  { merchant: "Cinema City", amount: 2_400, day: 9, cat: "entertainment" },
  { merchant: "H&M", amount: 5_990, day: 9, cat: "shopping" },
  { merchant: "Subway", amount: 1_450, day: 10, cat: "dining" },
  { merchant: "Lidl", amount: 4_890, day: 11, cat: "groceries" },
  { merchant: "EasyPay", amount: 2_000, day: 12, cat: "transport", note: "Metro card" },
  { merchant: "Pizza Lab", amount: 2_850, day: 13, cat: "dining" },
  { merchant: "Fantastico", amount: 3_760, day: 14, cat: "groceries" },
  { merchant: "A1", amount: 6_100, day: 15, cat: "utilities" },
  { merchant: "Sopharmacy", amount: 2_550, day: 16, cat: "health" },
  { merchant: "Lidl", amount: 5_420, day: 17, cat: "groceries" },
  { merchant: "Amazon", amount: 6_010, day: 18, cat: "shopping" },
  { merchant: "KFC", amount: 1_800, day: 19, cat: "dining" },
  { merchant: "Kaufland", amount: 4_570, day: 20, cat: "groceries" },
  { merchant: "Shell", amount: 3_500, day: 21, cat: "transport" },
  { merchant: "Steam", amount: 3_001, day: 22, cat: "entertainment" },
  { merchant: "Billa", amount: 1_980, day: 23, cat: "groceries" },
  { merchant: "Coffee Fix", amount: 1_200, day: 24, cat: "dining" },
  { merchant: "Sopharmacy", amount: 1_450, day: 25, cat: "health" },
  { merchant: "Lidl", amount: 1_610, day: 26, cat: "groceries" },
  { merchant: "Raffy", amount: 2_000, day: 27, cat: "dining" },
];

// Absolute date for a template day inside a cycle, clamped into the cycle.
function dateAt(c: CycleBounds, day: number): Date {
  const d = new Date(c.start);
  d.setDate(d.getDate() + day - 1);
  return d < c.end ? d : new Date(c.end.getTime() - 86_400_000);
}

// Current cycle: compress the basket's day span into the elapsed window so
// the cycle looks ~70% "lived in" no matter what today's date is.
function compressedDate(c: CycleBounds, day: number, now: Date): Date {
  const span = Math.max(0, now.getTime() - c.start.getTime());
  return new Date(c.start.getTime() + Math.floor(((day - 1) / 28) * span));
}

export async function seedDemoData(
  tx: Prisma.TransactionClient,
  userId: string,
  origin: string,
): Promise<void> {
  const now = new Date();

  const settings = await tx.settings.create({
    data: {
      userId,
      period: "month",
      monthlyResetDay: 1,
      incomeAmount: DEMO_INCOME_CENTS,
      locale: "en",
      currency: "EUR",
      portfolioApiUrl: `${origin}/api/demo/portfolio`,
    },
  });

  const settingsView: Settings = {
    id: settings.id,
    userId,
    period: "month",
    monthlyResetDay: 1,
    weeklyResetDay: 1,
    yearlyResetMonth: 1,
    yearlyResetDay: 1,
    incomeAmount: DEMO_INCOME_CENTS,
    locale: "en",
    currency: "EUR",
    portfolioApiUrl: settings.portfolioApiUrl,
  };

  // [current, c1, c2, c3] — c1..c3 are the three completed cycles we backfill.
  const cycles = getRecentCycles(settingsView, 4, now);
  const [current, ...completed] = cycles;

  const catIds = new Map<CategoryKey, string>();
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i];
    const row = await tx.category.create({
      data: { userId, label: c.label, emoji: c.emoji, budget: c.budget, position: i + 1 },
    });
    catIds.set(c.key, row.id);
  }

  const txData: Prisma.TransactionCreateManyInput[] = [];
  for (const c of completed) {
    for (const item of BASKET) {
      txData.push({
        userId,
        amount: item.amount,
        currency: "EUR",
        merchant: item.merchant,
        category: item.cat ? catIds.get(item.cat)! : null,
        note: item.note ?? null,
        source: item.recurring ? "recurring" : "manual",
        occurredAt: dateAt(c, item.day),
      });
    }
  }
  // Current cycle: recurring items only if their due date is strictly before
  // today — on the due day itself firstRunAt() returns today, the rule fires
  // on first page load, and seeding too would double-post. Manual items are
  // compressed into the elapsed window, every third one dropped (~70% of
  // budgets).
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  BASKET.forEach((item, i) => {
    if (item.recurring) {
      const due = dateAt(current, item.day);
      if (due >= startOfToday) return;
      txData.push({
        userId,
        amount: item.amount,
        currency: "EUR",
        merchant: item.merchant,
        category: item.cat ? catIds.get(item.cat)! : null,
        note: item.note ?? null,
        source: "recurring",
        occurredAt: due,
      });
      return;
    }
    if (i % 3 === 2) return;
    txData.push({
      userId,
      amount: item.amount,
      currency: "EUR",
      merchant: item.merchant,
      category: item.cat ? catIds.get(item.cat)! : null,
      note: item.note ?? null,
      source: "manual",
      occurredAt: compressedDate(current, item.day, now),
    });
  });
  await tx.transaction.createMany({ data: txData });

  // Bonus lands mid-way through the last completed cycle (c1).
  await tx.incomeEvent.create({
    data: {
      userId,
      amount: BONUS_CENTS,
      currency: "EUR",
      note: "Q2 bonus",
      occurredAt: dateAt(completed[0], 15),
    },
  });

  // Goals: achieved+archived vacation, active laptop at ~70%.
  await tx.goal.create({
    data: {
      userId,
      name: "Vacation Greece",
      emoji: "🏖",
      targetAmount: 120_000,
      startCycle: completed[2].start,
      achievedAt: completed[0].end,
      archived: true,
      createdAt: completed[2].start,
    },
  });
  await tx.goal.create({
    data: {
      userId,
      name: "New laptop",
      emoji: "💻",
      targetAmount: 200_000,
      startCycle: completed[1].start,
      createdAt: completed[1].start,
    },
  });

  // Cash account backdated to the oldest completed cycle so the real
  // materializeSurplus (called after this transaction commits) posts the
  // three historical surpluses itself — zero duplicated math here.
  await tx.savingsAccount.create({
    data: {
      userId,
      name: "Cash",
      emoji: "💶",
      kind: "cash",
      position: -1,
      createdAt: completed[2].start,
    },
  });
  await tx.savingsAccount.create({
    data: { userId, name: "Deposit", emoji: "🏦", kind: "manual", balance: MANUAL_BALANCE_CENTS, position: 1 },
  });

  await tx.recurringRule.create({
    data: {
      userId,
      amount: 110_000,
      currency: "EUR",
      merchant: "Rent",
      category: null,
      note: "Monthly rent",
      dayOfMonth: 1,
      nextRunAt: firstRunAt(1, now),
    },
  });
  await tx.recurringRule.create({
    data: {
      userId,
      amount: 1_599,
      currency: "EUR",
      merchant: "Netflix",
      category: catIds.get("entertainment")!,
      dayOfMonth: 5,
      nextRunAt: firstRunAt(5, now),
    },
  });
}

// Snapshots derive from the auto_surplus entries materializeSurplus just
// posted, so history always matches what the savings page shows. Cash during
// cycle X = manual balance + surpluses posted before X started.
export async function seedDemoSnapshots(userId: string, settings: Settings): Promise<void> {
  const cash = await prisma.savingsAccount.findFirst({ where: { userId, kind: "cash" } });
  const entries = cash
    ? await prisma.savingsEntry.findMany({
        where: { accountId: cash.id, kind: "auto_surplus", cycleStart: { not: null } },
      })
    : [];

  const cycles = getRecentCycles(settings, 3);
  for (let i = 0; i < cycles.length; i++) {
    const c = cycles[i];
    const cashAt =
      MANUAL_BALANCE_CENTS +
      entries
        .filter((e) => e.cycleStart && e.cycleStart.getTime() < c.start.getTime())
        .reduce((s, e) => s + e.amount, 0);
    const investments = DEMO_PORTFOLIO_VALUE_CENTS - i * 75_000;
    await prisma.netWorthSnapshot.upsert({
      where: { userId_cycleStart: { userId, cycleStart: c.start } },
      create: { userId, cycleStart: c.start, investments, cash: cashAt, total: investments + cashAt },
      update: { investments, cash: cashAt, total: investments + cashAt, capturedAt: new Date() },
    });
  }
}
