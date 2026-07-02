// Static SVG donut for the net-worth allocation. Pure markup — renders on the
// server, no client JS. Slices are drawn as stroked circles offset along a
// normalized (pathLength=100) circumference, so no arc trigonometry is needed.

export type PieSlice = {
  label: string;
  value: number; // cents, > 0
  color: string;
};

// Tailwind 500-series hues; readable on both themes.
export const PIE_PALETTE = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ef4444", // red
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
  "#ec4899", // pink
  "#84cc16", // lime
  "#06b6d4", // cyan
  "#a855f7", // purple
];

export function AllocationPie({
  slices,
  centerLabel,
  centerValue,
}: {
  slices: PieSlice[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;

  // Each slice starts where the previous ones end; 25 shifts the zero-point
  // from 3 o'clock (SVG dasharray origin) to 12 o'clock.
  const arcs = slices.map((s, i) => {
    const before = slices.slice(0, i).reduce((sum, x) => sum + x.value, 0);
    return {
      ...s,
      pct: (s.value / total) * 100,
      offset: 25 - (before / total) * 100,
    };
  });

  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={centerLabel} className="h-44 w-44">
      {arcs.map((a, i) => (
        <circle
          key={i}
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={a.color}
          strokeWidth="14"
          pathLength={100}
          strokeDasharray={`${Math.max(0, a.pct - 0.4)} ${100 - Math.max(0, a.pct - 0.4)}`}
          strokeDashoffset={a.offset}
        >
          <title>{`${a.label} — ${a.pct.toFixed(1)}%`}</title>
        </circle>
      ))}
      <text
        x="50"
        y="47"
        textAnchor="middle"
        className="fill-[color:var(--muted)]"
        style={{ fontSize: "6px" }}
      >
        {centerLabel}
      </text>
      <text
        x="50"
        y="57"
        textAnchor="middle"
        className="fill-[color:var(--foreground)]"
        style={{ fontSize: "8px", fontWeight: 600 }}
      >
        {centerValue}
      </text>
    </svg>
  );
}
