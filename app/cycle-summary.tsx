import Link from "next/link";
import type { Transaction, IncomeEvent } from "@prisma/client";
import type { Category } from "@/lib/categories";
import type { CycleBounds, Period } from "@/lib/cycle";
import { formatAmount, formatAmountWhole, formatDateShort } from "@/lib/format";
import { t, categoryLabel, type Locale } from "@/lib/i18n";
import { IncomeSection } from "./income-section";

// The cycle summary card: remaining vs income, spend progress bar, extra
// income, and per-category budget bars for the current cycle.
export function CycleSummary({
  locale,
  currency,
  cycle,
  period,
  baseIncome,
  transactions,
  income,
  categories,
  categoryById,
}: {
  locale: Locale;
  currency: string;
  cycle: CycleBounds;
  period: Period;
  baseIncome: number;
  transactions: Transaction[];
  income: IncomeEvent[];
  categories: Category[];
  categoryById: Map<string, Category>;
}) {
  const cycleTotal = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const bonusTotal = income.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = baseIncome + bonusTotal;

  const byCategory = new Map<string | null, number>();
  for (const tx of transactions) {
    byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + tx.amount);
  }
  // Budgeted categories are always listed (even with no spend this cycle);
  // unbudgeted top spenders fill the remaining slots.
  const budgetRows = categories
    .flatMap((c) =>
      c.budget != null
        ? [{ cat: c, budget: c.budget, total: byCategory.get(c.id) ?? 0 }]
        : [],
    )
    .sort((a, b) => b.total - a.total);
  const budgetedIds = new Set(budgetRows.map((b) => b.cat.id));
  const categoryRows = [...byCategory.entries()]
    .filter(([catId]) => !catId || !budgetedIds.has(catId))
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(0, 6 - budgetRows.length));

  return (
    <section className="mb-10 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {cycle.label}
        </div>
        <div className="text-xs text-[color:var(--muted)]">
          {cycle.daysUntilReset === 0
            ? t(locale, "resetsToday")
            : `${t(locale, "resetsIn")} ${cycle.daysUntilReset}d`}
        </div>
      </div>

      {totalIncome > 0 ? (
        <>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <div className="text-xs text-[color:var(--muted)]">
                {t(locale, "remaining")}
              </div>
              <div
                className={
                  "text-4xl font-medium tabular-nums " +
                  (totalIncome - cycleTotal < 0 ? "text-red-500" : "")
                }
              >
                {formatAmount(totalIncome - cycleTotal, locale, currency)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[color:var(--muted)]">
                {t(locale, "incomeDotSpent")}
              </div>
              <div className="font-mono text-sm tabular-nums">
                {formatAmount(totalIncome, locale, currency)}{" "}
                <span className="text-[color:var(--muted)]">
                  {"·"} {formatAmount(cycleTotal, locale, currency)}
                </span>
              </div>
              {bonusTotal > 0 && (
                <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                  {formatAmount(baseIncome, locale, currency)} {t(locale, "base")} {"+"}{" "}
                  {formatAmount(bonusTotal, locale, currency)} {t(locale, "extra")}
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
                    {pct}{t(locale, "pctUsed")} {"·"} {transactions.length} {t(locale, "txns")}
                  </span>
                  <span>
                    {formatDateShort(cycle.start, locale)} {"→"}{" "}
                    {formatDateShort(
                      new Date(cycle.end.getTime() - 86_400_000),
                      locale,
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
            {formatAmount(cycleTotal, locale, currency)}
          </div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">
            {transactions.length} {t(locale, "transactions")} {"·"}{" "}
            <Link href="/settings" className="underline">
              {t(locale, "setYourIncome")}
            </Link>
            {t(locale, "toSeeWhatsLeft")}
          </div>
        </>
      )}

      <IncomeSection
        locale={locale}
        currency={currency}
        period={period}
        events={income}
        bonusTotal={bonusTotal}
      />

      {(budgetRows.length > 0 || categoryRows.length > 0) && (
        <ul className="mt-5 space-y-1.5 border-t border-[color:var(--border)] pt-4">
          {budgetRows.map(({ cat, budget, total }) => {
            const pct = Math.min(100, Math.round((total / budget) * 100));
            const over = total > budget;
            return (
              <li key={cat.id} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 truncate">
                  {cat.emoji} {categoryLabel(cat.label, locale)}
                </span>
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--border)]">
                  <div
                    className={
                      "h-full " +
                      (over
                        ? "bg-red-500"
                        : pct > 80
                          ? "bg-amber-500"
                          : "bg-[color:var(--foreground)]/70")
                    }
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right font-mono text-xs tabular-nums text-[color:var(--muted)]">
                  <span className={over ? "text-red-500" : ""}>
                    {formatAmountWhole(total, locale, currency)}
                  </span>
                  {" / "}
                  {formatAmountWhole(budget, locale, currency)}
                </span>
              </li>
            );
          })}
          {categoryRows.map(([catId, total]) => {
            const cat = catId ? categoryById.get(catId) ?? null : null;
            const pct = cycleTotal
              ? Math.round((total / cycleTotal) * 100)
              : 0;
            return (
              <li key={catId ?? "uncat"} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 truncate">
                  {cat ? `${cat.emoji} ${categoryLabel(cat.label, locale)}` : "—"}
                </span>
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--border)]">
                  <div
                    className="h-full bg-[color:var(--foreground)]/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right font-mono text-xs tabular-nums text-[color:var(--muted)]">
                  {formatAmount(total, locale, currency)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
