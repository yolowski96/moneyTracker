import { log } from "./log";

// Live view over the user's external positions API (spec:
// docs/superpowers/specs/2026-07-02-portfolio-savings-design.md). Positions
// are never persisted — every portfolio page load fetches fresh. Prices come
// back as decimal EUR per unit; everything downstream works in cents.

export const POSITION_TYPES = ["stock", "etf", "crypto", "metal"] as const;
export type PositionType = (typeof POSITION_TYPES)[number];

export type Position = {
  ticker: string;
  name: string;
  type: PositionType | null;
  quantity: number;
  avgPriceCents: number; // per unit
  currentPriceCents: number; // per unit
  valueCents: number; // quantity × current
  costCents: number; // quantity × avg
  plCents: number; // value − cost
  plPct: number | null; // null when cost is 0
};

export type Portfolio = {
  positions: Position[];
  valueCents: number;
  costCents: number;
  plCents: number;
  plPct: number | null;
};

export type PortfolioResult =
  | { ok: true; portfolio: Portfolio }
  | { ok: false; error: "not_configured" | "unreachable" | "bad_response" };

const FETCH_TIMEOUT_MS = 8_000;

function eurosToCents(n: number): number {
  return Math.round(n * 100);
}

// Accepts one raw position object; returns null if the shape is unusable.
function parsePosition(raw: unknown): Position | null {
  if (typeof raw !== "object" || raw === null) return null;
  const p = raw as Record<string, unknown>;
  const ticker = typeof p.ticker === "string" ? p.ticker.trim() : "";
  const quantity = typeof p.quantity === "number" ? p.quantity : NaN;
  const avgPrice = typeof p.avgPrice === "number" ? p.avgPrice : NaN;
  const currentPrice = typeof p.currentPrice === "number" ? p.currentPrice : NaN;
  if (
    !ticker ||
    !Number.isFinite(quantity) ||
    !Number.isFinite(avgPrice) ||
    !Number.isFinite(currentPrice) ||
    quantity < 0 ||
    avgPrice < 0 ||
    currentPrice < 0
  ) {
    return null;
  }

  const name =
    typeof p.name === "string" && p.name.trim() ? p.name.trim() : ticker;
  const type =
    typeof p.type === "string" &&
    (POSITION_TYPES as readonly string[]).includes(p.type)
      ? (p.type as PositionType)
      : null;

  const avgPriceCents = eurosToCents(avgPrice);
  const currentPriceCents = eurosToCents(currentPrice);
  const valueCents = Math.round(quantity * currentPriceCents);
  const costCents = Math.round(quantity * avgPriceCents);
  const plCents = valueCents - costCents;
  const plPct = costCents > 0 ? (plCents / costCents) * 100 : null;

  return {
    ticker,
    name,
    type,
    quantity,
    avgPriceCents,
    currentPriceCents,
    valueCents,
    costCents,
    plCents,
    plPct,
  };
}

// Server-wide default endpoint; a per-user Settings.portfolioApiUrl wins.
export function portfolioEnvUrl(): string | null {
  return process.env.PORTFOLIO_API_URL || null;
}

// Fetches all positions in one call: GET <url> with Bearer <apiToken>.
// `url` falls back to the PORTFOLIO_API_URL env var when unset.
// Never throws — the page decides how to degrade (snapshot fallback).
export async function fetchPortfolio(
  url: string | null | undefined,
  apiToken: string | null | undefined,
): Promise<PortfolioResult> {
  const resolved = url || portfolioEnvUrl();
  if (!resolved || !apiToken) return { ok: false, error: "not_configured" };

  let res: Response;
  try {
    res = await fetch(resolved, {
      headers: { authorization: `Bearer ${apiToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    log("portfolio.fetch", 502, "unreachable", (err as Error).message, { url: resolved });
    return { ok: false, error: "unreachable" };
  }

  if (!res.ok) {
    log("portfolio.fetch", res.status, "http_error", res.statusText, { url: resolved });
    return { ok: false, error: "bad_response" };
  }

  let text: string;
  try {
    text = await res.text();
  } catch (err) {
    log("portfolio.fetch", 502, "body_read_error", (err as Error).message, { url: resolved });
    return { ok: false, error: "unreachable" };
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    log("portfolio.fetch", 502, "invalid_json", "response body not JSON", { url: resolved });
    return { ok: false, error: "bad_response" };
  }

  const rawList = (body as { positions?: unknown })?.positions;
  if (!Array.isArray(rawList)) {
    log("portfolio.fetch", 502, "bad_shape", "missing positions array", { url: resolved });
    return { ok: false, error: "bad_response" };
  }

  const positions: Position[] = [];
  for (const raw of rawList) {
    const pos = parsePosition(raw);
    if (pos) positions.push(pos);
    else log("portfolio.fetch", 502, "bad_position", "skipped malformed position");
  }
  positions.sort((a, b) => b.valueCents - a.valueCents);

  const valueCents = positions.reduce((s, p) => s + p.valueCents, 0);
  const costCents = positions.reduce((s, p) => s + p.costCents, 0);
  const plCents = valueCents - costCents;
  const plPct = costCents > 0 ? (plCents / costCents) * 100 : null;

  return {
    ok: true,
    portfolio: { positions, valueCents, costCents, plCents, plPct },
  };
}
