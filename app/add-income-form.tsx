"use client";

import { useRef, useState, useTransition } from "react";

type Props = {
  action: (formData: FormData) => Promise<void>;
};

export function AddIncomeForm({ action }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-dashed border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted)] transition hover:border-[color:var(--foreground)]/30 hover:text-[color:var(--foreground)]"
      >
        {"+ Add extra income"}
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={(fd) =>
        startTransition(async () => {
          await action(fd);
          formRef.current?.reset();
          setOpen(false);
        })
      }
      className="space-y-2 rounded-md border border-[color:var(--border)] bg-[color:var(--background)] p-2 focus-within:border-[color:var(--foreground)]/30"
    >
      <div className="flex items-center gap-2">
        <span className="pl-1 text-sm text-[color:var(--muted)]">
          {"\u20AC"}
        </span>
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="0.00"
          inputMode="decimal"
          className="w-24 border-0 bg-transparent px-1 py-1 text-sm tabular-nums outline-none"
          autoFocus
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-[color:var(--foreground)] px-3 py-1 text-xs font-medium text-[color:var(--background)] disabled:opacity-50"
          >
            {isPending ? "Adding\u2026" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md px-2 py-1 text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            Cancel
          </button>
        </div>
      </div>
      <input
        name="note"
        type="text"
        placeholder="What for? (e.g. bonus, refund)"
        className="w-full border-0 border-t border-[color:var(--border)] bg-transparent px-2 pt-2 text-sm outline-none"
      />
    </form>
  );
}
