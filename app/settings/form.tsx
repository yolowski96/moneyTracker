"use client";

import { useState, useTransition } from "react";
import { type Period, type Settings } from "@/lib/cycle";
import { type Locale } from "@/lib/i18n";

type Props = {
  initial: Settings;
  currencySymbol: string;
  locales: { id: Locale; label: string }[];
  currencies: readonly string[];
  weekdayLabels: string[];
  monthLabels: string[];
  periodAdjective: string;
  labels: {
    trackBy: string;
    week: string;
    month: string;
    year: string;
    weekHint: string;
    monthHint: string;
    yearHint: string;
    periodIncome: string;
    incomeDescription: string;
    resetDay: string;
    salaryResetDay: string;
    salaryResetHint: string;
    resetMonth: string;
    language: string;
    currency: string;
    save: string;
    saving: string;
    resetNote: string;
  };
  action: (formData: FormData) => Promise<void>;
};

export function SettingsForm({
  initial,
  currencySymbol,
  locales,
  currencies,
  weekdayLabels,
  monthLabels,
  periodAdjective,
  labels,
  action,
}: Props) {
  const PERIODS: { id: Period; label: string; hint: string }[] = [
    { id: "week", label: labels.week, hint: labels.weekHint },
    { id: "month", label: labels.month, hint: labels.monthHint },
    { id: "year", label: labels.year, hint: labels.yearHint },
  ];

  const [period, setPeriod] = useState<Period>(initial.period);
  const [monthlyResetDay, setMonthlyResetDay] = useState(initial.monthlyResetDay);
  const [weeklyResetDay, setWeeklyResetDay] = useState(initial.weeklyResetDay);
  const [yearlyResetMonth, setYearlyResetMonth] = useState(initial.yearlyResetMonth);
  const [yearlyResetDay, setYearlyResetDay] = useState(initial.yearlyResetDay);
  const [income, setIncome] = useState(
    initial.incomeAmount ? (initial.incomeAmount / 100).toFixed(2) : "",
  );
  const [locale, setLocale] = useState<Locale>(initial.locale);
  const [currency, setCurrency] = useState<string>(initial.currency);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => startTransition(() => action(fd))}
      className="space-y-8"
    >
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="monthlyResetDay" value={monthlyResetDay} />
      <input type="hidden" name="weeklyResetDay" value={weeklyResetDay} />
      <input type="hidden" name="yearlyResetMonth" value={yearlyResetMonth} />
      <input type="hidden" name="yearlyResetDay" value={yearlyResetDay} />
      <input type="hidden" name="incomeAmount" value={income} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="currency" value={currency} />

      <section>
        <label className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {labels.language}
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {locales.map((l) => {
            const active = locale === l.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLocale(l.id)}
                className={
                  "rounded-lg border p-3 text-left text-sm transition " +
                  (active
                    ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                    : "border-[color:var(--border)] hover:bg-[color:var(--surface)]")
                }
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <label className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {labels.currency}
        </label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {currencies.map((c) => {
            const active = currency === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={
                  "rounded-lg border p-3 text-center text-sm font-mono transition " +
                  (active
                    ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                    : "border-[color:var(--border)] hover:bg-[color:var(--surface)]")
                }
              >
                {c}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <label className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {labels.trackBy}
        </label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {PERIODS.map((p) => {
            const active = period === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={
                  "rounded-lg border p-3 text-left transition " +
                  (active
                    ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                    : "border-[color:var(--border)] hover:bg-[color:var(--surface)]")
                }
              >
                <div className="text-sm font-medium">{p.label}</div>
                <div
                  className={
                    "mt-0.5 text-xs " +
                    (active
                      ? "text-[color:var(--background)]/70"
                      : "text-[color:var(--muted)]")
                  }
                >
                  {p.hint}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <label className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {periodAdjective} {labels.periodIncome}
        </label>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          {labels.incomeDescription.replace("{p}", period)}
        </p>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-2 focus-within:border-[color:var(--foreground)]/30">
          <span className="pl-1 text-sm text-[color:var(--muted)]">
            {currencySymbol}
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            placeholder="0.00"
            className="w-full border-0 bg-transparent px-1 py-1 text-sm tabular-nums outline-none"
          />
        </div>
      </section>

      {period === "week" && (
        <section>
          <label className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            {labels.resetDay}
          </label>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {weekdayLabels.map((d, i) => {
              const active = weeklyResetDay === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setWeeklyResetDay(i)}
                  className={
                    "rounded-md py-2 text-xs transition " +
                    (active
                      ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                      : "border border-[color:var(--border)] hover:bg-[color:var(--surface)]")
                  }
                >
                  {d}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {period === "month" && (
        <section>
          <label className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            {labels.salaryResetDay}
          </label>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {labels.salaryResetHint}
          </p>
          <div className="mt-3 grid grid-cols-7 gap-1">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
              const active = monthlyResetDay === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setMonthlyResetDay(d)}
                  className={
                    "aspect-square rounded-md text-sm tabular-nums transition " +
                    (active
                      ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                      : "border border-[color:var(--border)] hover:bg-[color:var(--surface)]")
                  }
                >
                  {d}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {period === "year" && (
        <section className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
              {labels.resetMonth}
            </label>
            <div className="mt-2 grid grid-cols-6 gap-1">
              {monthLabels.map((m, i) => {
                const active = yearlyResetMonth === i + 1;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setYearlyResetMonth(i + 1)}
                    className={
                      "rounded-md py-2 text-xs transition " +
                      (active
                        ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                        : "border border-[color:var(--border)] hover:bg-[color:var(--surface)]")
                    }
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
              {labels.resetDay}
            </label>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                const active = yearlyResetDay === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setYearlyResetDay(d)}
                    className={
                      "aspect-square rounded-md text-sm tabular-nums transition " +
                      (active
                        ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                        : "border border-[color:var(--border)] hover:bg-[color:var(--surface)]")
                    }
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[color:var(--foreground)] px-4 py-2 text-sm font-medium text-[color:var(--background)] disabled:opacity-50"
        >
          {isPending ? `${labels.saving}\u2026` : labels.save}
        </button>
        <span className="text-xs text-[color:var(--muted)]">
          {labels.resetNote}
        </span>
      </div>
    </form>
  );
}
