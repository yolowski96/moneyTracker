import { notFound } from "next/navigation";
import { log } from "@/lib/log";
import { ChartsView } from "../charts-view";

type PageProps = { params: Promise<{ month: string }> };

function parseMonth(raw: string): Date | null {
  const match = raw.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return new Date(y, m - 1, 1);
}

// ISR: each unique /charts/YYYY-MM is cached after first render and refreshed
// on tag bust (mutations invalidate TAG_TRANSACTIONS etc.) or after an hour.
export const revalidate = 3600;

export default async function ChartsMonthPage({ params }: PageProps) {
  const { month } = await params;
  const anchor = parseMonth(month);
  if (!anchor) {
    log("page.charts.month", 404, "bad_month_param", `ignoring ${month}`, {
      month,
    });
    notFound();
  }
  return <ChartsView monthAnchor={anchor} />;
}
