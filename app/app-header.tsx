import Link from "next/link";
import type { ReactNode } from "react";
import { t, type Locale } from "@/lib/i18n";
import { MobileMenu } from "./mobile-menu";
import { InboxBell } from "./inbox-bell";
import { ThemeToggle } from "./theme-toggle";
import { LogoutIcon } from "./logout-icon";

export type AppPage = "home" | "charts" | "goals" | "settings" | "inbox";

const NAV = [
  { page: "charts" as const, href: "/charts" },
  { page: "goals" as const, href: "/goals" },
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
  const showBell = current !== "inbox";
  const links = NAV.filter((n) => n.page !== current);
  const menuItems = [
    ...(isHome ? [] : [{ href: "/", label: t(locale, "appName") }]),
    ...links.map((n) => ({ href: n.href, label: t(locale, n.page) })),
  ];

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
        <div className="min-w-0 flex-1 text-center text-base font-semibold tracking-tight">
          {t(locale, "appName")}
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
          <h1
            className={
              isHome
                ? "hidden text-2xl font-semibold tracking-tight sm:block sm:text-3xl"
                : "text-2xl font-semibold tracking-tight"
            }
          >
            {title}
          </h1>
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
        <nav className="hidden flex-wrap items-center justify-end gap-3 sm:flex">
          {links.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              prefetch={false}
              className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              {t(locale, n.page)}
            </Link>
          ))}
          {!isHome && (
            <Link
              href="/"
              prefetch={false}
              className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              {"←"} {t(locale, "back")}
            </Link>
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
