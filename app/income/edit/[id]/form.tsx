"use client";

import { useState, useTransition } from "react";

type Initial = {
  id: string;
  amount: string;
  note: string;
  occurredAt: string;
};

type Props = {
  initial: Initial;
  currencySymbol: string;
  labels: {
    amount: string;
    note: string;
    notePlaceholder: string;
    date: string;
    dateHint: string;
    delete: string;
    save: string;
    saving: string;
    confirmDelete: string;
  };
  onSave: (formData: FormData) => Promise<void>;
  onDelete: (formData: FormData) => Promise<void>;
};

export function IncomeEditForm({
  initial,
  currencySymbol,
  labels,
  onSave,
  onDelete,
}: Props) {
  const [amount, setAmount] = useState(initial.amount);
  const [note, setNote] = useState(initial.note);
  const [occurredAt, setOccurredAt] = useState(initial.occurredAt);
  const [isPending, startTransition] = useTransition();

  function submit(action: Props["onSave"]) {
    return () => {
      const fd = new FormData();
      fd.set("id", initial.id);
      fd.set("amount", amount);
      fd.set("note", note);
      fd.set("occurredAt", occurredAt);
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
          {labels.amount}
        </label>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-2 focus-within:border-[color:var(--foreground)]/30">
          <span className="pl-1 text-sm text-[color:var(--muted)]">
            {currencySymbol}
          </span>
          <input
            type="text"
            required
            inputMode="decimal"
            pattern="[0-9]+([.,][0-9]{1,2})?"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border-0 bg-transparent px-1 py-1 text-sm tabular-nums outline-none"
          />
        </div>
      </section>

      <section>
        <label className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {labels.note}
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={labels.notePlaceholder}
          className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--foreground)]/30"
        />
      </section>

      <section>
        <label className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {labels.date}
        </label>
        <input
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--foreground)]/30"
        />
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          {labels.dateHint}
        </p>
      </section>

      <div className="flex items-center justify-between border-t border-[color:var(--border)] pt-4">
        <button
          type="button"
          onClick={() => {
            if (!confirm(labels.confirmDelete)) return;
            submit(onDelete)();
          }}
          disabled={isPending}
          className="text-sm text-red-500 hover:underline disabled:opacity-50"
        >
          {labels.delete}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[color:var(--foreground)] px-4 py-2 text-sm font-medium text-[color:var(--background)] disabled:opacity-50"
        >
          {isPending ? `${labels.saving}\u2026` : labels.save}
        </button>
      </div>
    </form>
  );
}
