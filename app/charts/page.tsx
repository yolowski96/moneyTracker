import Link from "next/link";
import type { Transaction } from "@prisma/client";
import { formatAmount } from "@/lib/money";
import { getSettings, getCycleBounds } from "@/lib/cycle";
import { getCategory } from "@/lib/categories";
import {
  getCycleTransactions,
  getMonthTransactions,
  getTransactionsSince,
  getIncomeEventsSince,
} from "@/lib/queries";
import { log } from "@/lib/log";
import { ThemeToggle } from "../theme-toggle";

const MONTHS_OF_HISTORY = 12;

type SearchParams = { month?: string };
type PageProps = { searchParams: Promise<SearchParams> };

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthParam(raw?: string): Date | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return new Date(y, m - 1, 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function dayBuckets(start: Date, end: Date, txns: Transaction[]) {
  const days: { date: Date; total: number }[] = [];
  const cursor = new Date(start);
  while (cursor < end) {
    days.push({ date: new Date(cursor), total: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const t of txns) {
    const idx = Math.floor(
      (t.occurredAt.getTime() - start.getTime()) / 86_400_000,
    );
    if (idx >= 0 && idx < days.length) days[idx].total += t.amount;
  }
  return days;
}

function categoryBreakdown(txns: Transaction[]) {
  const byCat = new Map<string | null, number>();
  for (const t of txns) {
    byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
  }
  return [...byCat.entries()].sort((a, b) => b[1] - a[1]);
}

function topMerchants(txns: Transaction[], limit = 5) {
  const byMerchant = new Map<string, { total: number; count: number }>();
  for (const t of txns) {
    const key = t.merchant;
    const cur = byMerchant.get(key) ?? { total: 0, count: 0 };
    cur.total += t.amount;
    cur.count += 1;
    byMerchant.set(key, cur);
  }
  return [...byMerchant.entries()]
    .map(([merchant, v]) => ({ merchant, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export default async function ChartsPage({ searchParams }: PageProps) {
  const { month: monthRaw } = await searchParams;
  const monthAnchor = parseMonthParam(monthRaw);

  if (monthRaw && !monthAnchor) {
    log("page.charts", 400, "bad_month_param", `ignoring ?month=${monthRaw}`, {
      monthRaw,
    });
  }

  const settings = await getSettings();
  const cycle = getCycleBounds(settings);

  // Trend window: last N calendar months up to and including the current month.
  const now = new Date();
  const trendStart = new Date(
    now.getFullYear(),
    now.getMonth() - (MONTHS_OF_HISTORY - 1),
    1,
  );

  // Month-detail window (only used when ?month= is set and parsed cleanly).
  const monthStart = monthAnchor;
  const monthEnd = monthAnchor ? addMonths(monthAnchor, 1) : null;

  const [cycleTx, historyTx, historyIncome, monthTx] = await Promise.all([
    // Cycle view: skip this query when we're in month-detail mode.
    monthStart
      ? Promise.resolve([] as Transaction[])
      : getCycleTransactions(cycle.start.toISOString(), cycle.end.toISOString()),
    getTransactionsSince(trendStart.toISOString()),
    getIncomeEventsSince(trendStart.toISOString()),
    monthStart && monthEnd
      ? getMonthTransactions(monthStart.toISOString(), monthEnd.toISOString())
      : Promise.resolve([] as Transaction[]),
  ]);

  // ── Current-cycle / month-detail primary view ─────────────────────────
  const primary = monthStart
    ? {
        mode: "month" as const,
        anchor: monthStart,
        start: monthStart,
        end: monthEnd!,
        txns: monthTx,
        title: monthStart.toLocaleDateString("en-IE", {
          month: "long",
          year: "numeric",
        }),
      }
    : {
        mode: "cycle" as const,
        anchor: cycle.start,
        start: cycle.start,
        end: cycle.end,
        txns: cycleTx,
        title: cycle.label,
      };

  const primaryDays = dayBuckets(primary.start, primary.end, primary.txns);
  const primaryMaxDaily = Math.max(1, ...primaryDays.map((d) => d.total));
  const primaryTotal = primary.txns.reduce((s, t) => s + t.amount, 0);
  const primaryCategories = categoryBreakdown(primary.txns);
  const primaryMerchants = topMerchants(primary.txns, 5);
  const primaryDayCount = primaryDays.length || 1;
  const primaryAvgDay = Math.round(primaryTotal / primaryDayCount);

  // ── Monthly trend: spend vs income for last N months ──────────────────
  type MonthKey = string;
  const months: { key: MonthKey; label: string; date: Date }[] = [];
  for (let i = MONTHS_OF_HISTORY - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: monthKey(d),
      label: d.toLocaleDateString("en-IE", { month: "short" }),
      date: d,
    });
  }
  const monthSpend = new Map<MonthKey, number>(months.map((m) => [m.key, 0]));
  const monthTxnCount = new Map<MonthKey, number>(months.map((m) => [m.key, 0]));
  const monthExtra = new Map<MonthKey, number>(months.map((m) => [m.key, 0]));
  for (const t of historyTx) {
    const k = monthKey(t.occurredAt);
    if (monthSpend.has(k)) {
      monthSpend.set(k, (monthSpend.get(k) ?? 0) + t.amount);
      monthTxnCount.set(k, (monthTxnCount.get(k) ?? 0) + 1);
    }
  }
  for (const e of historyIncome) {
    const k = monthKey(e.occurredAt);
    if (monthExtra.has(k)) monthExtra.set(k, (monthExtra.get(k) ?? 0) + e.amount);
  }
  const monthRows = months.map((m) => ({
    ...m,
    spend: monthSpend.get(m.key) ?? 0,
    income: settings.incomeAmount + (monthExtra.get(m.key) ?? 0),
    count: monthTxnCount.get(m.key) ?? 0,
  }));
  const maxMonth = Math.max(
    1,
    ...monthRows.map((m) => Math.max(m.spend, m.income)),
  );
  const currentMonthKey = monthKey(now);
  const selectedKey = monthAnchor ? monthKey(monthAnchor) : null;

  // Previous months, newest first, excluding the current month (still in-flight).
  const historyRows = [...monthRows].reverse().filter((m) => m.key !== currentMonthKey);
  const avgPastSpend = historyRows.length
    ? Math.round(
        historyRows.reduce((s, m) => s + m.spend, 0) / historyRows.length,
      )
    : 0;

  const prevMonth = monthAnchor ? addMonths(monthAnchor, -1) : null;
  const nextMonth = monthAnchor ? addMonths(monthAnchor, 1) : null;
  const nextDisabled = nextMonth && nextMonth > now;

  log("page.charts", 200, "rendered", `mode=${primary.mode}`, {
    mode: primary.mode,
    monthRaw: monthRaw ?? null,
    cycleLabel: cycle.label,
    cycleTxns: cycleTx.length,
    historyTxns: historyTx.length,
    historyIncome: historyIncome.length,
    monthTxns: monthTx.length,
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Charts</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {primary.mode === "month"
              ? `Looking at ${primary.title}.`
              : "Where the money went."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/inbox"
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            Inbox
          </Link>
          <Link
            href="/settings"
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            Settings
          </Link>
          <Link
            href="/"
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            {"\u2190"} Back
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Month-detail navigation */}
      {primary.mode === "month" && (
        <nav className="mb-6 flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm">
          <Link
            href={`/charts?month=${monthKey(prevMonth!)}`}
            className="text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            {"\u2190"} {prevMonth!.toLocaleDateString("en-IE", { month: "short", year: "numeric" })}
          </Link>
          <Link
            href="/charts"
            className="text-xs uppercase tracking-widest text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            Back to current cycle
          </Link>
          {nextDisabled ? (
            <span className="text-[color:var(--muted)] opacity-40">
              {nextMonth!.toLocaleDateString("en-IE", { month: "short", year: "numeric" })} {"\u2192"}
            </span>
          ) : (
            <Link
              href={`/charts?month=${monthKey(nextMonth!)}`}
              className="text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              {nextMonth!.toLocaleDateString("en-IE", { month: "short", year: "numeric" })} {"\u2192"}
            </Link>
          )}
        </nav>
      )}

      {/* Daily spend — primary view */}
      <section className="mb-12 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
              Daily spend
            </div>
            <div className="mt-0.5 text-sm">{primary.title}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm tabular-nums">
              {formatAmount(primaryTotal)}
            </div>
            <div className="text-xs text-[color:var(--muted)]">
              avg {formatAmount(primaryAvgDay)}/day {"\u00B7"} {primary.txns.length} txns
            </div>
          </div>
        </div>

        {primaryTotal === 0 ? (
          <div className="py-8 text-center text-sm text-[color:var(--muted)]">
            {primary.mode === "month"
              ? "No spending recorded this month."
              : "No spending yet this cycle."}
          </div>
        ) : (
          <div className="flex h-40 items-end gap-[2px]">
            {primaryDays.map((d, i) => {
              const h = d.total === 0 ? 2 : (d.total / primaryMaxDaily) * 100;
              const isToday = d.date.toDateString() === new Date().toDateString();
              return (
                <div
                  key={i}
                  className="group relative flex-1"
                  style={{ height: "100%" }}
                  title={`${d.date.toLocaleDateString("en-IE", {
                    day: "numeric",
                    month: "short",
                  })} \u2014 ${formatAmount(d.total)}`}
                >
                  <div
                    className={
                      "absolute bottom-0 w-full rounded-sm transition " +
                      (d.total === 0
                        ? "bg-[color:var(--border)]"
                        : isToday && primary.mode === "cycle"
                          ? "bg-[color:var(--foreground)]"
                          : "bg-[color:var(--foreground)]/60 group-hover:bg-[color:var(--foreground)]")
                    }
                    style={{ height: `${h}%` }}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-2 flex justify-between text-xs text-[color:var(--muted)]">
          <span>
            {primary.start.toLocaleDateString("en-IE", {
              day: "numeric",
              month: "short",
            })}
          </span>
          <span>
            {new Date(primary.end.getTime() - 86_400_000).toLocaleDateString(
              "en-IE",
              { day: "numeric", month: "short" },
            )}
          </span>
        </div>
      </section>

      {/* Category breakdown */}
      <section className="mb-12 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <div className="mb-4 text-xs uppercase tracking-widest text-[color:var(--muted)]">
          By category {"\u00B7"} {primary.mode === "month" ? primary.title : "this cycle"}
        </div>
        {primaryCategories.length === 0 ? (
          <div className="py-4 text-sm text-[color:var(--muted)]">
            Nothing to break down yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {primaryCategories.map(([catId, total]) => {
              const cat = getCategory(catId);
              const pct = primaryTotal
                ? Math.round((total / primaryTotal) * 100)
                : 0;
              return (
                <li key={catId ?? "uncat"} className="flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0 truncate">
                    {cat ? `${cat.emoji} ${cat.label}` : "\u2014 Uncategorized"}
                  </span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--border)]">
                    <div
                      className="h-full bg-[color:var(--foreground)]/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-mono text-xs tabular-nums text-[color:var(--muted)]">
                    {pct}%
                  </span>
                  <span className="w-24 text-right font-mono text-xs tabular-nums">
                    {formatAmount(total)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Top merchants */}
      {primaryMerchants.length > 0 && (
        <section className="mb-12 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <div className="mb-4 text-xs uppercase tracking-widest text-[color:var(--muted)]">
            Top merchants {"\u00B7"} {primary.mode === "month" ? primary.title : "this cycle"}
          </div>
          <ul className="divide-y divide-[color:var(--border)]">
            {primaryMerchants.map((m) => (
              <li key={m.merchant} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0 flex-1 truncate pr-4">{m.merchant}</div>
                <div className="flex items-center gap-4">
                  <span className="text-xs tabular-nums text-[color:var(--muted)]">
                    {m.count}x
                  </span>
                  <span className="w-24 text-right font-mono tabular-nums">
                    {formatAmount(m.total)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Monthly history list */}
      <section className="mb-12 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            History {"\u00B7"} last {MONTHS_OF_HISTORY} months
          </div>
          <div className="text-xs text-[color:var(--muted)]">
            avg {formatAmount(avgPastSpend)}/mo
          </div>
        </div>

        {historyRows.every((m) => m.spend === 0 && m.count === 0) ? (
          <div className="py-4 text-sm text-[color:var(--muted)]">
            No prior months recorded yet.
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--border)]">
            {historyRows.map((m) => {
              const isSelected = m.key === selectedKey;
              const vsAvg = avgPastSpend > 0
                ? Math.round(((m.spend - avgPastSpend) / avgPastSpend) * 100)
                : 0;
              const net = m.income - m.spend;
              return (
                <li key={m.key}>
                  <Link
                    href={`/charts?month=${m.key}`}
                    className={
                      "flex items-center justify-between gap-4 py-3 text-sm transition " +
                      (isSelected
                        ? "text-[color:var(--foreground)]"
                        : "hover:text-[color:var(--foreground)]")
                    }
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="w-24 shrink-0">
                        {m.date.toLocaleDateString("en-IE", {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <div className="relative hidden h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--border)] sm:block">
                        <div
                          className="h-full bg-[color:var(--foreground)]/60"
                          style={{
                            width: `${Math.min(100, (m.spend / Math.max(1, maxMonth)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="hidden text-xs text-[color:var(--muted)] sm:inline">
                        {m.count} txns
                      </span>
                      {avgPastSpend > 0 && m.spend > 0 && (
                        <span
                          className={
                            "w-12 text-right font-mono text-xs tabular-nums " +
                            (vsAvg > 0 ? "text-red-500" : "text-emerald-500")
                          }
                        >
                          {vsAvg > 0 ? "+" : ""}
                          {vsAvg}%
                        </span>
                      )}
                      <span
                        className={
                          "w-20 text-right font-mono tabular-nums " +
                          (net < 0 ? "text-red-500" : "text-[color:var(--muted)]")
                        }
                      >
                        {net >= 0 ? "+" : ""}
                        {formatAmount(net)}
                      </span>
                      <span className="w-24 text-right font-mono tabular-nums">
                        {formatAmount(m.spend)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Monthly trend chart */}
      <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            Trend {"\u00B7"} last {MONTHS_OF_HISTORY} months
          </div>
          <div className="flex items-center gap-3 text-xs text-[color:var(--muted)]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm bg-[color:var(--foreground)]/70" />
              Spend
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/70" />
              Income
            </span>
          </div>
        </div>

        <div className="flex h-48 items-end gap-0.5 sm:gap-2">
          {monthRows.map((m) => {
            const spendH = (m.spend / maxMonth) * 100;
            const incomeH = (m.income / maxMonth) * 100;
            const isSelected = m.key === selectedKey;
            const isCurrent = m.key === currentMonthKey;
            return (
              <Link
                key={m.key}
                href={m.key === currentMonthKey ? "/charts" : `/charts?month=${m.key}`}
                className={
                  "group flex min-w-0 flex-1 flex-col items-center rounded-md px-0 py-1 transition sm:px-1 " +
                  (isSelected
                    ? "bg-[color:var(--border)]/50"
                    : "hover:bg-[color:var(--border)]/30")
                }
                title={`${m.label} \u2014 ${formatAmount(m.spend)} spend / ${formatAmount(m.income)} income`}
              >
                <div className="relative flex h-full w-full items-end justify-center gap-0.5 sm:gap-1">
                  <div
                    className="w-1/3 rounded-sm bg-[color:var(--foreground)]/70 transition group-hover:bg-[color:var(--foreground)]"
                    style={{ height: `${Math.max(spendH, 1)}%` }}
                  />
                  <div
                    className="w-1/3 rounded-sm bg-emerald-500/70 transition group-hover:bg-emerald-500"
                    style={{ height: `${Math.max(incomeH, 1)}%` }}
                  />
                </div>
                <div
                  className={
                    "mt-2 w-full truncate text-center text-[10px] sm:text-xs " +
                    (isCurrent ? "font-medium" : "text-[color:var(--muted)]")
                  }
                >
                  {m.label}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[color:var(--border)] pt-4 text-xs">
          <div>
            <div className="text-[color:var(--muted)]">Avg spend / month</div>
            <div className="mt-0.5 font-mono tabular-nums">
              {formatAmount(
                Math.round(
                  monthRows.reduce((s, m) => s + m.spend, 0) / monthRows.length,
                ),
              )}
            </div>
          </div>
          <div>
            <div className="text-[color:var(--muted)]">Avg income / month</div>
            <div className="mt-0.5 font-mono tabular-nums">
              {formatAmount(
                Math.round(
                  monthRows.reduce((s, m) => s + m.income, 0) / monthRows.length,
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-[color:var(--muted)]">
        History and trend group by calendar month regardless of your reset day.
      </p>
    </main>
  );
}
