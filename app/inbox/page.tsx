import Link from "next/link";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/money";
import { CATEGORIES } from "@/lib/categories";
import { TAG_TRANSACTIONS } from "@/lib/cache-tags";
import { log } from "@/lib/log";
import { getPendingTransactions } from "@/lib/queries";
import { ThemeToggle } from "../theme-toggle";
import { PendingRow } from "./pending-row";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return d.toLocaleString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function InboxPage() {
  const pending = await getPendingTransactions();

  async function setCategory(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const categoryId = String(formData.get("categoryId") ?? "");
    if (!id || !categoryId) {
      log("action.inbox.setCategory", 400, "missing_input", "id or categoryId missing", {
        hasId: !!id,
        hasCategoryId: !!categoryId,
      });
      return;
    }
    if (!CATEGORIES.some((c) => c.id === categoryId)) {
      log("action.inbox.setCategory", 400, "unknown_category", `${categoryId} is not a known category`, {
        categoryId,
        id,
      });
      return;
    }
    await prisma.transaction.update({
      where: { id },
      data: { category: categoryId },
    });
    log("action.inbox.setCategory", 200, "categorized", `transaction ${id} -> ${categoryId}`, {
      id,
      categoryId,
    });
    updateTag(TAG_TRANSACTIONS);
  }

  async function deletePending(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) {
      log("action.inbox.deletePending", 400, "missing_id", "no id in form");
      return;
    }
    await prisma.transaction.delete({ where: { id } });
    log("action.inbox.deletePending", 200, "deleted", `transaction ${id}`, { id });
    updateTag(TAG_TRANSACTIONS);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Uncategorized transactions. Tap a category to file each one.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/charts"
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            Charts
          </Link>
          <Link
            href="/"
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            {"\u2190"} Back
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {pending.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[color:var(--border)] p-10 text-center text-sm text-[color:var(--muted)]">
          Inbox zero. {"\u{1F389}"}
          <div className="mt-2 text-xs">
            New transactions from your Shortcut appear here until you assign a
            category.
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((t) => (
            <PendingRow
              key={t.id}
              transaction={{
                id: t.id,
                merchant: t.merchant,
                amount: formatAmount(t.amount, t.currency),
                note: t.note,
                source: t.source,
                occurredAtLabel: formatDate(t.occurredAt),
              }}
              categories={CATEGORIES}
              onCategorize={setCategory}
              onDelete={deletePending}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
