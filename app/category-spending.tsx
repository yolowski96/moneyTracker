import type { Transaction } from "@prisma/client";
import type { Category } from "@/lib/categories";
import { formatAmount, formatAmountWhole } from "@/lib/format";
import { t, categoryLabel, type Locale } from "@/lib/i18n";

// Per-category spending card: tonal icon chip, label with the bar underneath,
// then percent and amount columns. Budgeted categories are always listed;
// unbudgeted top spenders fill the remaining slots.
export function CategorySpending({
  locale,
  currency,
  transactions,
  categories,
  categoryById,
}: {
  locale: Locale;
  currency: string;
  transactions: Transaction[];
  categories: Category[];
  categoryById: Map<string, Category>;
}) {
  const cycleTotal = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  const byCategory = new Map<string | null, number>();
  for (const tx of transactions) {
    byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + tx.amount);
  }
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
    .sort((a, b) => b[1] - a[1]);

  if (budgetRows.length === 0 && categoryRows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 sm:px-7">
      <div className="mb-5 flex items-baseline justify-between">
        <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">
          {t(locale, "categorySpend")}
        </div>
        <div className="text-xs text-[color:var(--muted)]">
          {t(locale, "totalLabel")}{" "}
          <span className="font-mono tabular-nums text-[color:var(--foreground)]">
            {formatAmount(cycleTotal, locale, currency)}
          </span>
        </div>
      </div>
      <ul className="space-y-5">
        {budgetRows.map(({ cat, budget, total }) => {
          const pct = Math.min(100, Math.round((total / budget) * 100));
          const overBudget = total > budget;
          return (
            <li key={cat.id} className="flex items-center gap-4">
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--chip)] text-lg"
              >
                {cat.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px]">
                  {categoryLabel(cat.label, locale)}
                </div>
                <div className="mt-1.5 h-[7px] rounded-full bg-[color:var(--chip)]">
                  <div
                    className={
                      "h-[7px] rounded-full " +
                      (overBudget
                        ? "bg-[color:var(--danger)]"
                        : pct > 80
                          ? "bg-[color:var(--spend)]"
                          : "bg-[color:var(--accent-bar)]")
                    }
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="w-10 shrink-0 text-right text-xs text-[color:var(--muted)]">
                {pct}%
              </span>
              <span className="w-28 shrink-0 text-right font-mono text-xs tabular-nums text-[color:var(--muted)]">
                <span
                  className={overBudget ? "text-[color:var(--danger)]" : ""}
                >
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
          const pct = cycleTotal ? Math.round((total / cycleTotal) * 100) : 0;
          return (
            <li key={catId ?? "uncat"} className="flex items-center gap-4">
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--chip)] text-lg"
              >
                {cat?.emoji ?? "—"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px]">
                  {cat ? categoryLabel(cat.label, locale) : "—"}
                </div>
                <div className="mt-1.5 h-[7px] rounded-full bg-[color:var(--chip)]">
                  <div
                    className="h-[7px] rounded-full bg-[color:var(--accent-bar)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="w-10 shrink-0 text-right text-xs text-[color:var(--muted)]">
                {pct}%
              </span>
              <span className="w-28 shrink-0 text-right font-mono text-[15px] tabular-nums">
                {formatAmount(total, locale, currency)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
