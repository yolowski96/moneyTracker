"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { logoutAction } from "./actions";

export type MobileMenuItem = {
  href: string;
  label: string;
  badge?: number;
};

export function MobileMenu({
  items,
  ariaLabel,
  title,
  userEmail,
  signOutLabel,
}: {
  items: MobileMenuItem[];
  ariaLabel: string;
  title: string;
  userEmail?: string | null;
  signOutLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--border)] text-[color:var(--foreground)] transition hover:bg-[color:var(--surface)] sm:hidden"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      <div
        className={
          "fixed inset-0 z-40 bg-black/50 transition-opacity sm:hidden " +
          (open ? "opacity-100" : "pointer-events-none opacity-0")
        }
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] transform flex-col border-r border-[color:var(--border)] bg-[color:var(--background)] shadow-xl transition-transform duration-200 ease-out sm:hidden " +
          (open ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-4">
          <div className="text-sm font-semibold tracking-tight">{title}</div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--muted)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <nav className="flex flex-1 flex-col p-2">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-3 rounded px-3 py-3 text-sm text-[color:var(--foreground)] hover:bg-[color:var(--surface)]"
            >
              <span>{it.label}</span>
              {it.badge && it.badge > 0 ? (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white tabular-nums">
                  {it.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
        {(userEmail || signOutLabel) && (
          <div className="border-t border-[color:var(--border)] p-3">
            {userEmail && (
              <div className="mb-2 truncate px-3 text-xs text-[color:var(--muted)]">
                {userEmail}
              </div>
            )}
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full rounded px-3 py-2 text-left text-sm text-[color:var(--muted)] hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]"
              >
                {signOutLabel ?? "Sign out"}
              </button>
            </form>
          </div>
        )}
      </aside>
    </>
  );
}
