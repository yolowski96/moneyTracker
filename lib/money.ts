// Parse a human-entered amount string into a Number. Handles:
//   "3.43", "3,43", "1,234.56", "1.234,56", "3,43 €", " €3.43 ", "EUR 3.43"
// Strategy: strip currency symbols + letters + whitespace, then pick the last
// dot/comma as the decimal separator (the other becomes a thousands separator).
export function parseAmount(input: number | string): number {
  if (typeof input === "number") return input;
  let s = input.trim();
  // Strip whitespace (incl. NBSP, narrow NBSP) and common currency symbols/letters.
  s = s
    .replace(/[\s\u00A0\u202F]/g, "")
    .replace(/[€$£¥₹₽₩]/g, "")
    .replace(/[A-Za-z]/g, "");
  if (!s) return NaN;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot === -1 && lastComma === -1) return Number(s);

  const decimalSep = lastDot > lastComma ? "." : ",";
  const thousandSep = decimalSep === "." ? "," : ".";
  s = s.split(thousandSep).join("");
  if (decimalSep === ",") s = s.replace(",", ".");
  return Number(s);
}

export function toCents(input: number | string): number {
  const n = parseAmount(input);
  if (!Number.isFinite(n)) throw new Error("Invalid amount");
  return Math.round(n * 100);
}

// formatAmount lives in lib/format.ts now (locale-aware). Re-export so existing
// imports keep working during the migration.
export { formatAmount } from "./format";
