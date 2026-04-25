import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { userIncomeTag } from "@/lib/cache-tags";
import { log } from "@/lib/log";
import { getSettings } from "@/lib/cycle";
import { requireUserId } from "@/lib/session";
import { t } from "@/lib/i18n";
import { currencySymbol } from "@/lib/format";
import { ThemeToggle } from "../../../theme-toggle";
import { IncomeEditForm } from "./form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditIncomePage({ params }: PageProps) {
  const userId = await requireUserId();
  const { id } = await params;

  const [income, settings] = await Promise.all([
    prisma.incomeEvent.findFirst({ where: { id, userId } }),
    getSettings(userId),
  ]);
  if (!income) notFound();
  const locale = settings.locale;

  async function save(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();

    const id = String(formData.get("id") ?? "");
    if (!id) {
      log("action.income.edit.save", 400, "missing_id", "no id in form");
      return;
    }

    const amount = Number(formData.get("amount"));
    const note = String(formData.get("note") ?? "").trim();
    const occurredAtRaw = String(formData.get("occurredAt") ?? "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      log("action.income.edit.save", 400, "invalid_amount", "amount must be a positive finite number", {
        id,
        amountRaw: formData.get("amount"),
      });
      return;
    }

    const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : undefined;
    if (occurredAt && Number.isNaN(occurredAt.getTime())) {
      log("action.income.edit.save", 400, "invalid_occurred_at", "unparseable datetime-local value", {
        id,
        occurredAtRaw,
      });
      return;
    }

    const result = await prisma.incomeEvent.updateMany({
      where: { id, userId: uid },
      data: {
        amount: Math.round(amount * 100),
        note: note || null,
        ...(occurredAt ? { occurredAt } : {}),
      },
    });

    log("action.income.edit.save", result.count ? 200 : 404, result.count ? "updated" : "not_owned", `income event ${id}`, {
      id,
      amount: Math.round(amount * 100),
      note: note || null,
      userId: uid,
      count: result.count,
    });

    updateTag(userIncomeTag(uid));
    redirect("/");
  }

  async function remove(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const id = String(formData.get("id") ?? "");
    if (!id) {
      log("action.income.edit.remove", 400, "missing_id", "no id in form");
      return;
    }
    const result = await prisma.incomeEvent.deleteMany({
      where: { id, userId: uid },
    });
    log("action.income.edit.remove", result.count ? 200 : 404, result.count ? "deleted" : "not_owned", `income event ${id}`, {
      id,
      userId: uid,
      count: result.count,
    });
    updateTag(userIncomeTag(uid));
    redirect("/");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t(locale, "editIncome")}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {t(locale, "added")} {income.createdAt.toLocaleString("en-IE")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            {"\u2190"} {t(locale, "cancel")}
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <IncomeEditForm
        initial={{
          id: income.id,
          amount: (income.amount / 100).toFixed(2),
          note: income.note ?? "",
          occurredAt: toLocalInputValue(income.occurredAt),
        }}
        currencySymbol={currencySymbol(locale, income.currency)}
        labels={{
          amount: t(locale, "amountPlaceholder"),
          note: t(locale, "note"),
          notePlaceholder: t(locale, "noteIncomeExample"),
          date: t(locale, "date"),
          dateHint: t(locale, "determinesCycle"),
          delete: t(locale, "delete"),
          save: t(locale, "save"),
          saving: t(locale, "saving"),
          confirmDelete: t(locale, "confirmDeleteIncome"),
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
