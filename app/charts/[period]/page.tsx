import { notFound } from "next/navigation";
import { log } from "@/lib/log";
import { requireUser } from "@/lib/session";
import { ChartsView } from "../charts-view";

type PageProps = {
  params: Promise<{ period: string }>;
  searchParams: Promise<{ cat?: string }>;
};

// A period segment is the cycle's local start date: YYYY-MM-DD.
function parsePeriod(raw: string): Date | null {
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

// Per-user dynamic render: cache layer below already memoizes by userId.
export const dynamic = "force-dynamic";

export default async function ChartsPeriodPage({ params, searchParams }: PageProps) {
  const { period } = await params;
  const anchor = parsePeriod(period);
  if (!anchor) {
    log("page.charts.period", 404, "bad_period_param", `ignoring ${period}`, {
      period,
    });
    notFound();
  }
  const { id, email } = await requireUser();
  const { cat } = await searchParams;
  return (
    <ChartsView
      userId={id}
      userEmail={email}
      periodAnchor={anchor}
      categoryFilter={cat ?? null}
    />
  );
}
