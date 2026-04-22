import Link from "next/link";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings, getCycleBounds, type Period } from "@/lib/cycle";
import { generateApiToken } from "@/lib/auth";
import { TAG_SETTINGS, TAG_TRANSACTIONS } from "@/lib/cache-tags";
import { SettingsForm } from "./form";
import { ApiKeyCard } from "./api-key-card";
import { ThemeToggle } from "../theme-toggle";

export const dynamic = "force-dynamic";

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

    // Settings changed, and since cycle bounds depend on settings the cached
    // cycle transactions are stale too — bust both tags.
    updateTag(TAG_SETTINGS);
    updateTag(TAG_TRANSACTIONS);
    redirect("/");
  }

  async function regenerateApiToken() {
    "use server";
    const token = generateApiToken();
    await prisma.settings.upsert({
      where: { id: 1 },
      update: { apiToken: token },
      create: { id: 1, apiToken: token },
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
            href="/"
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            {"\u2190"} Back
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <section aria-labelledby="cycle-heading" className="space-y-6">
        <div>
          <h2
            id="cycle-heading"
            className="text-xs uppercase tracking-widest text-[color:var(--muted)]"
          >
            Cycle {"\u00B7"} income
          </h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            How often your budget resets and what you bring in per period.
          </p>
        </div>

        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm">
          <div className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            Current cycle
          </div>
          <div className="mt-1">{cycle.label}</div>
        </div>

        <SettingsForm initial={settings} action={save} />
      </section>

      <hr className="my-12 border-[color:var(--border)]" />

      <section aria-labelledby="api-heading" className="space-y-4">
        <div>
          <h2
            id="api-heading"
            className="text-xs uppercase tracking-widest text-[color:var(--muted)]"
          >
            API access
          </h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Authenticate iOS Shortcuts and other clients posting to{" "}
            <code className="font-mono text-xs">/api/transactions</code>.
          </p>
        </div>

        <ApiKeyCard token={settings.apiToken} action={regenerateApiToken} />
      </section>
    </main>
  );
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
