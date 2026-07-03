import Link from "next/link";
import type { Transaction, IncomeEvent } from "@prisma/client";
import type { CycleBounds, Period } from "@/lib/cycle";
import { formatAmount, formatDateShort } from "@/lib/format";
import { t, type Locale } from "@/lib/i18n";
import { IncomeSection } from "./income-section";

// Home summary: the hero card (remaining vs income with a pace badge and a
// today-marker on the spend bar) plus the extra-income card.
export function CycleSummary({
  locale,
  currency,
  cycle,
  period,
  baseIncome,
  transactions,
  income,
}: {
  locale: Locale;
  currency: string;
  cycle: CycleBounds;
  period: Period;
  baseIncome: number;
  transactions: Transaction[];
  income: IncomeEvent[];
}) {
  const cycleTotal = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const bonusTotal = income.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = baseIncome + bonusTotal;

  // Pace: how far through the money vs how far through the period.
  const now = Date.now();
  const span = Math.max(1, cycle.end.getTime() - cycle.start.getTime());
  const elapsedFrac = Math.min(1, Math.max(0, (now - cycle.start.getTime()) / span));
  const elapsedPct = Math.round(elapsedFrac * 100);
  const spentPct =
    totalIncome > 0 ? Math.min(100, Math.round((cycleTotal / totalIncome) * 100)) : 0;
  const paceDiff = totalIncome > 0 ? spentPct - elapsedPct : 0;
  const underPlan = paceDiff <= 0;
  const daysElapsed = Math.max(
    1,
    Math.ceil((now - cycle.start.getTime()) / 86_400_000),
  );
  const perDay = Math.round(cycleTotal / daysElapsed);
  const over = cycleTotal > totalIncome;

  return (
    <>
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 sm:px-7">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">
            {cycle.label}
          </div>
          {totalIncome > 0 && (
            <div
              className={
                "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                (over
                  ? "bg-red-500/10 text-[color:var(--danger)]"
                  : underPlan
                    ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                    : "bg-[color:var(--spend)]/10 text-[color:var(--spend)]")
              }
            >
              {underPlan ? t(locale, "underPlan") : t(locale, "overPlan")} {"·"}{" "}
              {paceDiff > 0 ? "+" : "−"}
              {Math.abs(paceDiff)}%
            </div>
          )}
        </div>

        {totalIncome > 0 ? (
          <>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
              <div>
                <div className="text-xs text-[color:var(--muted)]">
                  {t(locale, "remaining")}
                </div>
                <div
                  className={
                    "mt-1 font-mono text-4xl font-semibold leading-none tracking-tight tabular-nums sm:text-5xl " +
                    (totalIncome - cycleTotal < 0
                      ? "text-[color:var(--danger)]"
                      : "text-[color:var(--accent)]")
                  }
                >
                  {formatAmount(totalIncome - cycleTotal, locale, currency)}
                </div>
              </div>
              <div className="flex gap-7 text-right">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
                    {t(locale, "income")}
                  </div>
                  <div className="mt-1 font-mono text-[17px] tabular-nums">
                    {formatAmount(totalIncome, locale, currency)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
                    {t(locale, "spend")}
                  </div>
                  <div className="mt-1 font-mono text-[17px] tabular-nums text-[color:var(--spend)]">
                    {formatAmount(cycleTotal, locale, currency)}
                  </div>
                </div>
                <div className="hidden sm:block">
                  <div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
                    {t(locale, "perDayLabel")}
                  </div>
                  <div className="mt-1 font-mono text-[17px] tabular-nums">
                    {formatAmount(perDay, locale, currency)}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative mt-7 h-2.5 rounded-full bg-[color:var(--chip)]">
              <div
                className={
                  "h-2.5 rounded-full " +
                  (over
                    ? "bg-[color:var(--danger)]"
                    : "bg-[color:var(--accent-bar)]")
                }
                style={{ width: `${spentPct}%` }}
              />
              <div
                className="absolute -top-1 h-[18px] w-0.5 rounded bg-[color:var(--spend)]"
                style={{ left: `${elapsedPct}%` }}
              />
              <div
                className="absolute -top-5 -translate-x-1/2 text-[10px] font-semibold text-[color:var(--spend)]"
                style={{ left: `${elapsedPct}%` }}
              >
                {t(locale, "todayLower")}
              </div>
            </div>
            <div className="mt-2.5 flex justify-between text-xs text-[color:var(--muted)]">
              <span>
                {spentPct}
                {t(locale, "pctUsed")} {"·"} {transactions.length}{" "}
                {t(locale, "txns")}
              </span>
              <span>
                {formatDateShort(cycle.start, locale)} {"→"}{" "}
                {formatDateShort(
                  new Date(cycle.end.getTime() - 86_400_000),
                  locale,
                )}{" "}
                {"·"}{" "}
                {cycle.daysUntilReset === 0
                  ? t(locale, "resetsToday")
                  : t(locale, "daysLeft", { n: cycle.daysUntilReset })}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 font-mono text-4xl font-semibold tabular-nums">
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
      </section>

      <IncomeSection
        locale={locale}
        currency={currency}
        period={period}
        events={income}
        bonusTotal={bonusTotal}
      />
    </>
  );
}
