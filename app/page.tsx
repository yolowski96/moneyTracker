import { getSettings, getCycleBounds } from "@/lib/cycle";
import { getActiveCategories, getCategory } from "@/lib/categories";
import { t } from "@/lib/i18n";
import { requireUser } from "@/lib/session";
import {
  getCycleIncomeEvents,
  getCycleTransactions,
  getPendingCount,
  getRecentTransactions,
} from "@/lib/queries";
import { addTransaction, runRecurring } from "./actions";
import { AppHeader } from "./app-header";
import { CycleSummary } from "./cycle-summary";
import { AddTransactionForm } from "./add-form";
import { CategorySpending } from "./category-spending";
import { TransactionList } from "./transaction-list";
import { RecurringTrigger } from "./recurring-trigger";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { id: userId, email: userEmail } = await requireUser();

  const settingsPromise = getSettings(userId);
  const recentPromise = getRecentTransactions(userId, 200);
  const pendingPromise = getPendingCount(userId);
  const categoriesPromise = getActiveCategories(userId);

  const settings = await settingsPromise;
  const cycle = getCycleBounds(settings);
  const locale = settings.locale;
  const userCurrency = settings.currency;

  const [cycleTransactions, recentTransactions, pendingCount, cycleIncome, categories] =
    await Promise.all([
      getCycleTransactions(userId, cycle.start.toISOString(), cycle.end.toISOString()),
      recentPromise,
      pendingPromise,
      getCycleIncomeEvents(userId, cycle.start.toISOString(), cycle.end.toISOString()),
      categoriesPromise,
    ]);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  // Also include archived for display lookup of historical txns
  const allCategoriesForLookup = await Promise.all(
    [...new Set(cycleTransactions.map((t) => t.category).filter(Boolean) as string[])]
      .filter((id) => !categoryById.has(id))
      .map((id) => getCategory(userId, id)),
  );
  for (const c of allCategoriesForLookup) {
    if (c) categoryById.set(c.id, c);
  }

  const sp = await searchParams;
  const requestedPage = Number.parseInt(String(sp?.p ?? "1"), 10);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      <RecurringTrigger action={runRecurring} />
      <AppHeader
        current="home"
        locale={locale}
        userEmail={userEmail}
        pendingCount={pendingCount}
        title={t(locale, "appName")}
        tagline={t(locale, "tagline")}
      />

      <CycleSummary
        locale={locale}
        currency={userCurrency}
        cycle={cycle}
        period={settings.period}
        baseIncome={settings.incomeAmount}
        transactions={cycleTransactions}
        income={cycleIncome}
      />

      <AddTransactionForm
        action={addTransaction}
        categories={categories}
        locale={locale}
        labels={{
          merchant: t(locale, "merchantPlaceholder"),
          add: t(locale, "add"),
          adding: t(locale, "add"),
        }}
      />

      <div className="mt-3.5 grid items-stretch gap-3.5 lg:grid-cols-2">
        <CategorySpending
          locale={locale}
          currency={userCurrency}
          transactions={cycleTransactions}
          categories={categories}
          categoryById={categoryById}
        />
        <TransactionList
          locale={locale}
          currency={userCurrency}
          transactions={recentTransactions}
          requestedPage={requestedPage}
          categoryById={categoryById}
        />
      </div>
    </main>
  );
}
