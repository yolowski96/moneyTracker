"use client";

import { useState, useTransition } from "react";
import type { Category } from "@/lib/categories";

type Initial = {
  id: string;
  amount: string;
  merchant: string;
  category: string | null;
  note: string;
  occurredAt: string;
};

type Props = {
  initial: Initial;
  returnTo: string;
  categories: Category[];
  onSave: (formData: FormData) => Promise<void>;
  onDelete: (formData: FormData) => Promise<void>;
};

export function EditForm({
  initial,
  returnTo,
  categories,
  onSave,
  onDelete,
}: Props) {
  const [amount, setAmount] = useState(initial.amount);
  const [merchant, setMerchant] = useState(initial.merchant);
  const [category, setCategory] = useState<string>(initial.category ?? "");
  const [note, setNote] = useState(initial.note);
  const [occurredAt, setOccurredAt] = useState(initial.occurredAt);
  const [isPending, startTransition] = useTransition();

  function submit(action: Props["onSave"]) {
    return () => {
      const fd = new FormData();
      fd.set("id", initial.id);
      fd.set("amount", amount);
      fd.set("merchant", merchant);
      fd.set("category", category);
      fd.set("note", note);
      fd.set("occurredAt", occurredAt);
      fd.set("returnTo", returnTo);
      startTransition(() => action(fd));
    };
  }

  return (
    <form
      action={submit(onSave)}
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit(onSave)();
      }}
    >
      <section>
        <label className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
          Amount
        </label>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-2 focus-within:border-[color:var(--foreground)]/30">
          <span className="pl-1 text-sm text-[color:var(--muted)]">
            {"\u20AC"}
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border-0 bg-transparent px-1 py-1 text-sm tabular-nums outline-none"
          />
        </div>
      </section>

      <section>
        <label className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
          Merchant
        </label>
        <input
          type="text"
          required
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--foreground)]/30"
        />
      </section>

      <section>
        <label className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
          Category
        </label>
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={
              "rounded-md px-2 py-1 text-xs transition " +
              (category === ""
                ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                : "text-[color:var(--muted)] hover:bg-[color:var(--surface)]")
            }
          >
            {"\u2014"} None
          </button>
          {categories.map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
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
      </section>

      <section>
        <label className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
          Note
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Optional"
          className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--foreground)]/30"
        />
      </section>

      <section>
        <label className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
          Date
        </label>
        <input
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--foreground)]/30"
        />
      </section>

      <div className="flex items-center justify-between border-t border-[color:var(--border)] pt-4">
        <button
          type="button"
          onClick={() => {
            if (!confirm("Delete this transaction?")) return;
            submit(onDelete)();
          }}
          disabled={isPending}
          className="text-sm text-red-500 hover:underline disabled:opacity-50"
        >
          Delete
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[color:var(--foreground)] px-4 py-2 text-sm font-medium text-[color:var(--background)] disabled:opacity-50"
        >
          {isPending ? "Saving\u2026" : "Save"}
        </button>
      </div>
    </form>
  );
}
