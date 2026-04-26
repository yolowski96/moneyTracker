import Link from "next/link";

export function InboxBell({
  count,
  ariaLabel,
}: {
  count: number;
  ariaLabel: string;
}) {
  return (
    <Link
      href="/inbox"
      aria-label={count > 0 ? `${ariaLabel} (${count})` : ariaLabel}
      title={ariaLabel}
      className="relative flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--border)] text-sm text-[color:var(--muted)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]"
    >
      <span aria-hidden>{"\u{1F514}"}</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-red-500 px-1 py-0.5 text-[10px] font-medium leading-none text-white tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
