import Link from "next/link";
import type { Transaction } from "@prisma/client";
import type { Category } from "@/lib/categories";
import { formatAmount, bcp47 } from "@/lib/format";
import { t, categoryLabel, type Locale } from "@/lib/i18n";
import { deleteTransaction } from "./actions";

const ITEMS_PER_PAGE = 6;

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

function formatDayLabel(iso: string, locale: Locale) {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.getTime() === today.getTime()) return t(locale, "today");
  if (d.getTime() === yesterday.getTime()) return t(locale, "yesterday");
  return d.toLocaleDateString(bcp47(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Recent transactions grouped by day, paginated ITEMS_PER_PAGE rows at a time
// (keeps the card roughly the height of the categories card next to it) via the
// ?p= query param (clamped here, so any garbage falls back to page 1). Day
// headers always show the full day total even when the day spans two pages.
export function TransactionList({
  locale,
  currency,
  transactions,
  requestedPage,
  categoryById,
}: {
  locale: Locale;
  currency: string;
  transactions: Transaction[];
  requestedPage: number;
  categoryById: Map<string, Category>;
}) {
  const totalPages = Math.max(1, Math.ceil(transactions.length / ITEMS_PER_PAGE));
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), totalPages)
    : 1;
  const pageItems = transactions.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );
  const pageDays = groupByDay(pageItems);
  const fullDayTotals = new Map(
    groupByDay(transactions).map(([day, items]) => [
      day,
      items.reduce((sum, tx) => sum + tx.amount, 0),
    ]),
  );

  return (
    <section className="flex flex-col rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-5 sm:px-7">
      <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">
        {t(locale, "recentTransactions")}
      </div>
      <div className="flex-1">
        {transactions.length === 0 && (
          <div className="py-4 text-sm text-[color:var(--muted)]">
            {t(locale, "noTransactionsYet")}{" "}
            <code className="font-mono text-xs">/api/transactions</code>.
          </div>
        )}
        {pageDays.map(([day, items]) => {
        const dayTotal = fullDayTotals.get(day) ?? 0;
        return (
          <div key={day}>
            <div className="flex items-baseline justify-between border-b border-[color:var(--border-soft,var(--border))] pb-2 pt-4">
              <div className="text-[11px] uppercase tracking-wider text-[color:var(--muted-soft,var(--muted))]">
                {formatDayLabel(day, locale)}
              </div>
              <div className="font-mono text-xs tabular-nums text-[color:var(--muted)]">
                {formatAmount(dayTotal, locale, currency)}
              </div>
            </div>
            <ul className="divide-y divide-[color:var(--border-soft,var(--border))]">
              {items.map((tx) => {
                const cat = tx.category ? categoryById.get(tx.category) ?? null : null;
                return (
                  <li
                    key={tx.id}
                    className="group flex items-center justify-between py-2.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 pr-4">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--chip)] text-sm"
                        aria-hidden
                      >
                        {cat?.emoji ?? "\u{1F4B6}"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{tx.merchant}</div>
                        {(cat || tx.note) && (
                          <div className="mt-0.5 truncate text-xs text-[color:var(--muted)]">
                            {[cat ? categoryLabel(cat.label, locale) : null, tx.note].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm tabular-nums">
                        {formatAmount(tx.amount, locale, tx.currency)}
                      </span>
                      <Link
                        href={`/edit/${tx.id}`}
                        aria-label={t(locale, "edit")}
                        className="p-1 -m-1 text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        {"✎"}
                      </Link>
                      <form action={deleteTransaction}>
                        <input type="hidden" name="id" value={tx.id} />
                        <button
                          type="submit"
                          aria-label={t(locale, "delete")}
                          className="p-1 -m-1 text-[color:var(--muted)] transition hover:text-[color:var(--danger)] sm:opacity-0 sm:group-hover:opacity-100"
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
      </div>

      {totalPages > 1 && (
        <nav className="mt-1 flex items-center justify-between border-t border-[color:var(--border-soft,var(--border))] pt-4">
          {page > 1 ? (
            <Link
              href={`/?p=${page - 1}`}
              prefetch={false}
              scroll={false}
              className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              {"←"} {t(locale, "prevPage")}
            </Link>
          ) : (
            <span className="text-sm text-[color:var(--muted-soft,var(--muted))]">
              {"←"} {t(locale, "prevPage")}
            </span>
          )}
          <span className="text-sm tabular-nums text-[color:var(--muted)]">
            {t(locale, "pageOf", { n: page, total: totalPages })}
          </span>
          {page < totalPages ? (
            <Link
              href={`/?p=${page + 1}`}
              prefetch={false}
              scroll={false}
              className="text-sm font-semibold text-[color:var(--accent)] hover:opacity-80"
            >
              {t(locale, "nextPage")} {"→"}
            </Link>
          ) : (
            <span className="text-sm text-[color:var(--muted-soft,var(--muted))]">
              {t(locale, "nextPage")} {"→"}
            </span>
          )}
        </nav>
      )}
    </section>
  );
}
