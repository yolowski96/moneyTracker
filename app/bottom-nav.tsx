import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";
import type { AppPage } from "./app-header";

const ICONS: Record<string, React.ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </>
  ),
  charts: (
    <>
      <line x1="5" y1="20" x2="5" y2="12" />
      <line x1="12" y1="20" x2="12" y2="5" />
      <line x1="19" y1="20" x2="19" y2="9" />
    </>
  ),
  goals: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  portfolio: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
};

// Fixed bottom tab bar shown only on mobile; the desktop nav lives in the
// header. Pages get room for it via the body padding rule in globals.css.
export function BottomNav({
  current,
  locale,
  items,
}: {
  current: AppPage;
  locale: Locale;
  items: { page: AppPage; href: string }[];
}) {
  return (
    <nav
      data-bottom-nav
      aria-label={t(locale, "menu")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--border)] bg-[color:var(--background)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map((it) => {
          const active = it.page === current;
          const inner = (
            <>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {ICONS[it.page]}
              </svg>
              <span className="text-[10px] font-medium leading-none">
                {t(locale, it.page)}
              </span>
            </>
          );
          const cls =
            "flex flex-col items-center gap-1 py-2.5 " +
            (active
              ? "text-[color:var(--accent)]"
              : "text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]");
          return active ? (
            <span key={it.href} className={cls} aria-current="page">
              {inner}
            </span>
          ) : (
            <Link key={it.href} href={it.href} prefetch={false} className={cls}>
              {inner}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
