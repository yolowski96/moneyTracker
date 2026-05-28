import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { userSettingsTag } from "./cache-tags";
import type { Locale, Currency } from "./i18n";

export type Period = "week" | "month" | "year";

const DEFAULT_SETTINGS: Omit<Settings, "id" | "userId"> = {
  period: "month",
  monthlyResetDay: 1,
  weeklyResetDay: 1,
  yearlyResetMonth: 1,
  yearlyResetDay: 1,
  incomeAmount: 0,
  locale: "en",
  currency: "EUR",
};

export type Settings = {
  id: string;
  userId: string;
  period: Period;
  monthlyResetDay: number;
  weeklyResetDay: number;
  yearlyResetMonth: number;
  yearlyResetDay: number;
  incomeAmount: number; // cents
  locale: Locale;
  currency: Currency | string;
};

export type CycleBounds = {
  start: Date;
  end: Date;
  label: string;
  daysUntilReset: number;
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function clampedDate(year: number, month: number, day: number): Date {
  const dim = daysInMonth(year, month);
  return new Date(year, month, Math.min(day, dim), 0, 0, 0, 0);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function getSettingsForUser(userId: string): Promise<Settings> {
  const fn = unstable_cache(
    async (uid: string): Promise<Settings> => {
      const row = await prisma.settings.findUnique({ where: { userId: uid } });
      if (!row) {
        return { id: "", userId: uid, ...DEFAULT_SETTINGS };
      }
      return {
        id: row.id,
        userId: row.userId,
        period: (row.period as Period) ?? "month",
        monthlyResetDay: row.monthlyResetDay,
        weeklyResetDay: row.weeklyResetDay,
        yearlyResetMonth: row.yearlyResetMonth,
        yearlyResetDay: row.yearlyResetDay,
        incomeAmount: row.incomeAmount,
        locale: (row.locale as Locale) ?? "en",
        currency: row.currency ?? "EUR",
      };
    },
    ["settings:v2", userId],
    { tags: [userSettingsTag(userId)] },
  );
  return fn(userId);
}

// React.cache dedupes concurrent calls within a single render.
export const getSettings = cache(async (userId: string): Promise<Settings> => {
  return getSettingsForUser(userId);
});

// Use only on the save path. Creates the row if missing, then updates.
export async function ensureSettings(userId: string): Promise<void> {
  await prisma.settings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

const WEEKDAYS_BG = [
  "неделя",
  "понеделник",
  "вторник",
  "сряда",
  "четвъртък",
  "петък",
  "събота",
];

const MONTHS_BG = [
  "януари",
  "февруари",
  "март",
  "април",
  "май",
  "юни",
  "юли",
  "август",
  "септември",
  "октомври",
  "ноември",
  "декември",
];

export function getCycleBounds(settings: Settings, now = new Date()): CycleBounds {
  const today = startOfDay(now);
  const locale = settings.locale ?? "en";
  let start: Date;
  let end: Date;
  let label: string;

  if (settings.period === "week") {
    const w = settings.weeklyResetDay;
    const dow = today.getDay();
    const daysBack = (dow - w + 7) % 7;
    start = new Date(today);
    start.setDate(today.getDate() - daysBack);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
    label =
      locale === "bg"
        ? `Седмица \u00B7 нулиране в ${WEEKDAYS_BG[w]}`
        : `Week \u00B7 resets ${WEEKDAYS[w]}`;
  } else if (settings.period === "year") {
    const ym = settings.yearlyResetMonth - 1;
    const yd = settings.yearlyResetDay;
    const y = today.getFullYear();
    const thisYearReset = clampedDate(y, ym, yd);
    if (today >= thisYearReset) {
      start = thisYearReset;
      end = clampedDate(y + 1, ym, yd);
    } else {
      start = clampedDate(y - 1, ym, yd);
      end = thisYearReset;
    }
    label =
      locale === "bg"
        ? `Година \u00B7 нулиране на ${yd} ${MONTHS_BG[ym]}`
        : `Year \u00B7 resets ${MONTHS[ym]} ${yd}`;
  } else {
    const d = settings.monthlyResetDay;
    const y = today.getFullYear();
    const m = today.getMonth();
    const thisMonthReset = clampedDate(y, m, d);
    if (today >= thisMonthReset) {
      start = thisMonthReset;
      end = clampedDate(y, m + 1, d);
    } else {
      start = clampedDate(y, m - 1, d);
      end = thisMonthReset;
    }
    label =
      locale === "bg"
        ? `Месец \u00B7 нулиране на ${d}-о число`
        : `Month \u00B7 resets on the ${ordinal(d)}`;
  }

  const daysUntilReset = Math.max(
    0,
    Math.round((end.getTime() - today.getTime()) / 86_400_000),
  );

  return { start, end, label, daysUntilReset };
}

// Stable key for a cycle, derived from its local start date (YYYY-MM-DD).
// Used as the URL segment for cycle drill-down and as a bucketing key.
export function cycleKey(start: Date): string {
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Midpoint of a cycle — used to pick a representative month label. For a cycle
// that runs reset-day → reset-day this lands in the month the period mostly
// covers, and collapses to the calendar month itself when the reset day is 1.
export function cycleMidpoint(start: Date, end: Date): Date {
  return new Date((start.getTime() + end.getTime()) / 2);
}

// Enumerate the most recent `count` reporting periods, newest first.
// Index 0 is the current (in-flight) cycle. Walks backwards by re-deriving the
// cycle for the instant just before each start, so week/month/year reset rules
// and day clamping are handled by getCycleBounds itself.
export function getRecentCycles(
  settings: Settings,
  count: number,
  now = new Date(),
): CycleBounds[] {
  const cycles: CycleBounds[] = [];
  let ref = now;
  for (let i = 0; i < count; i++) {
    const c = getCycleBounds(settings, ref);
    cycles.push(c);
    ref = new Date(c.start.getTime() - 1);
  }
  return cycles;
}

export function periodAdjective(period: Period): string {
  switch (period) {
    case "week":
      return "Weekly";
    case "year":
      return "Yearly";
    default:
      return "Monthly";
  }
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
