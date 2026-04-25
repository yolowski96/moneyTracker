import Link from "next/link";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatAmount, formatDateTime } from "@/lib/format";
import { getActiveCategories } from "@/lib/categories";
import { userTxnTag } from "@/lib/cache-tags";
import { log } from "@/lib/log";
import { getPendingTransactions } from "@/lib/queries";
import { getSettings } from "@/lib/cycle";
import { requireUser } from "@/lib/session";
import { LogoutButton } from "../logout-button";
import { t } from "@/lib/i18n";
import { ThemeToggle } from "../theme-toggle";
import { MobileMenu } from "../mobile-menu";
import { PendingRow } from "./pending-row";

export default async function InboxPage() {
  const { id: userId, email: userEmail } = await requireUser();
  const [pending, settings, categories] = await Promise.all([
    getPendingTransactions(userId),
    getSettings(userId),
    getActiveCategories(userId),
  ]);
  const locale = settings.locale;

  async function setCategory(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const id = String(formData.get("id") ?? "");
    const categoryId = String(formData.get("categoryId") ?? "");
    if (!id || !categoryId) {
      log("action.inbox.setCategory", 400, "missing_input", "id or categoryId missing", {
        hasId: !!id,
        hasCategoryId: !!categoryId,
      });
      return;
    }
    const cat = await prisma.category.findFirst({
      where: { id: categoryId, userId: uid },
    });
    if (!cat) {
      log("action.inbox.setCategory", 400, "unknown_category", `${categoryId} not owned by user`, {
        categoryId,
        id,
        userId: uid,
      });
      return;
    }
    const result = await prisma.transaction.updateMany({
      where: { id, userId: uid },
      data: { category: categoryId },
    });
    log("action.inbox.setCategory", result.count ? 200 : 404, result.count ? "categorized" : "not_owned", `transaction ${id} -> ${categoryId}`, {
      id,
      categoryId,
      userId: uid,
      count: result.count,
    });
    updateTag(userTxnTag(uid));
  }

  async function deletePending(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const id = String(formData.get("id") ?? "");
    if (!id) {
      log("action.inbox.deletePending", 400, "missing_id", "no id in form");
      return;
    }
    const result = await prisma.transaction.deleteMany({
      where: { id, userId: uid },
    });
    log("action.inbox.deletePending", result.count ? 200 : 404, result.count ? "deleted" : "not_owned", `transaction ${id}`, {
      id,
      userId: uid,
      count: result.count,
    });
    updateTag(userTxnTag(uid));
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <header className="mb-10">
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <MobileMenu
            ariaLabel={t(locale, "menu")}
            title={t(locale, "appName")}
            userEmail={userEmail}
            signOutLabel={t(locale, "signOut")}
            items={[
              { href: "/", label: t(locale, "appName") },
              { href: "/charts", label: t(locale, "charts") },
              { href: "/settings", label: t(locale, "settings") },
            ]}
          />
          <div className="min-w-0 flex-1 text-center text-base font-semibold tracking-tight">
            {t(locale, "appName")}
          </div>
          <ThemeToggle />
        </div>
        <div className="mt-6 sm:mt-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{t(locale, "inbox")}</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {t(locale, "inboxTagline")}
            </p>
          </div>
          <nav className="hidden flex-wrap items-center justify-end gap-3 sm:flex">
            <Link
              href="/charts"
              className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              {t(locale, "charts")}
            </Link>
            <Link
              href="/settings"
              className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              {t(locale, "settings")}
            </Link>
            <Link
              href="/"
              className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              {"\u2190"} {t(locale, "back")}
            </Link>
            <LogoutButton label={t(locale, "signOut")} />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {pending.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[color:var(--border)] p-10 text-center text-sm text-[color:var(--muted)]">
          {t(locale, "inboxZero")} {"\u{1F389}"}
          <div className="mt-2 text-xs">
            {t(locale, "inboxZeroHint")}
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((tx) => (
            <PendingRow
              key={tx.id}
              transaction={{
                id: tx.id,
                merchant: tx.merchant,
                amount: formatAmount(tx.amount, locale, tx.currency),
                note: tx.note,
                source: tx.source,
                occurredAtLabel: formatDateTime(tx.occurredAt, locale),
              }}
              categories={categories}
              labels={{ edit: t(locale, "edit"), dismiss: t(locale, "remove") }}
              onCategorize={setCategory}
              onDelete={deletePending}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
