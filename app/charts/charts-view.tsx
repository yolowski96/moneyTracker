import Link from "next/link";
import type { Transaction } from "@prisma/client";
import {
  formatAmount,
  formatDateShort,
  formatMonthShort,
  formatMonthShortYear,
  formatCycleRange,
} from "@/lib/format";
import {
  getSettings,
  getCycleBounds,
  getRecentCycles,
  cycleKey,
  cycleMidpoint,
} from "@/lib/cycle";
import { getAllCategories } from "@/lib/categories";
import { t, categoryLabel } from "@/lib/i18n";
import {
  getCycleTransactions,
  getMonthTransactions,
  getTransactionsSince,
  getIncomeEventsSince,
  getPendingCount,
} from "@/lib/queries";
import { log } from "@/lib/log";
import { AppHeader } from "../app-header";

const PERIODS_OF_HISTORY = 12;

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

export async function ChartsView({
  userId,
  userEmail,
  periodAnchor,
  categoryFilter,
}: {
  userId: string;
  userEmail: string | null;
  periodAnchor: Date | null;
  categoryFilter: string | null;
}) {
  const [settings, allCategories, pendingCount] = await Promise.all([
    getSettings(userId),
    getAllCategories(userId),
    getPendingCount(userId),
  ]);
  const locale = settings.locale;
  const userCurrency = settings.currency;
  const categoryById = new Map(allCategories.map((c) => [c.id, c]));

  // Trend/history window: the last N reporting periods (newest first).
  const now = new Date();
  const cycles = getRecentCycles(settings, PERIODS_OF_HISTORY, now);
  const cycle = cycles[0]; // current, in-flight cycle
  const windowStart = cycles[cycles.length - 1].start;

  // Period-detail window (only when drilling into a specific past cycle).
  const anchorCycle = periodAnchor ? getCycleBounds(settings, periodAnchor) : null;

  const [cycleTx, historyTx, historyIncome, periodTx] = await Promise.all([
    // Current-cycle view: skip this query when we're in period-detail mode.
    anchorCycle
      ? Promise.resolve([] as Transaction[])
      : getCycleTransactions(userId, cycle.start.toISOString(), cycle.end.toISOString()),
    getTransactionsSince(userId, windowStart.toISOString()),
    getIncomeEventsSince(userId, windowStart.toISOString()),
    anchorCycle
      ? getMonthTransactions(userId, anchorCycle.start.toISOString(), anchorCycle.end.toISOString())
      : Promise.resolve([] as Transaction[]),
  ]);

  // ── Current-cycle / period-detail primary view ────────────────────────
  const primary = anchorCycle
    ? {
        mode: "period" as const,
        start: anchorCycle.start,
        end: anchorCycle.end,
        txns: periodTx,
        title: formatCycleRange(anchorCycle.start, anchorCycle.end, locale),
      }
    : {
        mode: "cycle" as const,
        start: cycle.start,
        end: cycle.end,
        txns: cycleTx,
        title: cycle.label,
      };

  // Optional category filter — turns the primary view into a single-category
  // preview. Falls back to the unfiltered view if the id isn't a known category.
  const filterCat = categoryFilter ? categoryById.get(categoryFilter) ?? null : null;
  const viewTxns = filterCat
    ? primary.txns.filter((tx) => tx.category === filterCat.id)
    : primary.txns;
  // Path that preserves the current period, used to build category links.
  const basePath = anchorCycle ? `/charts/${cycleKey(anchorCycle.start)}` : "/charts";

  const primaryDays = dayBuckets(primary.start, primary.end, viewTxns);
  const primaryMaxDaily = Math.max(1, ...primaryDays.map((d) => d.total));
  const primaryTotal = viewTxns.reduce((s, t) => s + t.amount, 0);
  const primaryCategories = categoryBreakdown(primary.txns);
  const primaryDayCount = primaryDays.length || 1;
  const primaryAvgDay = Math.round(primaryTotal / primaryDayCount);

  // ── Per-period trend: spend vs income for the last N reporting periods ──
  // Map a date to the key of the cycle that contains it (cycles are contiguous).
  function keyForDate(date: Date): string | null {
    for (const c of cycles) {
      if (date >= c.start && date < c.end) return cycleKey(c.start);
    }
    return null;
  }

  const periodSpend = new Map<string, number>(cycles.map((c) => [cycleKey(c.start), 0]));
  const periodCount = new Map<string, number>(cycles.map((c) => [cycleKey(c.start), 0]));
  const periodExtra = new Map<string, number>(cycles.map((c) => [cycleKey(c.start), 0]));
  for (const tx of historyTx) {
    const k = keyForDate(tx.occurredAt);
    if (k !== null) {
      periodSpend.set(k, (periodSpend.get(k) ?? 0) + tx.amount);
      periodCount.set(k, (periodCount.get(k) ?? 0) + 1);
    }
  }
  for (const e of historyIncome) {
    const k = keyForDate(e.occurredAt);
    if (k !== null) periodExtra.set(k, (periodExtra.get(k) ?? 0) + e.amount);
  }

  // Newest first.
  const periodRows = cycles.map((c) => {
    const key = cycleKey(c.start);
    return {
      key,
      start: c.start,
      end: c.end,
      spend: periodSpend.get(key) ?? 0,
      income: settings.incomeAmount + (periodExtra.get(key) ?? 0),
      count: periodCount.get(key) ?? 0,
    };
  });
  const maxPeriod = Math.max(
    1,
    ...periodRows.map((m) => Math.max(m.spend, m.income)),
  );
  const currentKey = cycleKey(cycle.start);
  const selectedKey = anchorCycle ? cycleKey(anchorCycle.start) : null;

  // A period counts as "having data" if it has any transactions or any extra
  // income recorded. Base income (settings.incomeAmount) alone does NOT count —
  // it's a recurring projection, so periods the user never tracked would
  // otherwise render phantom income bars.
  const hasActivity = (m: (typeof periodRows)[number]) =>
    m.spend > 0 || m.count > 0 || m.income > settings.incomeAmount;

  // History list: completed periods only (exclude the in-flight current one),
  // and only periods we actually have data for, so empty periods don't dilute.
  const historyRows = periodRows.filter(
    (m) => m.key !== currentKey && hasActivity(m),
  );
  const avgPastSpend = historyRows.length
    ? Math.round(
        historyRows.reduce((s, m) => s + m.spend, 0) / historyRows.length,
      )
    : 0;

  // Trend chart bars run oldest → newest, left → right. Show only periods with
  // real activity (plus the current one), so empty periods don't render phantom
  // income bars for months the user wasn't tracking anything.
  const trendRows = [...periodRows]
    .reverse()
    .filter((m) => m.key === currentKey || hasActivity(m));
  const avgPeriodIncome = historyRows.length
    ? Math.round(
        historyRows.reduce((s, m) => s + m.income, 0) / historyRows.length,
      )
    : settings.incomeAmount;

  // Adjacent-cycle navigation for period-detail mode.
  const prevCycle = anchorCycle
    ? getCycleBounds(settings, new Date(anchorCycle.start.getTime() - 1))
    : null;
  const nextCycle = anchorCycle
    ? getCycleBounds(settings, anchorCycle.end)
    : null;
  const nextDisabled = !nextCycle || nextCycle.start >= cycle.start;

  log("page.charts", 200, "rendered", `mode=${primary.mode}`, {
    mode: primary.mode,
    cycleLabel: cycle.label,
    cycleTxns: cycleTx.length,
    historyTxns: historyTx.length,
    historyIncome: historyIncome.length,
    periodTxns: periodTx.length,
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <AppHeader
        current="charts"
        locale={locale}
        userEmail={userEmail}
        pendingCount={pendingCount}
        title={t(locale, "charts")}
        tagline={
          filterCat
            ? `${t(locale, "chartsLooking")} ${filterCat.emoji} ${categoryLabel(filterCat.label, locale)} · ${primary.title}.`
            : primary.mode === "period"
              ? `${t(locale, "chartsLooking")} ${primary.title}.`
              : t(locale, "chartsTagline")
        }
      />

      {/* Period-detail navigation */}
      {primary.mode === "period" && prevCycle && nextCycle && !filterCat && (
        <nav className="mb-6 flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm">
          <Link
            href={`/charts/${cycleKey(prevCycle.start)}`}
            className="text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            {"←"} {formatMonthShortYear(cycleMidpoint(prevCycle.start, prevCycle.end), locale)}
          </Link>
          <Link
            href="/charts"
            className="text-xs uppercase tracking-widest text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            {t(locale, "backToCurrentCycle")}
          </Link>
          {nextDisabled ? (
            <span className="text-[color:var(--muted)] opacity-40">
              {formatMonthShortYear(cycleMidpoint(nextCycle.start, nextCycle.end), locale)} {"→"}
            </span>
          ) : (
            <Link
              href={`/charts/${cycleKey(nextCycle.start)}`}
              className="text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              {formatMonthShortYear(cycleMidpoint(nextCycle.start, nextCycle.end), locale)} {"→"}
            </Link>
          )}
        </nav>
      )}

      {/* Category-filter banner */}
      {filterCat && (
        <nav className="mb-6 flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm">
          <span className="min-w-0 truncate font-medium">
            {filterCat.emoji} {categoryLabel(filterCat.label, locale)}
            {primary.mode === "period" && (
              <span className="text-[color:var(--muted)]"> {"·"} {primary.title}</span>
            )}
          </span>
          <Link
            href={basePath}
            className="shrink-0 text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            {"←"} {t(locale, "allCategories")}
          </Link>
        </nav>
      )}

      {/* Daily spend — primary view */}
      <section className="mb-12 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
              {t(locale, "dailySpend")}
            </div>
            <div className="mt-0.5 text-sm">{primary.title}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm tabular-nums">
              {formatAmount(primaryTotal, locale, userCurrency)}
            </div>
            <div className="text-xs text-[color:var(--muted)]">
              {t(locale, "avg")} {formatAmount(primaryAvgDay, locale, userCurrency)}{t(locale, "perDay")} {"·"} {viewTxns.length} {t(locale, "txns")}
            </div>
          </div>
        </div>

        {primaryTotal === 0 ? (
          <div className="py-8 text-center text-sm text-[color:var(--muted)]">
            {primary.mode === "period"
              ? t(locale, "noSpendingPeriod")
              : t(locale, "noSpendingCycle")}
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
                  title={`${formatDateShort(d.date, locale)} — ${formatAmount(d.total, locale, userCurrency)}`}
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
            {formatDateShort(primary.start, locale)}
          </span>
          <span>
            {formatDateShort(new Date(primary.end.getTime() - 86_400_000), locale)}
          </span>
        </div>
      </section>

      {filterCat ? (
        /* Single-category transaction list */
        <section className="mb-12 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
              {filterCat.emoji} {categoryLabel(filterCat.label, locale)}
            </div>
            <div className="font-mono text-xs tabular-nums text-[color:var(--muted)]">
              {formatAmount(primaryTotal, locale, userCurrency)}
            </div>
          </div>
          {viewTxns.length === 0 ? (
            <div className="py-4 text-sm text-[color:var(--muted)]">
              {primary.mode === "period"
                ? t(locale, "noSpendingPeriod")
                : t(locale, "noSpendingCycle")}
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--border)]">
              {viewTxns.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{tx.merchant}</div>
                    <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                      {formatDateShort(tx.occurredAt, locale)}
                      {tx.note ? ` · ${tx.note}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono tabular-nums">
                    {formatAmount(tx.amount, locale, tx.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        /* Category breakdown */
        <section className="mb-12 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <div className="mb-4 text-xs uppercase tracking-widest text-[color:var(--muted)]">
            {t(locale, "byCategory")} {"·"} {primary.mode === "period" ? primary.title : t(locale, "thisCycle")}
          </div>
          {primaryCategories.length === 0 ? (
            <div className="py-4 text-sm text-[color:var(--muted)]">
              {t(locale, "nothingToBreakDown")}
            </div>
          ) : (
            <ul className="space-y-1">
              {primaryCategories.map(([catId, total]) => {
                const cat = catId ? categoryById.get(catId) ?? null : null;
                const pct = primaryTotal
                  ? Math.round((total / primaryTotal) * 100)
                  : 0;
                const row = (
                  <>
                    <span className="w-32 shrink-0 truncate">
                      {cat ? `${cat.emoji} ${categoryLabel(cat.label, locale)}` : "—"}
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
                      {formatAmount(total, locale, userCurrency)}
                    </span>
                  </>
                );
                return (
                  <li key={catId ?? "uncat"}>
                    {catId ? (
                      <Link
                        href={`${basePath}?cat=${catId}`}
                        className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1 text-sm transition hover:bg-[color:var(--border)]/30"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-2 py-1 text-sm">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}


      {!filterCat && (
        <>
      {/* Per-period history list */}
      <section className="mb-12 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            {t(locale, "history")} {"·"} {t(locale, "lastNPeriods", { n: PERIODS_OF_HISTORY })}
          </div>
          <div className="text-xs text-[color:var(--muted)]">
            {t(locale, "avg")} {formatAmount(avgPastSpend, locale, userCurrency)}{t(locale, "perPeriod")}
          </div>
        </div>

        {historyRows.length === 0 ? (
          <div className="py-4 text-sm text-[color:var(--muted)]">
            {t(locale, "noPriorMonths")}
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
                    href={`/charts/${m.key}`}
                    title={formatCycleRange(m.start, m.end, locale)}
                    className={
                      "flex items-center justify-between gap-4 py-3 text-sm transition " +
                      (isSelected
                        ? "text-[color:var(--foreground)]"
                        : "hover:text-[color:var(--foreground)]")
                    }
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="w-24 shrink-0">
                        {formatMonthShortYear(cycleMidpoint(m.start, m.end), locale)}
                      </span>
                      <div className="relative hidden h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--border)] sm:block">
                        <div
                          className="h-full bg-[color:var(--foreground)]/60"
                          style={{
                            width: `${Math.min(100, (m.spend / Math.max(1, maxPeriod)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="hidden text-xs text-[color:var(--muted)] sm:inline">
                        {m.count} {t(locale, "txns")}
                      </span>
                      {historyRows.length > 1 && avgPastSpend > 0 && m.spend > 0 && vsAvg !== 0 && (
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
                        {formatAmount(net, locale, userCurrency)}
                      </span>
                      <span className="w-24 text-right font-mono tabular-nums">
                        {formatAmount(m.spend, locale, userCurrency)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Per-period trend chart */}
      <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            {t(locale, "trend")} {"·"} {t(locale, "lastNPeriods", { n: PERIODS_OF_HISTORY })}
          </div>
          <div className="flex items-center gap-3 text-xs text-[color:var(--muted)]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm bg-[color:var(--foreground)]/70" />
              {t(locale, "spend")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/70" />
              {t(locale, "income")}
            </span>
          </div>
        </div>

        <div className="flex h-48 items-stretch gap-0.5 sm:gap-2">
          {trendRows.map((m) => {
            const spendH = (m.spend / maxPeriod) * 100;
            const incomeH = (m.income / maxPeriod) * 100;
            const isSelected = m.key === selectedKey;
            const isCurrent = m.key === currentKey;
            return (
              <Link
                key={m.key}
                href={isCurrent ? "/charts" : `/charts/${m.key}`}
                className={
                  "group flex min-w-0 flex-1 flex-col items-center rounded-md px-0 py-1 transition sm:px-1 " +
                  (isSelected
                    ? "bg-[color:var(--border)]/50"
                    : "hover:bg-[color:var(--border)]/30")
                }
                title={`${formatCycleRange(m.start, m.end, locale)} — ${formatAmount(m.spend, locale, userCurrency)} ${t(locale, "spend")} / ${formatAmount(m.income, locale, userCurrency)} ${t(locale, "income")}`}
              >
                <div className="relative w-full flex-1">
                  <div className="absolute inset-0 flex items-end justify-center gap-0.5 sm:gap-1">
                    <div
                      className="w-1/3 rounded-sm bg-[color:var(--foreground)]/70 transition group-hover:bg-[color:var(--foreground)]"
                      style={{ height: `${Math.max(spendH, 1)}%` }}
                    />
                    <div
                      className="w-1/3 rounded-sm bg-emerald-500/70 transition group-hover:bg-emerald-500"
                      style={{ height: `${Math.max(incomeH, 1)}%` }}
                    />
                  </div>
                </div>
                <div
                  className={
                    "mt-2 w-full truncate text-center text-[10px] sm:text-xs " +
                    (isCurrent ? "font-medium" : "text-[color:var(--muted)]")
                  }
                >
                  {formatMonthShort(cycleMidpoint(m.start, m.end), locale)}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[color:var(--border)] pt-4 text-xs">
          <div>
            <div className="text-[color:var(--muted)]">{t(locale, "avgSpendPerPeriod")}</div>
            <div className="mt-0.5 font-mono tabular-nums">
              {formatAmount(avgPastSpend, locale, userCurrency)}
            </div>
          </div>
          <div>
            <div className="text-[color:var(--muted)]">{t(locale, "avgIncomePerPeriod")}</div>
            <div className="mt-0.5 font-mono tabular-nums">
              {formatAmount(avgPeriodIncome, locale, userCurrency)}
            </div>
          </div>
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-[color:var(--muted)]">
        {t(locale, "historyNote")}
      </p>
        </>
      )}
    </main>
  );
}
