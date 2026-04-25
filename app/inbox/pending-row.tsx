"use client";

import Link from "next/link";
import { useTransition } from "react";
import type { Category } from "@/lib/categories";
import { categoryLabel, type Locale } from "@/lib/i18n";

type Tx = {
  id: string;
  merchant: string;
  amount: string;
  note: string | null;
  source: string;
  occurredAtLabel: string;
};

type Props = {
  transaction: Tx;
  categories: Category[];
  locale: Locale;
  labels: { edit: string; dismiss: string };
  onCategorize: (formData: FormData) => Promise<void>;
  onDelete: (formData: FormData) => Promise<void>;
};

export function PendingRow({
  transaction,
  categories,
  locale,
  labels,
  onCategorize,
  onDelete,
}: Props) {
  const [isPending, startTransition] = useTransition();

  function pick(categoryId: string) {
    const fd = new FormData();
    fd.set("id", transaction.id);
    fd.set("categoryId", categoryId);
    startTransition(() => onCategorize(fd));
  }

  function remove() {
    const fd = new FormData();
    fd.set("id", transaction.id);
    startTransition(() => onDelete(fd));
  }

  return (
    <li
      className={
        "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 transition " +
        (isPending ? "opacity-50" : "")
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-medium">
            {transaction.merchant}
          </div>
          <div className="mt-0.5 text-xs text-[color:var(--muted)]">
            {transaction.occurredAtLabel}
            {" \u00B7 "}
            <span className="font-mono">{transaction.source}</span>
            {transaction.note ? ` \u00B7 ${transaction.note}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-base tabular-nums">
            {transaction.amount}
          </span>
          <Link
            href={`/edit/${transaction.id}?from=inbox`}
            aria-label={labels.edit}
            className="text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            {"\u270E"}
          </Link>
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            aria-label={labels.dismiss}
            className="text-[color:var(--muted)] hover:text-red-500"
          >
            &times;
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1 border-t border-[color:var(--border)] pt-3">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => pick(c.id)}
            disabled={isPending}
            className="rounded-md px-2 py-1 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--background)] hover:text-[color:var(--foreground)] disabled:cursor-not-allowed"
          >
            <span className="mr-1">{c.emoji}</span>
            {categoryLabel(c.label, locale)}
          </button>
        ))}
      </div>
    </li>
  );
}
