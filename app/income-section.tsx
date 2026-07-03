import Link from "next/link";
import type { IncomeEvent } from "@prisma/client";
import { formatAmount, formatDateShort, currencySymbol } from "@/lib/format";
import { t, type Locale } from "@/lib/i18n";
import type { Period } from "@/lib/cycle";
import { AddIncomeForm } from "./add-income-form";
import { addIncomeEvent, deleteIncomeEvent } from "./actions";

// Extra-income card: per-event list with edit/delete plus the inline add form.
export function IncomeSection({
  locale,
  currency,
  period,
  events,
  bonusTotal,
}: {
  locale: Locale;
  currency: string;
  period: Period;
  events: IncomeEvent[];
  bonusTotal: number;
}) {
  return (
    <section className="mt-3.5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-5 sm:px-7">
      <div className="mb-1 flex items-baseline justify-between">
        <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">
          {t(locale, "extraIncomeThis")} {t(locale, period)}
        </div>
        {bonusTotal > 0 && (
          <div className="font-mono text-xs font-semibold tabular-nums text-[color:var(--accent)]">
            {"+"}
            {formatAmount(bonusTotal, locale, currency)}
          </div>
        )}
      </div>
      {events.length > 0 && (
        <ul className="mb-3 divide-y divide-[color:var(--border-soft,var(--border))]">
          {events.map((e) => (
            <li
              key={e.id}
              className="group flex items-center justify-between py-2.5 text-sm"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3 pr-4">
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--accent-soft)] text-sm"
                >
                  {"\u{1F4B0}"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {e.note || t(locale, "extraIncome")}{" "}
                    <span className="font-normal text-[color:var(--muted)]">
                      {"·"} {formatDateShort(e.occurredAt, locale)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold tabular-nums text-[color:var(--accent)]">
                  {"+"}
                  {formatAmount(e.amount, locale, e.currency)}
                </span>
                <Link
                  href={`/income/edit/${e.id}`}
                  aria-label={t(locale, "edit")}
                  className="p-1 -m-1 text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] sm:opacity-0 sm:group-hover:opacity-100"
                >
                  {"✎"}
                </Link>
                <form action={deleteIncomeEvent}>
                  <input type="hidden" name="id" value={e.id} />
                  <button
                    type="submit"
                    aria-label={t(locale, "remove")}
                    className="p-1 -m-1 text-[color:var(--muted)] transition hover:text-[color:var(--danger)] sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    &times;
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className={events.length > 0 ? "" : "mt-2"}>
        <AddIncomeForm
          action={addIncomeEvent}
          currencySymbol={currencySymbol(locale, currency)}
          labels={{
            addExtraIncome: t(locale, "extraIncome"),
            add: t(locale, "add"),
            adding: t(locale, "add"),
            cancel: t(locale, "cancel"),
            notePlaceholder: t(locale, "notePlaceholder"),
          }}
        />
      </div>
    </section>
  );
}
