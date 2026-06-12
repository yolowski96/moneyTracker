import Link from "next/link";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSettings, getCycleBounds } from "@/lib/cycle";
import { requireUser } from "@/lib/session";
import { userGoalsTag } from "@/lib/cache-tags";
import { log } from "@/lib/log";
import { t } from "@/lib/i18n";
import {
  formatAmount,
  formatAmountWhole,
  formatDateShort,
  formatMonthYear,
  parseAmount,
  currencySymbol,
} from "@/lib/format";
import {
  getActiveGoal,
  getArchivedGoals,
  computeGoalProgress,
} from "@/lib/goals";
import { getPendingCount } from "@/lib/queries";
import { ThemeToggle } from "../theme-toggle";
import { InboxBell } from "../inbox-bell";
import { MobileMenu } from "../mobile-menu";
import { LogoutIcon } from "../logout-icon";

const INPUT_CLS =
  "w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--foreground)]/30";
const FIELD_CLS = "flex min-w-0 flex-col gap-1 text-xs text-[color:var(--muted)]";

export default async function GoalsPage() {
  const { id: userId, email: userEmail } = await requireUser();

  const [settings, pendingCount, activeGoal, archivedGoals] = await Promise.all([
    getSettings(userId),
    getPendingCount(userId),
    getActiveGoal(userId),
    getArchivedGoals(userId),
  ]);
  const locale = settings.locale;
  const userCurrency = settings.currency;
  const progress = activeGoal
    ? await computeGoalProgress(activeGoal, settings)
    : null;

  async function createGoal(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const name = String(formData.get("name") ?? "").trim();
    const emoji = String(formData.get("emoji") ?? "").trim();
    const amountRaw = parseAmount(formData.get("targetAmount"));
    if (!name || !Number.isFinite(amountRaw) || amountRaw <= 0) {
      log("action.goals.create", 400, "invalid_input", "name or amount unusable", {
        nameLen: name.length,
        amountRaw: formData.get("targetAmount"),
        userId: uid,
      });
      return;
    }
    // One active goal at a time — re-check inside the action.
    const existing = await prisma.goal.findFirst({
      where: { userId: uid, archived: false },
      select: { id: true },
    });
    if (existing) {
      log("action.goals.create", 409, "active_exists", existing.id, { userId: uid });
      return;
    }
    const settingsRow = await getSettings(uid);
    const cycle = getCycleBounds(settingsRow);
    const row = await prisma.goal.create({
      data: {
        userId: uid,
        name,
        emoji: emoji || "🎯",
        targetAmount: Math.round(amountRaw * 100),
        startCycle: cycle.start,
      },
    });
    log("action.goals.create", 201, "created", `goal ${row.id}`, {
      id: row.id,
      targetAmount: row.targetAmount,
      userId: uid,
    });
    updateTag(userGoalsTag(uid));
  }

  async function updateGoal(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const emoji = String(formData.get("emoji") ?? "").trim();
    const amountRaw = parseAmount(formData.get("targetAmount"));
    if (!id || !name || !Number.isFinite(amountRaw) || amountRaw <= 0) {
      log("action.goals.update", 400, "invalid_input", "id, name, or amount unusable", {
        id,
        userId: uid,
      });
      return;
    }
    // startCycle is never touched here — editing must not reset progress.
    const result = await prisma.goal.updateMany({
      where: { id, userId: uid, archived: false },
      data: {
        name,
        emoji: emoji || "🎯",
        targetAmount: Math.round(amountRaw * 100),
      },
    });
    log("action.goals.update", result.count ? 200 : 404, result.count ? "updated" : "not_owned", `goal ${id}`, {
      id,
      userId: uid,
      count: result.count,
    });
    updateTag(userGoalsTag(uid));
  }

  async function archiveGoal(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    const goal = await prisma.goal.findFirst({
      where: { id, userId: uid, archived: false },
    });
    if (!goal) {
      log("action.goals.archive", 404, "not_owned", id, { id, userId: uid });
      return;
    }
    const settingsRow = await getSettings(uid);
    const p = await computeGoalProgress(goal, settingsRow);
    await prisma.goal.update({
      where: { id: goal.id },
      data: { archived: true, achievedAt: p.achieved ? new Date() : null },
    });
    log("action.goals.archive", 200, p.achieved ? "achieved" : "abandoned", `goal ${id}`, {
      id,
      saved: p.saved,
      target: goal.targetAmount,
      userId: uid,
    });
    updateTag(userGoalsTag(uid));
  }

  async function renameGoal(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    if (!id || !name) {
      log("action.goals.rename", 400, "invalid_input", "id or name missing", {
        id,
        userId: uid,
      });
      return;
    }
    // Scoped to archived goals — the active goal has its own edit form.
    const result = await prisma.goal.updateMany({
      where: { id, userId: uid, archived: true },
      data: { name },
    });
    log("action.goals.rename", result.count ? 200 : 404, result.count ? "renamed" : "not_owned", `goal ${id}`, {
      id,
      userId: uid,
      count: result.count,
    });
    updateTag(userGoalsTag(uid));
  }

  async function deleteGoal(formData: FormData) {
    "use server";
    const { requireUserId } = await import("@/lib/session");
    const uid = await requireUserId();
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    // Only archived goals can be deleted; the active one must be archived first.
    const result = await prisma.goal.deleteMany({
      where: { id, userId: uid, archived: true },
    });
    log("action.goals.delete", result.count ? 200 : 404, result.count ? "deleted" : "not_owned", `goal ${id}`, {
      id,
      userId: uid,
      count: result.count,
    });
    updateTag(userGoalsTag(uid));
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
          <div className="flex items-center gap-2">
            <InboxBell count={pendingCount} ariaLabel={t(locale, "inbox")} />
            <ThemeToggle />
          </div>
        </div>
        <div className="mt-6 sm:mt-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t(locale, "goals")}
            </h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {t(locale, "goalsTagline")}
            </p>
          </div>
          <nav className="hidden flex-wrap items-center justify-end gap-3 sm:flex">
            <Link
              href="/charts"
              prefetch={false}
              className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              {t(locale, "charts")}
            </Link>
            <Link
              href="/settings"
              prefetch={false}
              className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              {t(locale, "settings")}
            </Link>
            <Link
              href="/"
              prefetch={false}
              className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              {"←"} {t(locale, "back")}
            </Link>
            <InboxBell count={pendingCount} ariaLabel={t(locale, "inbox")} />
            <ThemeToggle />
            <LogoutIcon ariaLabel={t(locale, "signOut")} />
          </nav>
        </div>
      </header>

      {activeGoal && progress ? (
        <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0 truncate text-lg font-medium">
              <span aria-hidden className="mr-2">{activeGoal.emoji}</span>
              {activeGoal.name}
            </div>
            <div className="shrink-0 text-xs text-[color:var(--muted)]">
              {t(locale, "sinceStart", {
                date: formatDateShort(activeGoal.startCycle, locale),
              })}
            </div>
          </div>

          <div className="mt-4 flex items-baseline justify-between gap-3">
            <div>
              <div className="text-xs text-[color:var(--muted)]">
                {t(locale, "savedLabel")}
              </div>
              <div
                className={
                  "text-4xl font-medium tabular-nums " +
                  (progress.saved < 0 ? "text-red-500" : "")
                }
              >
                {formatAmount(progress.saved, locale, userCurrency)}
              </div>
            </div>
            <div className="font-mono text-sm tabular-nums text-[color:var(--muted)]">
              {formatAmountWhole(Math.max(0, progress.saved), locale, userCurrency)}
              {" / "}
              {formatAmountWhole(activeGoal.targetAmount, locale, userCurrency)}
            </div>
          </div>

          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-[color:var(--border)]">
              <div
                className={
                  "h-full transition-all " +
                  (progress.achieved
                    ? "bg-emerald-500"
                    : "bg-[color:var(--foreground)]/70")
                }
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between gap-3 text-xs text-[color:var(--muted)]">
              <span>{progress.pct}%</span>
              <span className="text-right">
                {progress.achieved
                  ? null
                  : progress.etaDate
                    ? t(locale, "etaAtPace", {
                        when: formatMonthYear(progress.etaDate, locale),
                      })
                    : t(locale, "etaUnknown")}
              </span>
            </div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">
              {t(locale, "thisCycleSoFar", {
                amount:
                  (progress.currentCycleDelta >= 0 ? "+" : "") +
                  formatAmount(progress.currentCycleDelta, locale, userCurrency),
              })}
            </div>
          </div>

          {progress.achieved ? (
            <div className="mt-5 flex items-center justify-between gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
              <div className="text-sm font-medium">
                {"\u{1F389}"} {t(locale, "goalAchieved")}
              </div>
              <form action={archiveGoal}>
                <input type="hidden" name="id" value={activeGoal.id} />
                <button
                  type="submit"
                  className="rounded-md bg-[color:var(--foreground)] px-3 py-1.5 text-xs font-medium text-[color:var(--background)]"
                >
                  {t(locale, "startNewGoal")}
                </button>
              </form>
            </div>
          ) : (
            <div className="mt-5 flex items-center justify-between border-t border-[color:var(--border)] pt-4">
              <details className="group min-w-0 flex-1">
                <summary className="cursor-pointer list-none text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]">
                  {t(locale, "edit")}
                </summary>
                <form action={updateGoal} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <input type="hidden" name="id" value={activeGoal.id} />
                  <label className={`${FIELD_CLS} col-span-2`}>
                    {t(locale, "label")}
                    <input
                      type="text"
                      name="name"
                      required
                      defaultValue={activeGoal.name}
                      className={INPUT_CLS}
                    />
                  </label>
                  <label className={FIELD_CLS}>
                    {t(locale, "emoji")}
                    <input
                      type="text"
                      name="emoji"
                      defaultValue={activeGoal.emoji}
                      className={INPUT_CLS}
                    />
                  </label>
                  <label className={FIELD_CLS}>
                    {t(locale, "targetAmount")} ({currencySymbol(locale, userCurrency)})
                    <input
                      type="text"
                      inputMode="decimal"
                      name="targetAmount"
                      required
                      defaultValue={String(activeGoal.targetAmount / 100)}
                      className={INPUT_CLS}
                    />
                  </label>
                  <div className="col-span-2 sm:col-span-4">
                    <button
                      type="submit"
                      className="rounded-md bg-[color:var(--foreground)] px-3 py-1.5 text-xs font-medium text-[color:var(--background)]"
                    >
                      {t(locale, "save")}
                    </button>
                  </div>
                </form>
              </details>
              <form action={archiveGoal} className="shrink-0">
                <input type="hidden" name="id" value={activeGoal.id} />
                <button
                  type="submit"
                  className="text-xs text-[color:var(--muted)] hover:text-red-500"
                >
                  {t(locale, "archive")}
                </button>
              </form>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            {t(locale, "newGoal")}
          </div>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {t(locale, "noGoalHint")}
          </p>
          <form action={createGoal} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className={`${FIELD_CLS} col-span-2`}>
              {t(locale, "label")}
              <input
                type="text"
                name="name"
                required
                placeholder={t(locale, "goalNamePlaceholder")}
                className={INPUT_CLS}
              />
            </label>
            <label className={FIELD_CLS}>
              {t(locale, "emoji")}
              <input
                type="text"
                name="emoji"
                placeholder="🎯"
                className={INPUT_CLS}
              />
            </label>
            <label className={FIELD_CLS}>
              {t(locale, "targetAmount")} ({currencySymbol(locale, userCurrency)})
              <input
                type="text"
                inputMode="decimal"
                name="targetAmount"
                required
                className={INPUT_CLS}
              />
            </label>
            <div className="col-span-2 sm:col-span-4">
              <button
                type="submit"
                className="w-full rounded-md bg-[color:var(--foreground)] px-3 py-2 text-sm font-medium text-[color:var(--background)] sm:w-auto"
              >
                {t(locale, "createGoal")}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="mt-12">
        <div className="mb-2 border-b border-[color:var(--border)] pb-2 text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {t(locale, "archivedGoals")}
        </div>
        {archivedGoals.length === 0 ? (
          <div className="py-3 text-sm text-[color:var(--muted)]">
            {t(locale, "noArchivedGoals")}
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--border)]">
            {archivedGoals.map((g) => (
              <li key={g.id} className="group py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span aria-hidden className="text-base">{g.emoji}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm">{g.name}</div>
                      <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                        {g.achievedAt
                          ? `${t(locale, "achievedBadge")} · ${formatDateShort(g.achievedAt, locale)}`
                          : t(locale, "abandonedBadge")}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-sm tabular-nums text-[color:var(--muted)]">
                      {formatAmount(g.targetAmount, locale, userCurrency)}
                    </span>
                    {g.achievedAt ? (
                      <span aria-hidden className="text-emerald-500">{"✓"}</span>
                    ) : null}
                    <form action={deleteGoal}>
                      <input type="hidden" name="id" value={g.id} />
                      <button
                        type="submit"
                        aria-label={t(locale, "delete")}
                        className="p-1 -m-1 text-[color:var(--muted)] transition hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        &times;
                      </button>
                    </form>
                  </div>
                </div>
                <details>
                  <summary className="mt-1 w-fit cursor-pointer list-none text-xs text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] sm:opacity-0 sm:group-hover:opacity-100">
                    {t(locale, "rename")}
                  </summary>
                  <form action={renameGoal} className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="id" value={g.id} />
                    <input
                      type="text"
                      name="name"
                      required
                      defaultValue={g.name}
                      className={INPUT_CLS + " max-w-xs"}
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-md bg-[color:var(--foreground)] px-3 py-1.5 text-xs font-medium text-[color:var(--background)]"
                    >
                      {t(locale, "save")}
                    </button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
