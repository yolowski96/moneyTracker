import Link from "next/link";
import type { ReactNode } from "react";
import { t, type Locale } from "@/lib/i18n";
import { DEMO_EMAIL } from "@/lib/demo";
import { MobileMenu } from "./mobile-menu";
import { InboxBell } from "./inbox-bell";
import { ThemeToggle } from "./theme-toggle";
import { LogoutIcon } from "./logout-icon";

export type AppPage =
  | "home"
  | "charts"
  | "goals"
  | "portfolio"
  | "settings"
  | "inbox";

const NAV = [
  { page: "home" as const, href: "/" },
  { page: "charts" as const, href: "/charts" },
  { page: "goals" as const, href: "/goals" },
  { page: "portfolio" as const, href: "/portfolio" },
  { page: "settings" as const, href: "/settings" },
];

// Shared page header: mobile bar (menu / centered app name / bell + theme)
// plus the desktop title row with nav links. The current page is omitted
// from both nav lists; the inbox hides its own bell.
export function AppHeader({
  current,
  locale,
  userEmail,
  pendingCount,
  title,
  tagline,
  subtitle,
}: {
  current: AppPage;
  locale: Locale;
  userEmail: string | null;
  pendingCount: number;
  title: string;
  tagline: ReactNode;
  subtitle?: string;
}) {
  const isHome = current === "home";
  const isDemo = userEmail === DEMO_EMAIL;
  const demoChip = (
    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
      Demo
    </span>
  );
  const showBell = current !== "inbox";
  const menuItems = NAV.filter((n) => n.page !== current).map((n) => ({
    href: n.href,
    label: t(locale, n.page),
  }));

  return (
    <header className={isHome ? "mb-10 sm:mb-12" : "mb-10"}>
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <MobileMenu
          ariaLabel={t(locale, "menu")}
          title={t(locale, "appName")}
          userEmail={userEmail}
          signOutLabel={t(locale, "signOut")}
          items={menuItems}
        />
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-base font-semibold tracking-tight">
          {t(locale, "appName")}
          {isDemo && demoChip}
        </div>
        <div className="flex items-center gap-2">
          {showBell && (
            <InboxBell count={pendingCount} ariaLabel={t(locale, "inbox")} />
          )}
          <ThemeToggle />
        </div>
      </div>
      <div
        className={
          "mt-6 sm:mt-0 sm:flex sm:justify-between sm:gap-4 " +
          (isHome ? "sm:items-start" : "sm:items-center")
        }
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1
              className={
                isHome
                  ? "hidden text-2xl font-extrabold tracking-tight sm:block"
                  : "text-[22px] font-extrabold tracking-tight"
              }
            >
              {title}
            </h1>
            {isDemo && <span className="hidden sm:inline-flex">{demoChip}</span>}
          </div>
          <p
            className={
              isHome
                ? "text-sm text-[color:var(--muted)] sm:mt-1"
                : "mt-1 text-sm text-[color:var(--muted)]"
            }
          >
            {tagline}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-[color:var(--muted)]">{subtitle}</p>
          )}
        </div>
        <nav className="hidden shrink-0 items-center justify-end gap-x-3 sm:flex">
          {NAV.map((n) =>
            n.page === current ? (
              <span
                key={n.href}
                className="text-[13px] font-semibold text-[color:var(--accent)]"
              >
                {t(locale, n.page)}
              </span>
            ) : (
              <Link
                key={n.href}
                href={n.href}
                prefetch={false}
                className="text-[13px] text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)]"
              >
                {t(locale, n.page)}
              </Link>
            ),
          )}
          {showBell && (
            <InboxBell count={pendingCount} ariaLabel={t(locale, "inbox")} />
          )}
          <ThemeToggle />
          <LogoutIcon ariaLabel={t(locale, "signOut")} />
        </nav>
      </div>
    </header>
  );
}
