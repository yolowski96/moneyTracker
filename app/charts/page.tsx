import Link from "next/link";
import { formatAmount } from "@/lib/money";
import { getSettings, getCycleBounds } from "@/lib/cycle";
import { getCategory } from "@/lib/categories";
import {
  getCycleTransactions,
  getTransactionsSince,
  getIncomeEventsSince,
} from "@/lib/queries";
import { ThemeToggle } from "../theme-toggle";

export const dynamic = "force-dynamic";

const MONTHS_OF_HISTORY = 6;

export default async function ChartsPage() {
  const settings = await getSettings();
  const cycle = getCycleBounds(settings);

  // For the "last N calendar months" trend chart.
  const now = new Date();
  const trendStart = new Date(
    now.getFullYear(),
    now.getMonth() - (MONTHS_OF_HISTORY - 1),
    1,
  );

  const [cycleTx, historyTx, historyIncome] = await Promise.all([
    getCycleTransactions(cycle.start.toISOString(), cycle.end.toISOString()),
    getTransactionsSince(trendStart.toISOString()),
    getIncomeEventsSince(trendStart.toISOString()),
  ]);

  // ── Daily spend in current cycle ──────────────────────────────────────
  const days: { date: Date; total: number }[] = [];
  const cursor = new Date(cycle.start);
  while (cursor < cycle.end) {
    days.push({ date: new Date(cursor), total: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const t of cycleTx) {
    const idx = Math.floor(
      (t.occurredAt.getTime() - cycle.start.getTime()) / 86_400_000,
    );
    if (idx >= 0 && idx < days.length) days[idx].total += t.amount;
  }
  const maxDaily = Math.max(1, ...days.map((d) => d.total));

  // ── Category breakdown (full list) ────────────────────────────────────
  const byCat = new Map<string | null, number>();
  for (const t of cycleTx) {
    byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
  }
  const categoryRows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const cycleTotal = cycleTx.reduce((s, t) => s + t.amount, 0);

  // ── Monthly trend: spend vs income (base + bonuses) for last N months ─
  type MonthKey = string; // YYYY-MM
  const months: { key: MonthKey; label: string; date: Date }[] = [];
  for (let i = MONTHS_OF_HISTORY - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-IE", { month: "short" }),
      date: d,
    });
  }
  const monthSpend = new Map<MonthKey, number>(months.map((m) => [m.key, 0]));
  const monthExtra = new Map<MonthKey, number>(months.map((m) => [m.key, 0]));
  for (const t of historyTx) {
    const k = `${t.occurredAt.getFullYear()}-${String(t.occurredAt.getMonth() + 1).padStart(2, "0")}`;
    if (monthSpend.has(k))
      monthSpend.set(k, (monthSpend.get(k) ?? 0) + t.amount);
  }
  for (const e of historyIncome) {
    const k = `${e.occurredAt.getFullYear()}-${String(e.occurredAt.getMonth() + 1).padStart(2, "0")}`;
    if (monthExtra.has(k))
      monthExtra.set(k, (monthExtra.get(k) ?? 0) + e.amount);
  }
  const monthRows = months.map((m) => ({
    ...m,
    spend: monthSpend.get(m.key) ?? 0,
    income: settings.incomeAmount + (monthExtra.get(m.key) ?? 0),
  }));
  const maxMonth = Math.max(
    1,
    ...monthRows.map((m) => Math.max(m.spend, m.income)),
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Charts</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Where the money went.
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

      {/* Daily spend — current cycle */}
      <section className="mb-12 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
              Daily spend
            </div>
            <div className="mt-0.5 text-sm">{cycle.label}</div>
          </div>
          <div className="font-mono text-sm tabular-nums">
            {formatAmount(cycleTotal)}
          </div>
        </div>

        {cycleTotal === 0 ? (
          <div className="py-8 text-center text-sm text-[color:var(--muted)]">
            No spending yet this cycle.
          </div>
        ) : (
          <div className="flex h-40 items-end gap-[2px]">
            {days.map((d, i) => {
              const h = d.total === 0 ? 2 : (d.total / maxDaily) * 100;
              const isToday =
                d.date.toDateString() === new Date().toDateString();
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
                        : isToday
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
            {cycle.start.toLocaleDateString("en-IE", {
              day: "numeric",
              month: "short",
            })}
          </span>
          <span>
            {new Date(cycle.end.getTime() - 86_400_000).toLocaleDateString(
              "en-IE",
              { day: "numeric", month: "short" },
            )}
          </span>
        </div>
      </section>

      {/* Category breakdown */}
      <section className="mb-12 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <div className="mb-4 text-xs uppercase tracking-widest text-[color:var(--muted)]">
          By category {"\u00B7"} this cycle
        </div>
        {categoryRows.length === 0 ? (
          <div className="py-4 text-sm text-[color:var(--muted)]">
            Nothing to break down yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {categoryRows.map(([catId, total]) => {
              const cat = getCategory(catId);
              const pct = cycleTotal
                ? Math.round((total / cycleTotal) * 100)
                : 0;
              return (
                <li
                  key={catId ?? "uncat"}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="w-32 shrink-0 truncate">
                    {cat
                      ? `${cat.emoji} ${cat.label}`
                      : "\u2014 Uncategorized"}
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

      {/* Monthly trend */}
      <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            Last {MONTHS_OF_HISTORY} months
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

        <div className="flex h-48 items-end gap-4">
          {monthRows.map((m) => {
            const spendH = (m.spend / maxMonth) * 100;
            const incomeH = (m.income / maxMonth) * 100;
            return (
              <div
                key={m.key}
                className="group flex flex-1 flex-col items-center"
              >
                <div className="relative flex h-full w-full items-end justify-center gap-1">
                  <div
                    title={`Spend \u2014 ${formatAmount(m.spend)}`}
                    className="w-1/3 rounded-sm bg-[color:var(--foreground)]/70 transition group-hover:bg-[color:var(--foreground)]"
                    style={{ height: `${Math.max(spendH, 1)}%` }}
                  />
                  <div
                    title={`Income \u2014 ${formatAmount(m.income)}`}
                    className="w-1/3 rounded-sm bg-emerald-500/70 transition group-hover:bg-emerald-500"
                    style={{ height: `${Math.max(incomeH, 1)}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-[color:var(--muted)]">
                  {m.label}
                </div>
              </div>
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
                  monthRows.reduce((s, m) => s + m.income, 0) /
                    monthRows.length,
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-[color:var(--muted)]">
        Trend chart groups by calendar month regardless of your reset day.
      </p>
    </main>
  );
}
