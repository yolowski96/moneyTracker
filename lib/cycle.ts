import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { TAG_SETTINGS } from "./cache-tags";
import type { Locale, Currency } from "./i18n";

export type Period = "week" | "month" | "year";

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  period: "month",
  monthlyResetDay: 1,
  weeklyResetDay: 1,
  yearlyResetMonth: 1,
  yearlyResetDay: 1,
  incomeAmount: 0,
  apiToken: null,
  locale: "en",
  currency: "EUR",
};

export type Settings = {
  id: number;
  period: Period;
  monthlyResetDay: number;
  weeklyResetDay: number;
  yearlyResetMonth: number;
  yearlyResetDay: number;
  incomeAmount: number; // cents
  apiToken: string | null;
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

// DB read, cached by Next.js data cache. Busted via revalidateTag("settings").
// Settings change maybe once a week; serving this from cache turns a
// Supabase round-trip into an in-process read.
const getSettingsCached = unstable_cache(
  async (): Promise<Settings> => {
    const row = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!row) return DEFAULT_SETTINGS;
    return {
      id: row.id,
      period: (row.period as Period) ?? "month",
      monthlyResetDay: row.monthlyResetDay,
      weeklyResetDay: row.weeklyResetDay,
      yearlyResetMonth: row.yearlyResetMonth,
      yearlyResetDay: row.yearlyResetDay,
      incomeAmount: row.incomeAmount,
      apiToken: row.apiToken,
      locale: (row.locale as Locale) ?? "en",
      currency: row.currency ?? "EUR",
    };
  },
  ["settings:v1"],
  { tags: [TAG_SETTINGS] },
);

// React.cache dedupes concurrent calls within a single render.
export const getSettings = cache(async (): Promise<Settings> => {
  return getSettingsCached();
});

// Use only on the save path. Creates the row if missing, then updates.
export async function ensureSettings(): Promise<void> {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
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
