import Link from "next/link";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings, getCycleBounds, type Period } from "@/lib/cycle";
import { getAllCategories } from "@/lib/categories";
import { generateApiToken } from "@/lib/auth";
import { requireUserId } from "@/lib/session";
import {
  userSettingsTag,
  userTxnTag,
  userCategoriesTag,
} from "@/lib/cache-tags";
import { log } from "@/lib/log";
import { t, isLocale, isCurrency, LOCALES, CURRENCIES } from "@/lib/i18n";
import { currencySymbol } from "@/lib/format";
import { SettingsForm } from "./form";
import { ApiKeyCard } from "./api-key-card";
import { CategoriesCard } from "./categories-card";
import { ThemeToggle } from "../theme-toggle";
import { MobileMenu } from "../mobile-menu";
import { LogoutButton } from "../logout-button";

const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_BG = ["нед", "пон", "вто", "сря", "чет", "пет", "съб"];
const MONTHS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_BG = [
  "яну", "фев", "мар", "апр", "май", "юни",
  "юли", "авг", "сеп", "окт", "ное", "дек",
];

export default async function SettingsPage() {
  const userId = await requireUserId();
  const [settings, categories, user] = await Promise.all([
    getSettings(userId),
    getAllCategories(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { apiToken: true, email: true } }),
  ]);
  const cycle = getCycleBounds(settings);
  const locale = settings.locale;
  const weekdayLabels = locale === "bg" ? WEEKDAYS_BG : WEEKDAYS_EN;
  const monthLabels = locale === "bg" ? MONTHS_BG : MONTHS_EN;
  const periodAdj = t(
    locale,
    settings.period === "week"
      ? "weekly"
      : settings.period === "year"
        ? "yearly"
        : "monthly",
  );

  async function save(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();

    const period = String(formData.get("period") ?? "month") as Period;
    const monthlyResetDay = clamp(
      parseInt(String(formData.get("monthlyResetDay") ?? "1"), 10),
      1,
      31,
    );
    const weeklyResetDay = clamp(
      parseInt(String(formData.get("weeklyResetDay") ?? "1"), 10),
      0,
      6,
    );
    const yearlyResetMonth = clamp(
      parseInt(String(formData.get("yearlyResetMonth") ?? "1"), 10),
      1,
      12,
    );
    const yearlyResetDay = clamp(
      parseInt(String(formData.get("yearlyResetDay") ?? "1"), 10),
      1,
      31,
    );

    const incomeRaw = Number(formData.get("incomeAmount") ?? 0);
    const incomeAmount = Number.isFinite(incomeRaw) && incomeRaw > 0
      ? Math.round(incomeRaw * 100)
      : 0;

    const localeRaw = String(formData.get("locale") ?? "en");
    const currencyRaw = String(formData.get("currency") ?? "EUR");

    const data = {
      period: ["week", "month", "year"].includes(period) ? period : "month",
      monthlyResetDay,
      weeklyResetDay,
      yearlyResetMonth,
      yearlyResetDay,
      incomeAmount,
      locale: isLocale(localeRaw) ? localeRaw : "en",
      currency: isCurrency(currencyRaw) ? currencyRaw : "EUR",
    };
    await prisma.settings.upsert({
      where: { userId: uid },
      update: data,
      create: { userId: uid, ...data },
    });

    log("action.settings.save", 200, "saved", `period=${data.period}`, {
      userId: uid,
      period: data.period,
      incomeAmount: data.incomeAmount,
      locale: data.locale,
      currency: data.currency,
    });

    updateTag(userSettingsTag(uid));
    updateTag(userTxnTag(uid));
    redirect("/");
  }

  async function regenerateApiToken() {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const token = generateApiToken();
    const previous = await prisma.user.findUnique({
      where: { id: uid },
      select: { apiToken: true },
    });
    await prisma.user.update({
      where: { id: uid },
      data: { apiToken: token },
    });
    log("action.settings.regenerateApiToken", 200, previous?.apiToken ? "rotated" : "generated", "api token updated", {
      userId: uid,
      hadPrevious: !!previous?.apiToken,
      tokenPreview: token.slice(0, 4) + "…" + token.slice(-4),
    });
    updateTag(userSettingsTag(uid));
  }

  async function addCategory(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const emoji = String(formData.get("emoji") ?? "").trim();
    const label = String(formData.get("label") ?? "").trim();
    if (!emoji || !label) {
      log("action.settings.addCategory", 400, "missing_input", "emoji or label missing");
      return;
    }
    const maxPos = await prisma.category.aggregate({
      where: { userId: uid },
      _max: { position: true },
    });
    await prisma.category.create({
      data: {
        userId: uid,
        emoji,
        label,
        position: (maxPos._max.position ?? 0) + 1,
      },
    });
    log("action.settings.addCategory", 200, "created", `${emoji} ${label}`, {
      emoji,
      label,
      userId: uid,
    });
    updateTag(userCategoriesTag(uid));
  }

  async function renameCategory(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const id = String(formData.get("id") ?? "");
    const emoji = String(formData.get("emoji") ?? "").trim();
    const label = String(formData.get("label") ?? "").trim();
    if (!id || !emoji || !label) {
      log("action.settings.renameCategory", 400, "missing_input", "id, emoji, or label missing");
      return;
    }
    const result = await prisma.category.updateMany({
      where: { id, userId: uid },
      data: { emoji, label },
    });
    log("action.settings.renameCategory", result.count ? 200 : 404, result.count ? "renamed" : "not_owned", `${id} -> ${emoji} ${label}`, {
      id,
      emoji,
      label,
      userId: uid,
      count: result.count,
    });
    updateTag(userCategoriesTag(uid));
  }

  async function archiveCategory(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await prisma.category.updateMany({
      where: { id, userId: uid },
      data: { archived: true },
    });
    log("action.settings.archiveCategory", 200, "archived", id, { id, userId: uid });
    updateTag(userCategoriesTag(uid));
  }

  async function restoreCategory(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await prisma.category.updateMany({
      where: { id, userId: uid },
      data: { archived: false },
    });
    log("action.settings.restoreCategory", 200, "restored", id, { id, userId: uid });
    updateTag(userCategoriesTag(uid));
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <header className="mb-10">
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <MobileMenu
            ariaLabel={t(locale, "menu")}
            title={t(locale, "appName")}
            userEmail={user?.email ?? null}
            signOutLabel={t(locale, "signOut")}
            items={[
              { href: "/", label: t(locale, "appName") },
              { href: "/inbox", label: t(locale, "inbox") },
              { href: "/charts", label: t(locale, "charts") },
            ]}
          />
          <div className="min-w-0 flex-1 text-center text-base font-semibold tracking-tight">
            {t(locale, "appName")}
          </div>
          <ThemeToggle />
        </div>
        <div className="mt-6 sm:mt-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t(locale, "settings")}
            </h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {t(locale, "settingsTagline")}
            </p>
            {user?.email && (
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                {user.email}
              </p>
            )}
          </div>
          <nav className="hidden flex-wrap items-center justify-end gap-3 sm:flex">
            <Link
              href="/inbox"
              className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              {t(locale, "inbox")}
            </Link>
            <Link
              href="/charts"
              className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              {t(locale, "charts")}
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

      <div className="divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
                {t(locale, "cycleAndIncome")}
              </div>
              <div className="mt-0.5 text-[color:var(--muted)]">
                {cycle.label}
              </div>
            </div>
            <span
              aria-hidden
              className="text-[color:var(--muted)] transition-transform group-open:rotate-90"
            >
              {"\u203A"}
            </span>
          </summary>
          <div className="space-y-6 border-t border-[color:var(--border)] px-4 py-4">
            <p className="text-sm text-[color:var(--muted)]">
              {t(locale, "cycleDescribe")}
            </p>
            <SettingsForm
              initial={settings}
              currencySymbol={currencySymbol(locale, settings.currency)}
              locales={LOCALES}
              currencies={CURRENCIES}
              weekdayLabels={weekdayLabels}
              monthLabels={monthLabels}
              periodAdjective={periodAdj}
              labels={{
                trackBy: t(locale, "trackBy"),
                week: t(locale, "week"),
                month: t(locale, "month"),
                year: t(locale, "year"),
                weekHint: t(locale, "weekHint"),
                monthHint: t(locale, "monthHint"),
                yearHint: t(locale, "yearHint"),
                periodIncome: t(locale, "periodIncome"),
                incomeDescription: t(locale, "incomeDescription"),
                resetDay: t(locale, "resetDay"),
                salaryResetDay: t(locale, "salaryResetDay"),
                salaryResetHint: t(locale, "salaryResetHint"),
                resetMonth: t(locale, "resetMonth"),
                language: t(locale, "language"),
                currency: t(locale, "currency"),
                save: t(locale, "save"),
                saving: t(locale, "saving"),
                resetNote: t(locale, "resetNote"),
              }}
              action={save}
            />
          </div>
        </details>

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
                {t(locale, "categories")}
              </div>
              <div className="mt-0.5 text-[color:var(--muted)]">
                {categories.filter((c) => !c.archived).length} {t(locale, "activeCategories").toLowerCase()}
              </div>
            </div>
            <span
              aria-hidden
              className="text-[color:var(--muted)] transition-transform group-open:rotate-90"
            >
              {"\u203A"}
            </span>
          </summary>
          <div className="space-y-4 border-t border-[color:var(--border)] px-4 py-4">
            <p className="text-sm text-[color:var(--muted)]">
              {t(locale, "categoriesDescribe")}
            </p>
            <CategoriesCard
              categories={categories}
              labels={{
                emoji: t(locale, "emoji"),
                label: t(locale, "label"),
                emojiPlaceholder: t(locale, "emojiPlaceholder"),
                labelPlaceholder: t(locale, "labelPlaceholder"),
                addCategory: t(locale, "addCategory"),
                activeCategories: t(locale, "activeCategories"),
                archived: t(locale, "archived"),
                archive: t(locale, "archive"),
                restore: t(locale, "restore"),
                rename: t(locale, "rename"),
                save: t(locale, "save"),
                cancel: t(locale, "cancel"),
                noCategories: t(locale, "noCategories"),
                noArchived: t(locale, "noArchived"),
              }}
              onAdd={addCategory}
              onRename={renameCategory}
              onArchive={archiveCategory}
              onRestore={restoreCategory}
            />
          </div>
        </details>

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
                {t(locale, "apiAccess")}
              </div>
              <div className="mt-0.5 text-[color:var(--muted)]">
                {user?.apiToken ? t(locale, "keyConfigured") : t(locale, "noKeyYet")}
              </div>
            </div>
            <span
              aria-hidden
              className="text-[color:var(--muted)] transition-transform group-open:rotate-90"
            >
              {"\u203A"}
            </span>
          </summary>
          <div className="space-y-4 border-t border-[color:var(--border)] px-4 py-4">
            <p className="text-sm text-[color:var(--muted)]">
              {t(locale, "apiKeyDescribe")}{" "}
              <code className="font-mono text-xs">/api/transactions</code>.
            </p>
            <ApiKeyCard
              token={user?.apiToken ?? null}
              labels={{
                yourKey: t(locale, "apiKeyHeader"),
                noKeyYet: t(locale, "noKeyYet"),
                noKeyHint: t(locale, "noKeyHint"),
                show: t(locale, "show"),
                hide: t(locale, "hide"),
                copy: t(locale, "copy"),
                copied: t(locale, "copied"),
                regenerate: t(locale, "regenerate"),
                regenerating: t(locale, "regenerating"),
                generate: t(locale, "generateKey"),
                generating: t(locale, "generating"),
                regenerateWarn: t(locale, "regenerateWarn"),
              }}
              action={regenerateApiToken}
            />
          </div>
        </details>
      </div>
    </main>
  );
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
