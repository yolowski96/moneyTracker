"use client";

import { useState, useTransition } from "react";
import type { Category } from "@/lib/categories";
import type { RecurringRuleView } from "@/lib/recurring";
import { categoryLabel, type Locale } from "@/lib/i18n";
import { formatAmount } from "@/lib/format";

type Labels = {
  merchantPlaceholder: string;
  amountPlaceholder: string;
  notePlaceholder: string;
  dayOfMonth: string;
  dayN: string;
  categoryNone: string;
  addRecurring: string;
  pause: string;
  resume: string;
  paused: string;
  edit: string;
  delete: string;
  save: string;
  cancel: string;
  noRecurring: string;
};

type Props = {
  rules: RecurringRuleView[];
  categories: Category[];
  locale: Locale;
  labels: Labels;
  onAdd: (formData: FormData) => Promise<void>;
  onUpdate: (formData: FormData) => Promise<void>;
  onToggle: (formData: FormData) => Promise<void>;
  onDelete: (formData: FormData) => Promise<void>;
};

type Draft = {
  merchant: string;
  amount: string;
  day: string;
  category: string;
  note: string;
};

const EMPTY_DRAFT: Draft = { merchant: "", amount: "", day: "1", category: "", note: "" };

export function RecurringCard({
  rules,
  categories,
  locale,
  labels,
  onAdd,
  onUpdate,
  onToggle,
  onDelete,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft>(EMPTY_DRAFT);

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  function toFormData(d: Draft, id?: string): FormData {
    const fd = new FormData();
    if (id) fd.set("id", id);
    fd.set("merchant", d.merchant.trim());
    fd.set("amount", d.amount.trim());
    fd.set("dayOfMonth", d.day.trim());
    fd.set("category", d.category);
    fd.set("note", d.note.trim());
    return fd;
  }

  function add() {
    if (!draft.merchant.trim() || !draft.amount.trim()) return;
    startTransition(async () => {
      await onAdd(toFormData(draft));
      setDraft(EMPTY_DRAFT);
    });
  }

  function saveEdit(id: string) {
    if (!edit.merchant.trim() || !edit.amount.trim()) return;
    startTransition(async () => {
      await onUpdate(toFormData(edit, id));
      setEditingId(null);
    });
  }

  function toggle(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => onToggle(fd));
  }

  function remove(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => onDelete(fd));
  }

  const inputCls =
    "rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-sm outline-none focus:border-[color:var(--foreground)]/30";

  function fields(d: Draft, set: (d: Draft) => void) {
    return (
      <>
        <input
          type="text"
          value={d.merchant}
          onChange={(e) => set({ ...d, merchant: e.target.value })}
          placeholder={labels.merchantPlaceholder}
          className={`min-w-0 flex-1 ${inputCls}`}
        />
        <input
          type="text"
          inputMode="decimal"
          value={d.amount}
          onChange={(e) => set({ ...d, amount: e.target.value })}
          placeholder={labels.amountPlaceholder}
          className={`w-20 ${inputCls}`}
        />
        <input
          type="number"
          min={1}
          max={31}
          value={d.day}
          onChange={(e) => set({ ...d, day: e.target.value })}
          aria-label={labels.dayOfMonth}
          title={labels.dayOfMonth}
          className={`w-16 ${inputCls}`}
        />
        <select
          value={d.category}
          onChange={(e) => set({ ...d, category: e.target.value })}
          className={`min-w-0 flex-1 ${inputCls}`}
        >
          <option value="">{labels.categoryNone}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {categoryLabel(c.label, locale)}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={d.note}
          onChange={(e) => set({ ...d, note: e.target.value })}
          placeholder={labels.notePlaceholder}
          className={`min-w-0 flex-1 ${inputCls}`}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {labels.addRecurring}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {fields(draft, setDraft)}
          <button
            type="button"
            onClick={add}
            disabled={isPending || !draft.merchant.trim() || !draft.amount.trim()}
            className="w-full shrink-0 rounded-md bg-[color:var(--foreground)] px-3 py-2 text-sm font-medium text-[color:var(--background)] disabled:opacity-50 sm:w-auto"
          >
            {labels.addRecurring}
          </button>
        </div>
      </div>

      <div>
        {rules.length === 0 ? (
          <div className="py-3 text-sm text-[color:var(--muted)]">
            {labels.noRecurring}
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--border)]">
            {rules.map((r) => {
              const cat = r.category ? categoryById.get(r.category) ?? null : null;
              const isEditing = editingId === r.id;
              return (
                <li
                  key={r.id}
                  className={
                    "flex flex-wrap items-center gap-2 py-2 text-sm" +
                    (r.active ? "" : " opacity-60")
                  }
                >
                  {isEditing ? (
                    <>
                      {fields(edit, setEdit)}
                      <button
                        type="button"
                        onClick={() => saveEdit(r.id)}
                        disabled={isPending}
                        className="rounded-md bg-[color:var(--foreground)] px-2 py-1 text-xs font-medium text-[color:var(--background)] disabled:opacity-50"
                      >
                        {labels.save}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={isPending}
                        className="text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                      >
                        {labels.cancel}
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="w-8 text-center text-base" aria-hidden>
                        {cat?.emoji ?? "↻"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{r.merchant}</div>
                        <div className="mt-0.5 truncate text-xs text-[color:var(--muted)]">
                          {[
                            labels.dayN.replace("{n}", String(r.dayOfMonth)),
                            cat ? categoryLabel(cat.label, locale) : null,
                            r.note,
                            r.active ? null : labels.paused,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <span className="font-mono text-sm tabular-nums">
                        {formatAmount(r.amount, locale, r.currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(r.id);
                          setEdit({
                            merchant: r.merchant,
                            amount: String(r.amount / 100),
                            day: String(r.dayOfMonth),
                            category: r.category ?? "",
                            note: r.note ?? "",
                          });
                        }}
                        disabled={isPending}
                        className="text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                      >
                        {labels.edit}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(r.id)}
                        disabled={isPending}
                        className="text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                      >
                        {r.active ? labels.pause : labels.resume}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        disabled={isPending}
                        className="text-xs text-[color:var(--muted)] hover:text-red-500"
                      >
                        {labels.delete}
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
