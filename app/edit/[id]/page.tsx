import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getActiveCategories } from "@/lib/categories";
import { TAG_TRANSACTIONS } from "@/lib/cache-tags";
import { log } from "@/lib/log";
import { getSettings } from "@/lib/cycle";
import { t } from "@/lib/i18n";
import { currencySymbol } from "@/lib/format";
import { ThemeToggle } from "../../theme-toggle";
import { EditForm } from "./form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function EditPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const returnTo = from === "inbox" ? "/inbox" : "/";

  const [transaction, settings, categories] = await Promise.all([
    prisma.transaction.findUnique({ where: { id } }),
    getSettings(),
    getActiveCategories(),
  ]);
  if (!transaction) notFound();
  const locale = settings.locale;

  async function save(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    if (!id) {
      log("action.edit.save", 400, "missing_id", "no id in form");
      return;
    }

    const amount = Number(formData.get("amount"));
    const merchant = String(formData.get("merchant") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    const occurredAtRaw = String(formData.get("occurredAt") ?? "").trim();
    const returnToRaw = String(formData.get("returnTo") ?? "/");

    if (!Number.isFinite(amount) || amount <= 0 || !merchant) {
      log("action.edit.save", 400, "invalid_input", "amount or merchant invalid", {
        id,
        amountRaw: formData.get("amount"),
        merchantLen: merchant.length,
      });
      return;
    }

    let categoryValid = false;
    if (category) {
      const cat = await prisma.category.findUnique({ where: { id: category } });
      categoryValid = !!cat;
    }
    const occurredAt = occurredAtRaw
      ? new Date(occurredAtRaw)
      : undefined;
    if (occurredAt && Number.isNaN(occurredAt.getTime())) {
      log("action.edit.save", 400, "invalid_occurred_at", "unparseable datetime-local value", {
        id,
        occurredAtRaw,
      });
      return;
    }

    await prisma.transaction.update({
      where: { id },
      data: {
        amount: Math.round(amount * 100),
        merchant,
        category: categoryValid ? category : null,
        note: note || null,
        ...(occurredAt ? { occurredAt } : {}),
      },
    });

    log("action.edit.save", 200, "updated", `transaction ${id}`, {
      id,
      merchant,
      category: categoryValid ? category : null,
      amount: Math.round(amount * 100),
      returnTo: returnToRaw,
    });

    updateTag(TAG_TRANSACTIONS);
    redirect(returnToRaw === "/inbox" ? "/inbox" : "/");
  }

  async function remove(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const returnToRaw = String(formData.get("returnTo") ?? "/");
    if (!id) {
      log("action.edit.remove", 400, "missing_id", "no id in form");
      return;
    }
    await prisma.transaction.delete({ where: { id } });
    log("action.edit.remove", 200, "deleted", `transaction ${id}`, {
      id,
      returnTo: returnToRaw,
    });
    updateTag(TAG_TRANSACTIONS);
    redirect(returnToRaw === "/inbox" ? "/inbox" : "/");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t(locale, "editTransaction")}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {t(locale, "created")} {transaction.createdAt.toLocaleString("en-IE")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={returnTo}
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            {"\u2190"} {t(locale, "cancel")}
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <EditForm
        initial={{
          id: transaction.id,
          amount: (transaction.amount / 100).toFixed(2),
          merchant: transaction.merchant,
          category: transaction.category,
          note: transaction.note ?? "",
          occurredAt: toLocalInputValue(transaction.occurredAt),
        }}
        returnTo={returnTo}
        categories={categories}
        currencySymbol={currencySymbol(locale, transaction.currency)}
        labels={{
          amount: t(locale, "amountPlaceholder"),
          merchant: t(locale, "merchantPlaceholder"),
          category: t(locale, "categories"),
          none: t(locale, "categoryNone").replace("— ", ""),
          note: t(locale, "notePlaceholder").replace(" (по избор)", "").replace(" (optional)", ""),
          noteOptional: t(locale, "notePlaceholder"),
          date: t(locale, "when"),
          delete: t(locale, "delete"),
          save: t(locale, "save"),
          saving: t(locale, "save"),
          confirmDelete: t(locale, "delete") + "?",
        }}
        onSave={save}
        onDelete={remove}
      />
    </main>
  );
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${mm}`;
}
