"use client";

import { useRef, useState, useTransition } from "react";
import { CATEGORIES } from "@/lib/categories";

type Props = {
  action: (formData: FormData) => Promise<void>;
};

export function AddTransactionForm({ action }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState<string>("");

  return (
    <form
      ref={formRef}
      action={(fd) =>
        startTransition(async () => {
          await action(fd);
          formRef.current?.reset();
          setCategoryId("");
          formRef.current
            ?.querySelector<HTMLInputElement>('input[name="amount"]')
            ?.focus();
        })
      }
      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-2 focus-within:border-[color:var(--foreground)]/30"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="0.00"
          inputMode="decimal"
          className="w-24 border-0 bg-transparent px-2 py-1 text-sm tabular-nums outline-none"
          autoFocus
        />
        <div className="h-5 w-px bg-[color:var(--border)]" />
        <input
          name="merchant"
          type="text"
          required
          placeholder="Merchant"
          className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1 text-sm outline-none"
        />
        <input type="hidden" name="category" value={categoryId} />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[color:var(--foreground)] px-3 py-1 text-xs font-medium text-[color:var(--background)] disabled:opacity-50"
        >
          {isPending ? "Adding\u2026" : "Add"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 border-t border-[color:var(--border)] pt-2">
        {CATEGORIES.map((c) => {
          const active = categoryId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(active ? "" : c.id)}
              className={
                "rounded-md px-2 py-1 text-xs transition " +
                (active
                  ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                  : "text-[color:var(--muted)] hover:bg-[color:var(--surface)]")
              }
            >
              <span className="mr-1">{c.emoji}</span>
              {c.label}
            </button>
          );
        })}
      </div>
    </form>
  );
}
