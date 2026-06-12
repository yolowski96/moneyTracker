import Link from "next/link";
import type { Transaction } from "@prisma/client";
import type { Category } from "@/lib/categories";
import { formatAmount, bcp47 } from "@/lib/format";
import { t, categoryLabel, type Locale } from "@/lib/i18n";
import { deleteTransaction } from "./actions";

const DAYS_PER_PAGE = 5;

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

// Recent transactions grouped by day, paginated DAYS_PER_PAGE days at a time
// via the ?p= query param (clamped here, so any garbage falls back to page 1).
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
  const grouped = groupByDay(transactions);
  const totalPages = Math.max(1, Math.ceil(grouped.length / DAYS_PER_PAGE));
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), totalPages)
    : 1;
  const pageDays = grouped.slice(
    (page - 1) * DAYS_PER_PAGE,
    page * DAYS_PER_PAGE,
  );

  return (
    <section className="mt-12 space-y-8">
      {grouped.length === 0 && (
        <div className="text-sm text-[color:var(--muted)]">
          {t(locale, "noTransactionsYet")}{" "}
          <code className="font-mono text-xs">/api/transactions</code>.
        </div>
      )}
      {pageDays.map(([day, items]) => {
        const dayTotal = items.reduce((sum, tx) => sum + tx.amount, 0);
        return (
          <div key={day}>
            <div className="mb-2 flex items-baseline justify-between border-b border-[color:var(--border)] pb-2">
              <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
                {formatDayLabel(day, locale)}
              </div>
              <div className="font-mono text-xs tabular-nums text-[color:var(--muted)]">
                {formatAmount(dayTotal, locale, currency)}
              </div>
            </div>
            <ul className="divide-y divide-[color:var(--border)]">
              {items.map((tx) => {
                const cat = tx.category ? categoryById.get(tx.category) ?? null : null;
                return (
                  <li
                    key={tx.id}
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

      {totalPages > 1 && (
        <nav className="flex items-center justify-between border-t border-[color:var(--border)] pt-4">
          {page > 1 ? (
            <Link
              href={`/?p=${page - 1}`}
              prefetch={false}
              className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              {"←"} {t(locale, "newer")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs tabular-nums text-[color:var(--muted)]">
            {t(locale, "pageOf", { n: page, total: totalPages })}
          </span>
          {page < totalPages ? (
            <Link
              href={`/?p=${page + 1}`}
              prefetch={false}
              className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              {t(locale, "older")} {"→"}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}
