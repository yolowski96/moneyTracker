import Link from "next/link";
import type { IncomeEvent } from "@prisma/client";
import { formatAmount, formatDateShort, currencySymbol } from "@/lib/format";
import { t, type Locale } from "@/lib/i18n";
import type { Period } from "@/lib/cycle";
import { AddIncomeForm } from "./add-income-form";
import { addIncomeEvent, deleteIncomeEvent } from "./actions";

// Extra-income block inside the cycle summary card: per-event list with
// edit/delete plus the inline add form.
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
    <div className="mt-5 border-t border-[color:var(--border)] pt-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {t(locale, "extraIncomeThis")} {t(locale, period)}
        </div>
        <div className="font-mono text-xs tabular-nums text-[color:var(--muted)]">
          {formatAmount(bonusTotal, locale, currency)}
        </div>
      </div>
      {events.length > 0 && (
        <ul className="mb-3 divide-y divide-[color:var(--border)]">
          {events.map((e) => (
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
                    {e.note || t(locale, "extraIncome")}
                  </div>
                  <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                    {formatDateShort(e.occurredAt, locale)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm tabular-nums">
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
  );
}
