import Link from "next/link";
import { updateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSettings, getCycleBounds } from "@/lib/cycle";
import { requireUser } from "@/lib/session";
import { userSavingsTag, userNetWorthTag, userSettingsTag } from "@/lib/cache-tags";
import { log } from "@/lib/log";
import { t, type Locale } from "@/lib/i18n";
import {
  bcp47,
  formatAmount,
  formatAmountWhole,
  formatDateShort,
  parseAmount,
  currencySymbol,
} from "@/lib/format";
import { fetchPortfolio, type Position } from "@/lib/portfolio";
import {
  getSavingsAccounts,
  getSnapshots,
  materializeSurplus,
  upsertSnapshot,
  CASH_KIND,
} from "@/lib/savings";
import { getPendingCount } from "@/lib/queries";
import { AppHeader } from "../app-header";
import { RecurringTrigger } from "../recurring-trigger";
import { AllocationPie, PIE_PALETTE, type PieSlice } from "./allocation-pie";

const INPUT_CLS =
  "w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--foreground)]/30";
const FIELD_CLS = "flex min-w-0 flex-col gap-1 text-xs text-[color:var(--muted)]";

function getUserToken(userId: string) {
  const fn = unstable_cache(
    (uid: string) =>
      prisma.user.findUnique({
        where: { id: uid },
        select: { apiToken: true },
      }),
    ["user:token:v1", userId],
    { tags: [userSettingsTag(userId)] },
  );
  return fn(userId);
}

// Quantities come back with broker precision (0.0834084462); six significant
// digits is plenty for display.
function formatQty(n: number, locale: Locale): string {
  return new Intl.NumberFormat(bcp47(locale), {
    maximumSignificantDigits: 6,
  }).format(n);
}

function plClass(cents: number): string {
  if (cents > 0) return "text-emerald-500";
  if (cents < 0) return "text-red-500";
  return "text-[color:var(--muted)]";
}

function signed(cents: number, locale: Parameters<typeof formatAmount>[1], currency: string): string {
  return (cents >= 0 ? "+" : "") + formatAmount(cents, locale, currency);
}

export default async function PortfolioPage() {
  const { id: userId, email: userEmail } = await requireUser();

  const [settings, pendingCount, userMeta] = await Promise.all([
    getSettings(userId),
    getPendingCount(userId),
    getUserToken(userId),
  ]);
  const locale = settings.locale;
  const userCurrency = settings.currency;

  const [accounts, snapshots, portfolioRes] = await Promise.all([
    getSavingsAccounts(userId),
    getSnapshots(userId, 12),
    fetchPortfolio(settings.portfolioApiUrl, userMeta?.apiToken),
  ]);

  const savingsTotal = accounts.reduce((s, a) => s + a.balance, 0);
  const latestSnap = snapshots[0] ?? null;

  const live = portfolioRes.ok ? portfolioRes.portfolio : null;
  const notConfigured = !portfolioRes.ok && portfolioRes.error === "not_configured";
  const apiDown = !portfolioRes.ok && !notConfigured;

  // Fallback: when the API is down, show the last snapshot's investment value.
  const investments = live
    ? live.valueCents
    : apiDown && latestSnap
      ? latestSnap.investments
      : null;
  const netWorth = (investments ?? 0) + savingsTotal;

  // Value captured at render — the maintenance action snapshots exactly what
  // the user saw. null (API down/not configured) skips the snapshot so the
  // fallback source is never overwritten with a zero.
  const investmentsForSnapshot = live ? live.valueCents : null;

  async function runMaintenance() {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const settingsRow = await getSettings(uid);
    const changed = await materializeSurplus(uid, settingsRow);
    if (changed > 0) updateTag(userSavingsTag(uid));
    if (investmentsForSnapshot !== null) {
      const sum = await prisma.savingsAccount.aggregate({
        _sum: { balance: true },
        where: { userId: uid, archived: false },
      });
      const cycleNow = getCycleBounds(settingsRow);
      const ok = await upsertSnapshot(
        uid,
        cycleNow.start,
        investmentsForSnapshot,
        sum._sum.balance ?? 0,
      );
      if (ok) updateTag(userNetWorthTag(uid));
    }
  }

  async function addAccount(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const name = String(formData.get("name") ?? "").trim();
    const emoji = String(formData.get("emoji") ?? "").trim();
    const balanceRaw = parseAmount(formData.get("balance"));
    const balance = Number.isFinite(balanceRaw) ? Math.round(balanceRaw * 100) : 0;
    if (!name) {
      log("action.savings.create", 400, "invalid_input", "empty name", { userId: uid });
      return;
    }
    const max = await prisma.savingsAccount.aggregate({
      _max: { position: true },
      where: { userId: uid },
    });
    const row = await prisma.savingsAccount.create({
      data: {
        userId: uid,
        name,
        emoji: emoji || "💰",
        balance,
        position: (max._max.position ?? 0) + 1,
      },
    });
    log("action.savings.create", 201, "created", `account ${row.id}`, {
      id: row.id,
      userId: uid,
    });
    updateTag(userSavingsTag(uid));
  }

  async function updateAccount(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const emoji = String(formData.get("emoji") ?? "").trim();
    const balanceRaw = parseAmount(formData.get("balance"));
    if (!id || !Number.isFinite(balanceRaw)) {
      log("action.savings.update", 400, "invalid_input", "id or balance unusable", {
        id,
        userId: uid,
      });
      return;
    }
    const row = await prisma.savingsAccount.findFirst({
      where: { id, userId: uid },
      select: { kind: true },
    });
    if (!row) {
      log("action.savings.update", 404, "not_owned", `account ${id}`, { userId: uid });
      return;
    }
    // The cash account keeps its identity — only the balance is adjustable.
    const data =
      row.kind === CASH_KIND
        ? { balance: Math.round(balanceRaw * 100) }
        : {
            name: name || undefined,
            emoji: emoji || undefined,
            balance: Math.round(balanceRaw * 100),
          };
    await prisma.savingsAccount.update({ where: { id }, data });
    log("action.savings.update", 200, "updated", `account ${id}`, { id, userId: uid });
    updateTag(userSavingsTag(uid));
  }

  async function deleteAccount(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    // The auto cash account is not deletable.
    const result = await prisma.savingsAccount.deleteMany({
      where: { id, userId: uid, kind: { not: CASH_KIND } },
    });
    log("action.savings.delete", result.count ? 200 : 404, result.count ? "deleted" : "not_owned", `account ${id}`, {
      id,
      userId: uid,
      count: result.count,
    });
    updateTag(userSavingsTag(uid));
  }

  // ----- Allocation slices: positions + savings accounts (positive values only)
  const slices: PieSlice[] = [];
  const rawSlices: { label: string; value: number }[] = [
    ...(live?.positions ?? []).map((p) => ({ label: p.ticker, value: p.valueCents })),
    ...accounts.map((a) => ({
      label:
        a.kind === CASH_KIND
          ? `${a.emoji} ${t(locale, "cashAccount")}`
          : `${a.emoji} ${a.name}`,
      value: a.balance,
    })),
  ].filter((s) => s.value > 0);
  const sliceTotal = rawSlices.reduce((s, x) => s + x.value, 0);
  if (sliceTotal > 0) {
    rawSlices.sort((a, b) => b.value - a.value);
    let other = 0;
    for (const s of rawSlices) {
      if (s.value / sliceTotal < 0.01 || slices.length >= PIE_PALETTE.length - 1) {
        other += s.value;
      } else {
        slices.push({ ...s, color: PIE_PALETTE[slices.length] });
      }
    }
    if (other > 0) {
      slices.push({
        label: t(locale, "otherSlice"),
        value: other,
        color: "#9ca3af",
      });
    }
  }

  const historyAsc = [...snapshots].reverse();
  const historyMax = Math.max(1, ...historyAsc.map((s) => s.total));

  const positions: Position[] = live?.positions ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <AppHeader
        current="portfolio"
        locale={locale}
        userEmail={userEmail}
        pendingCount={pendingCount}
        title={t(locale, "portfolio")}
        tagline={t(locale, "portfolioTagline")}
      />
      <RecurringTrigger action={runMaintenance} />

      {notConfigured && (
        <div className="mb-6 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--muted)]">
          {t(locale, "portfolioNotConfigured")}{" "}
          <Link href="/settings" className="underline hover:text-[color:var(--foreground)]">
            {t(locale, "settings")}
          </Link>
        </div>
      )}
      {apiDown && (
        <div className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {latestSnap
            ? `${t(locale, "portfolioApiDown")} (${t(locale, "asOf", {
                date: formatDateShort(latestSnap.capturedAt, locale),
              })})`
            : t(locale, "portfolioApiDownNoData")}
        </div>
      )}

      {/* Summary */}
      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <div className="text-xs text-[color:var(--muted)]">{t(locale, "netWorth")}</div>
          <div className="mt-1 text-2xl font-medium tabular-nums">
            {formatAmount(netWorth, locale, userCurrency)}
          </div>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <div className="text-xs text-[color:var(--muted)]">{t(locale, "investments")}</div>
          <div className="mt-1 text-2xl font-medium tabular-nums">
            {investments !== null ? formatAmount(investments, locale, userCurrency) : "—"}
          </div>
          {live && live.plPct !== null && (
            <div className={"mt-1 text-xs tabular-nums " + plClass(live.plCents)}>
              {signed(live.plCents, locale, userCurrency)} ({live.plPct.toFixed(1)}%)
            </div>
          )}
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <div className="text-xs text-[color:var(--muted)]">{t(locale, "savingsLabel")}</div>
          <div className="mt-1 text-2xl font-medium tabular-nums">
            {formatAmount(savingsTotal, locale, userCurrency)}
          </div>
        </div>
      </section>

      {/* Allocation pie */}
      {slices.length > 0 && (
        <section className="mb-6 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <div className="mb-4 text-xs uppercase tracking-widest text-[color:var(--muted)]">
            {t(locale, "allocation")}
          </div>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <AllocationPie
              slices={slices}
              centerLabel={t(locale, "netWorth")}
              centerValue={formatAmountWhole(sliceTotal, locale, userCurrency)}
            />
            <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
              {slices.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  <span className="font-mono text-xs tabular-nums text-[color:var(--muted)]">
                    {((s.value / sliceTotal) * 100).toFixed(1)}%
                  </span>
                  <span className="w-24 text-right font-mono text-xs tabular-nums">
                    {formatAmountWhole(s.value, locale, userCurrency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Positions */}
      <section className="mb-6 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <div className="mb-4 text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {t(locale, "positions")}
        </div>
        {positions.length === 0 ? (
          <div className="py-6 text-center text-sm text-[color:var(--muted)]">
            {t(locale, "noPositions")}
          </div>
        ) : (
          <>
            {/* Desktop table (scrolls horizontally rather than crushing columns) */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[color:var(--muted)]">
                    <th className="pb-2 pr-4 font-normal">{t(locale, "ticker")}</th>
                    <th className="pb-2 pl-3 text-right font-normal">{t(locale, "qty")}</th>
                    <th className="pb-2 pl-3 text-right font-normal">{t(locale, "avgPrice")}</th>
                    <th className="pb-2 pl-3 text-right font-normal">{t(locale, "price")}</th>
                    <th className="pb-2 pl-3 text-right font-normal">{t(locale, "value")}</th>
                    <th className="pb-2 pl-3 text-right font-normal">{t(locale, "profitLoss")}</th>
                    <th className="pb-2 pl-3 text-right font-normal">{t(locale, "allocShare")}</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.ticker} className="border-t border-[color:var(--border)]">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{p.ticker}</div>
                        {p.name !== p.ticker && (
                          <div className="max-w-36 truncate text-xs text-[color:var(--muted)]">
                            {p.name}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 text-right font-mono text-xs tabular-nums">
                        {formatQty(p.quantity, locale)}
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 text-right font-mono text-xs tabular-nums">
                        {formatAmount(p.avgPriceCents, locale, userCurrency)}
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 text-right font-mono text-xs tabular-nums">
                        {formatAmount(p.currentPriceCents, locale, userCurrency)}
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 text-right font-mono text-xs tabular-nums">
                        {formatAmount(p.valueCents, locale, userCurrency)}
                      </td>
                      <td className={"whitespace-nowrap py-3 pl-3 text-right font-mono text-xs tabular-nums " + plClass(p.plCents)}>
                        {signed(p.plCents, locale, userCurrency)}
                        {p.plPct !== null && (
                          <span className="block text-[10px]">
                            {(p.plPct >= 0 ? "+" : "") + p.plPct.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 text-right font-mono text-xs tabular-nums text-[color:var(--muted)]">
                        {live && live.valueCents > 0
                          ? ((p.valueCents / live.valueCents) * 100).toFixed(1) + "%"
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="space-y-3 sm:hidden">
              {positions.map((p) => (
                <li
                  key={p.ticker}
                  className="rounded-md border border-[color:var(--border)] p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-medium">{p.ticker}</span>
                      {p.name !== p.ticker && (
                        <span className="ml-2 text-xs text-[color:var(--muted)]">{p.name}</span>
                      )}
                    </div>
                    <div className="font-mono text-sm tabular-nums">
                      {formatAmount(p.valueCents, locale, userCurrency)}
                    </div>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2 text-xs text-[color:var(--muted)]">
                    <span className="font-mono tabular-nums">
                      {formatQty(p.quantity, locale)} × {formatAmount(p.currentPriceCents, locale, userCurrency)}
                    </span>
                    <span className={"font-mono tabular-nums " + plClass(p.plCents)}>
                      {signed(p.plCents, locale, userCurrency)}
                      {p.plPct !== null &&
                        ` (${(p.plPct >= 0 ? "+" : "") + p.plPct.toFixed(1)}%)`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Savings accounts */}
      <section className="mb-6 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            {t(locale, "savingsAccounts")}
          </div>
          <div className="font-mono text-xs tabular-nums text-[color:var(--muted)]">
            {formatAmount(savingsTotal, locale, userCurrency)}
          </div>
        </div>

        <ul className="space-y-3">
          {accounts.map((a) => {
            const isCash = a.kind === CASH_KIND;
            const label = isCash ? t(locale, "cashAccount") : a.name;
            return (
              <li key={a.id} className="rounded-md border border-[color:var(--border)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 truncate">
                    <span aria-hidden className="mr-2">{a.emoji}</span>
                    {label}
                    {isCash && (
                      <span className="ml-2 rounded-sm bg-[color:var(--border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[color:var(--muted)]">
                        {t(locale, "autoBadge")}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 font-mono text-sm tabular-nums">
                    {formatAmount(a.balance, locale, userCurrency)}
                  </div>
                </div>
                {isCash && (
                  <div className="mt-1 text-xs text-[color:var(--muted)]">
                    {t(locale, "autoCashHint")}
                  </div>
                )}
                {/* Keyed on the editable fields: a successful save changes the
                    key, remounting the details element closed. */}
                <details
                  key={`${a.id}:${a.balance}:${a.name}:${a.emoji}`}
                  className="group mt-2"
                >
                  <summary className="cursor-pointer list-none text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]">
                    {t(locale, "edit")}
                  </summary>
                  <form
                    action={updateAccount}
                    className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"
                  >
                    <input type="hidden" name="id" value={a.id} />
                    {!isCash && (
                      <>
                        <label className={FIELD_CLS}>
                          {t(locale, "label")}
                          <input
                            type="text"
                            name="name"
                            required
                            defaultValue={a.name}
                            className={INPUT_CLS}
                          />
                        </label>
                        <label className={FIELD_CLS}>
                          {t(locale, "emoji")}
                          <input
                            type="text"
                            name="emoji"
                            defaultValue={a.emoji}
                            className={INPUT_CLS}
                          />
                        </label>
                      </>
                    )}
                    <label className={FIELD_CLS}>
                      {t(locale, "balance")} ({currencySymbol(locale, userCurrency)})
                      <input
                        type="text"
                        name="balance"
                        inputMode="decimal"
                        required
                        defaultValue={(a.balance / 100).toFixed(2)}
                        className={INPUT_CLS}
                      />
                    </label>
                    <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
                      <button
                        type="submit"
                        className="rounded-md bg-[color:var(--foreground)] px-3 py-2 text-xs font-medium text-[color:var(--background)]"
                      >
                        {t(locale, "save")}
                      </button>
                      {!isCash && (
                        <button
                          type="submit"
                          formAction={deleteAccount}
                          className="rounded-md border border-red-500/40 px-3 py-2 text-xs text-red-500"
                        >
                          {t(locale, "delete")}
                        </button>
                      )}
                    </div>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>

        {/* Keyed on the list length so a successful add closes and resets the form. */}
        <details
          key={`add:${accounts.length}`}
          className="group mt-4 border-t border-[color:var(--border)] pt-4"
        >
          <summary className="cursor-pointer list-none text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]">
            {t(locale, "addAccount")}
          </summary>
          <form action={addAccount} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className={FIELD_CLS}>
              {t(locale, "label")}
              <input
                type="text"
                name="name"
                required
                placeholder={t(locale, "accountNamePlaceholder")}
                className={INPUT_CLS}
              />
            </label>
            <label className={FIELD_CLS}>
              {t(locale, "emoji")}
              <input type="text" name="emoji" placeholder="💰" className={INPUT_CLS} />
            </label>
            <label className={FIELD_CLS}>
              {t(locale, "balance")} ({currencySymbol(locale, userCurrency)})
              <input
                type="text"
                name="balance"
                inputMode="decimal"
                placeholder="0.00"
                className={INPUT_CLS}
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="rounded-md bg-[color:var(--foreground)] px-3 py-2 text-xs font-medium text-[color:var(--background)]"
              >
                {t(locale, "add")}
              </button>
            </div>
          </form>
        </details>
      </section>

      {/* Net worth history */}
      <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <div className="mb-4 text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {t(locale, "netWorthHistory")}
        </div>
        {historyAsc.length === 0 ? (
          <div className="py-6 text-center text-sm text-[color:var(--muted)]">
            {t(locale, "noHistoryYet")}
          </div>
        ) : (
          <>
            <div className="flex h-32 items-end gap-[3px]">
              {historyAsc.map((s) => {
                const h = Math.max(2, (Math.max(0, s.total) / historyMax) * 100);
                return (
                  <div
                    key={s.id}
                    className="group relative flex-1"
                    style={{ height: "100%" }}
                    title={`${formatDateShort(s.cycleStart, locale)} — ${formatAmount(s.total, locale, userCurrency)}`}
                  >
                    <div
                      className="absolute bottom-0 w-full rounded-sm bg-[color:var(--foreground)]/60 transition group-hover:bg-[color:var(--foreground)]"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-[color:var(--muted)]">
              <span>{formatDateShort(historyAsc[0].cycleStart, locale)}</span>
              <span>
                {formatDateShort(historyAsc[historyAsc.length - 1].cycleStart, locale)}
              </span>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
