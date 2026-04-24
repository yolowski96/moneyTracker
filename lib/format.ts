import type { Locale, Currency } from "./i18n";

const LOCALE_MAP: Record<Locale, string> = {
  en: "en-IE",
  bg: "bg-BG",
};

export function bcp47(locale: Locale): string {
  return LOCALE_MAP[locale] ?? "en-IE";
}

export function formatAmount(
  cents: number,
  locale: Locale = "en",
  currency: Currency | string = "EUR",
): string {
  return new Intl.NumberFormat(bcp47(locale), {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatDateLong(d: Date, locale: Locale): string {
  return d.toLocaleDateString(bcp47(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatDateShort(d: Date, locale: Locale): string {
  return d.toLocaleDateString(bcp47(locale), {
    day: "numeric",
    month: "short",
  });
}

export function formatMonthYear(d: Date, locale: Locale): string {
  return d.toLocaleDateString(bcp47(locale), {
    month: "long",
    year: "numeric",
  });
}

export function formatMonthShortYear(d: Date, locale: Locale): string {
  return d.toLocaleDateString(bcp47(locale), {
    month: "short",
    year: "numeric",
  });
}

export function formatMonthShort(d: Date, locale: Locale): string {
  return d.toLocaleDateString(bcp47(locale), { month: "short" });
}

export function currencySymbol(
  locale: Locale,
  currency: Currency | string,
): string {
  const parts = new Intl.NumberFormat(bcp47(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? currency;
}

export function formatDateTime(d: Date, locale: Locale): string {
  return d.toLocaleString(bcp47(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
