import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/money";
import { getSettings, getCycleBounds } from "@/lib/cycle";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { AddTransactionForm } from "./add-form";
import { AddIncomeForm } from "./add-income-form";
import { ThemeToggle } from "./theme-toggle";
import { updateTag } from "next/cache";
import { TAG_TRANSACTIONS, TAG_INCOME_EVENTS } from "@/lib/cache-tags";
import { log } from "@/lib/log";
import {
  getCycleIncomeEvents,
  getCycleTransactions,
  getPendingCount,
  getRecentTransactions,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

function groupByDay<T extends { occurredAt: Date }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = item.occurredAt.toISOString().slice(0, 10);
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return [...map.entries()];
}

function formatDayLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatCycleDate(d: Date) {
  return d.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
}

export default async function Home() {
  // Kick off everything that doesn't depend on settings in parallel with it.
  const settingsPromise = getSettings();
  const recentPromise = getRecentTransactions(200);
  const pendingPromise = getPendingCount();

  const settings = await settingsPromise;
  const cycle = getCycleBounds(settings);

  const [cycleTransactions, recentTransactions, pendingCount, cycleIncome] =
    await Promise.all([
      getCycleTransactions(cycle.start.toISOString(), cycle.end.toISOString()),
      recentPromise,
      pendingPromise,
      getCycleIncomeEvents(cycle.start.toISOString(), cycle.end.toISOString()),
    ]);

  const cycleTotal = cycleTransactions.reduce((sum, t) => sum + t.amount, 0);
  const bonusTotal = cycleIncome.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = settings.incomeAmount + bonusTotal;

  const byCategory = new Map<string | null, number>();
  for (const t of cycleTransactions) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
  }
  const categoryRows = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const grouped = groupByDay(recentTransactions);

  async function addTransaction(formData: FormData) {
    "use server";
    const amount = Number(formData.get("amount"));
    const merchant = String(formData.get("merchant") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    if (!Number.isFinite(amount) || amount <= 0 || !merchant) {
      log("action.addTransaction", 400, "invalid_input", "rejected form submission", {
        amountRaw: formData.get("amount"),
        merchantLen: merchant.length,
      });
      return;
    }
    const row = await prisma.transaction.create({
      data: {
        amount: Math.round(amount * 100),
        merchant,
        category: category || null,
        source: "web",
      },
    });
    log("action.addTransaction", 201, "created", `transaction ${row.id}`, {
      id: row.id,
      amount: row.amount,
      merchant: row.merchant,
      category: row.category,
    });
    updateTag(TAG_TRANSACTIONS);
  }

  async function deleteTransaction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) {
      log("action.deleteTransaction", 400, "missing_id", "no id in form");
      return;
    }
    await prisma.transaction.delete({ where: { id } });
    log("action.deleteTransaction", 200, "deleted", `transaction ${id}`, { id });
    updateTag(TAG_TRANSACTIONS);
  }

  async function addIncomeEvent(formData: FormData) {
    "use server";
    const amount = Number(formData.get("amount"));
    const note = String(formData.get("note") ?? "").trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      log("action.addIncomeEvent", 400, "invalid_amount", "rejected form submission", {
        amountRaw: formData.get("amount"),
      });
      return;
    }
    const row = await prisma.incomeEvent.create({
      data: {
        amount: Math.round(amount * 100),
        note: note || null,
      },
    });
    log("action.addIncomeEvent", 201, "created", `income event ${row.id}`, {
      id: row.id,
      amount: row.amount,
      note: row.note,
    });
    updateTag(TAG_INCOME_EVENTS);
  }

  async function deleteIncomeEvent(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) {
      log("action.deleteIncomeEvent", 400, "missing_id", "no id in form");
      return;
    }
    await prisma.incomeEvent.delete({ where: { id } });
    log("action.deleteIncomeEvent", 200, "deleted", `income event ${id}`, { id });
    updateTag(TAG_INCOME_EVENTS);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <header className="mb-12 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">EuroTrack</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            A minimal money tracker.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/inbox"
            className="relative text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            Inbox
            {pendingCount > 0 && (
              <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white tabular-nums">
                {pendingCount}
              </span>
            )}
          </Link>
          <Link
            href="/settings"
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            Settings
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <section className="mb-10 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <div className="flex items-baseline justify-between">
          <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            {cycle.label}
          </div>
          <div className="text-xs text-[color:var(--muted)]">
            {cycle.daysUntilReset === 0
              ? "Resets today"
              : `Resets in ${cycle.daysUntilReset}d`}
          </div>
        </div>

        {totalIncome > 0 ? (
          <>
            <div className="mt-3 flex items-baseline justify-between">
              <div>
                <div className="text-xs text-[color:var(--muted)]">
                  Remaining
                </div>
                <div
                  className={
                    "text-4xl font-medium tabular-nums " +
                    (totalIncome - cycleTotal < 0 ? "text-red-500" : "")
                  }
                >
                  {formatAmount(totalIncome - cycleTotal)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[color:var(--muted)]">
                  Income {"\u00B7"} Spent
                </div>
                <div className="font-mono text-sm tabular-nums">
                  {formatAmount(totalIncome)}{" "}
                  <span className="text-[color:var(--muted)]">
                    {"\u00B7"} {formatAmount(cycleTotal)}
                  </span>
                </div>
                {bonusTotal > 0 && (
                  <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                    {formatAmount(settings.incomeAmount)} base {"+"}{" "}
                    {formatAmount(bonusTotal)} extra
                  </div>
                )}
              </div>
            </div>

            {(() => {
              const pct = Math.min(
                100,
                Math.round((cycleTotal / totalIncome) * 100),
              );
              const over = cycleTotal > totalIncome;
              return (
                <div className="mt-4">
                  <div className="h-2 overflow-hidden rounded-full bg-[color:var(--border)]">
                    <div
                      className={
                        "h-full transition-all " +
                        (over
                          ? "bg-red-500"
                          : pct > 80
                            ? "bg-amber-500"
                            : "bg-[color:var(--foreground)]/70")
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-[color:var(--muted)]">
                    <span>
                      {pct}% used {"\u00B7"} {cycleTransactions.length} txns
                    </span>
                    <span>
                      {formatCycleDate(cycle.start)} {"\u2192"}{" "}
                      {formatCycleDate(
                        new Date(cycle.end.getTime() - 86_400_000),
                      )}
                    </span>
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <>
            <div className="mt-2 text-4xl font-medium tabular-nums">
              {formatAmount(cycleTotal)}
            </div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">
              {cycleTransactions.length} transactions {"\u00B7"}{" "}
              <Link href="/settings" className="underline">
                set your income
              </Link>{" "}
              to see what{"\u2019"}s left
            </div>
          </>
        )}

        <div className="mt-5 border-t border-[color:var(--border)] pt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
              Extra income this {settings.period}
            </div>
            <div className="font-mono text-xs tabular-nums text-[color:var(--muted)]">
              {formatAmount(bonusTotal)}
            </div>
          </div>
          {cycleIncome.length > 0 && (
            <ul className="mb-3 divide-y divide-[color:var(--border)]">
              {cycleIncome.map((e) => (
                <li
                  key={e.id}
                  className="group flex items-center justify-between py-2 text-sm"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3 pr-4">
                    <span aria-hidden className="text-base">
                      {"\u{1F4B0}"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate">
                        {e.note || "Extra income"}
                      </div>
                      <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                        {e.occurredAt.toLocaleDateString("en-IE", {
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm tabular-nums">
                      {"+"}
                      {formatAmount(e.amount, e.currency)}
                    </span>
                    <Link
                      href={`/income/edit/${e.id}`}
                      aria-label="Edit"
                      className="p-1 -m-1 text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      {"\u270E"}
                    </Link>
                    <form action={deleteIncomeEvent}>
                      <input type="hidden" name="id" value={e.id} />
                      <button
                        type="submit"
                        aria-label="Remove"
                        className="p-1 -m-1 text-[color:var(--muted)] transition hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        &times;
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <AddIncomeForm action={addIncomeEvent} />
        </div>

        {categoryRows.length > 0 && (
          <ul className="mt-5 space-y-1.5 border-t border-[color:var(--border)] pt-4">
            {categoryRows.map(([catId, total]) => {
              const cat = getCategory(catId);
              const pct = cycleTotal
                ? Math.round((total / cycleTotal) * 100)
                : 0;
              return (
                <li key={catId ?? "uncat"} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 truncate">
                    {cat ? `${cat.emoji} ${cat.label}` : "\u2014 Uncategorized"}
                  </span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--border)]">
                    <div
                      className="h-full bg-[color:var(--foreground)]/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-20 text-right font-mono text-xs tabular-nums text-[color:var(--muted)]">
                    {formatAmount(total)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AddTransactionForm action={addTransaction} />

      <section className="mt-12 space-y-8">
        {grouped.length === 0 && (
          <div className="text-sm text-[color:var(--muted)]">
            No transactions yet. Add one above, or POST to{" "}
            <code className="font-mono text-xs">/api/transactions</code>.
          </div>
        )}
        {grouped.map(([day, items]) => {
          const dayTotal = items.reduce((sum, t) => sum + t.amount, 0);
          return (
            <div key={day}>
              <div className="mb-2 flex items-baseline justify-between border-b border-[color:var(--border)] pb-2">
                <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
                  {formatDayLabel(day)}
                </div>
                <div className="font-mono text-xs tabular-nums text-[color:var(--muted)]">
                  {formatAmount(dayTotal)}
                </div>
              </div>
              <ul className="divide-y divide-[color:var(--border)]">
                {items.map((t) => {
                  const cat = getCategory(t.category);
                  return (
                    <li
                      key={t.id}
                      className="group flex items-center justify-between py-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3 pr-4">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color:var(--surface)] text-base"
                          aria-hidden
                        >
                          {cat?.emoji ?? "\u{1F4B6}"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{t.merchant}</div>
                          {(cat || t.note) && (
                            <div className="mt-0.5 truncate text-xs text-[color:var(--muted)]">
                              {[cat?.label, t.note].filter(Boolean).join(" \u00B7 ")}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm tabular-nums">
                          {formatAmount(t.amount, t.currency)}
                        </span>
                        <Link
                          href={`/edit/${t.id}`}
                          aria-label="Edit"
                          className="p-1 -m-1 text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          {"\u270E"}
                        </Link>
                        <form action={deleteTransaction}>
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            type="submit"
                            aria-label="Delete"
                            className="p-1 -m-1 text-[color:var(--muted)] transition hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            &times;
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <footer className="mt-24 border-t border-[color:var(--border)] pt-6 text-xs text-[color:var(--muted)]">
        Categories:{" "}
        {CATEGORIES.slice(0, 6)
          .map((c) => c.emoji)
          .join(" ")}
        {" \u2026 \u00B7 "}
        <Link href="/settings" className="underline">
          configure period
        </Link>
      </footer>
    </main>
  );
}
