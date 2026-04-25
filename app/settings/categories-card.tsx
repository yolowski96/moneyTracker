"use client";

import { useState, useTransition } from "react";
import type { Category } from "@/lib/categories";
import { categoryLabel, type Locale } from "@/lib/i18n";

type Labels = {
  emoji: string;
  label: string;
  emojiPlaceholder: string;
  labelPlaceholder: string;
  addCategory: string;
  activeCategories: string;
  archived: string;
  archive: string;
  restore: string;
  rename: string;
  save: string;
  cancel: string;
  noCategories: string;
  noArchived: string;
};

type Props = {
  categories: Category[];
  locale: Locale;
  labels: Labels;
  onAdd: (formData: FormData) => Promise<void>;
  onRename: (formData: FormData) => Promise<void>;
  onArchive: (formData: FormData) => Promise<void>;
  onRestore: (formData: FormData) => Promise<void>;
};

export function CategoriesCard({
  categories,
  locale,
  labels,
  onAdd,
  onRename,
  onArchive,
  onRestore,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [newEmoji, setNewEmoji] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editEmoji, setEditEmoji] = useState("");

  function add() {
    if (!newLabel.trim() || !newEmoji.trim()) return;
    const fd = new FormData();
    fd.set("emoji", newEmoji.trim());
    fd.set("label", newLabel.trim());
    startTransition(async () => {
      await onAdd(fd);
      setNewEmoji("");
      setNewLabel("");
    });
  }

  function saveRename(id: string) {
    if (!editLabel.trim() || !editEmoji.trim()) return;
    const fd = new FormData();
    fd.set("id", id);
    fd.set("emoji", editEmoji.trim());
    fd.set("label", editLabel.trim());
    startTransition(async () => {
      await onRename(fd);
      setEditingId(null);
    });
  }

  function archive(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => onArchive(fd));
  }

  function restore(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => onRestore(fd));
  }

  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {labels.addCategory}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex gap-2">
            <input
              type="text"
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              placeholder={labels.emojiPlaceholder}
              maxLength={4}
              className="w-16 shrink-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-center text-sm outline-none focus:border-[color:var(--foreground)]/30"
            />
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={labels.labelPlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--foreground)]/30"
            />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={isPending || !newLabel.trim() || !newEmoji.trim()}
            className="w-full shrink-0 rounded-md bg-[color:var(--foreground)] px-3 py-2 text-sm font-medium text-[color:var(--background)] disabled:opacity-50 sm:w-auto"
          >
            {labels.addCategory}
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {labels.activeCategories}
        </div>
        {active.length === 0 ? (
          <div className="py-3 text-sm text-[color:var(--muted)]">
            {labels.noCategories}
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--border)]">
            {active.map((c) => {
              const isEditing = editingId === c.id;
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-2 py-2 text-sm"
                >
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={editEmoji}
                        onChange={(e) => setEditEmoji(e.target.value)}
                        maxLength={4}
                        className="w-16 rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-center text-sm outline-none"
                      />
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="flex-1 rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => saveRename(c.id)}
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
                      <span className="w-8 text-center text-base">{c.emoji}</span>
                      <span className="flex-1 truncate">{categoryLabel(c.label, locale)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditEmoji(c.emoji);
                          setEditLabel(categoryLabel(c.label, locale));
                        }}
                        disabled={isPending}
                        className="text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                      >
                        {labels.rename}
                      </button>
                      <button
                        type="button"
                        onClick={() => archive(c.id)}
                        disabled={isPending}
                        className="text-xs text-[color:var(--muted)] hover:text-red-500"
                      >
                        {labels.archive}
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {labels.archived}
        </div>
        {archived.length === 0 ? (
          <div className="py-3 text-sm text-[color:var(--muted)]">
            {labels.noArchived}
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--border)]">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2 text-sm opacity-60">
                <span className="w-8 text-center text-base">{c.emoji}</span>
                <span className="flex-1 truncate">{categoryLabel(c.label, locale)}</span>
                <button
                  type="button"
                  onClick={() => restore(c.id)}
                  disabled={isPending}
                  className="text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                >
                  {labels.restore}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
