import Link from "next/link";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings, getCycleBounds, type Period } from "@/lib/cycle";
import { generateApiToken } from "@/lib/auth";
import { TAG_SETTINGS, TAG_TRANSACTIONS } from "@/lib/cache-tags";
import { log } from "@/lib/log";
import { SettingsForm } from "./form";
import { ApiKeyCard } from "./api-key-card";
import { ThemeToggle } from "../theme-toggle";

export default async function SettingsPage() {
  const settings = await getSettings();
  const cycle = getCycleBounds(settings);

  async function save(formData: FormData) {
    "use server";

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

    const data = {
      period: ["week", "month", "year"].includes(period) ? period : "month",
      monthlyResetDay,
      weeklyResetDay,
      yearlyResetMonth,
      yearlyResetDay,
      incomeAmount,
    };
    await prisma.settings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });

    log("action.settings.save", 200, "saved", `period=${data.period}`, {
      period: data.period,
      incomeAmount: data.incomeAmount,
      monthlyResetDay: data.monthlyResetDay,
      weeklyResetDay: data.weeklyResetDay,
      yearlyResetMonth: data.yearlyResetMonth,
      yearlyResetDay: data.yearlyResetDay,
    });

    // Settings changed, and since cycle bounds depend on settings the cached
    // cycle transactions are stale too — bust both tags.
    updateTag(TAG_SETTINGS);
    updateTag(TAG_TRANSACTIONS);
    redirect("/");
  }

  async function regenerateApiToken() {
    "use server";
    const token = generateApiToken();
    const previous = await prisma.settings.findUnique({
      where: { id: 1 },
      select: { apiToken: true },
    });
    await prisma.settings.upsert({
      where: { id: 1 },
      update: { apiToken: token },
      create: { id: 1, apiToken: token },
    });
    log("action.settings.regenerateApiToken", 200, previous?.apiToken ? "rotated" : "generated", "api token updated", {
      hadPrevious: !!previous?.apiToken,
      tokenPreview: token.slice(0, 4) + "…" + token.slice(-4),
    });
    updateTag(TAG_SETTINGS);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Configure your tracking cycle.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/inbox"
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            Inbox
          </Link>
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

      <div className="divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
                Cycle {"\u00B7"} income
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
              How often your budget resets and what you bring in per period.
            </p>
            <SettingsForm initial={settings} action={save} />
          </div>
        </details>

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
                API access
              </div>
              <div className="mt-0.5 text-[color:var(--muted)]">
                {settings.apiToken ? "Key configured" : "No key yet"}
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
              Authenticate iOS Shortcuts and other clients posting to{" "}
              <code className="font-mono text-xs">/api/transactions</code>.
            </p>
            <ApiKeyCard token={settings.apiToken} action={regenerateApiToken} />
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
