"use client";

import { useFormStatus } from "react-dom";
import { logoutAction } from "./actions";

export function LogoutIcon({ ariaLabel }: { ariaLabel: string }) {
  return (
    <form action={logoutAction}>
      <Submit ariaLabel={ariaLabel} />
    </form>
  );
}

function Submit({ ariaLabel }: { ariaLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--border)] text-sm text-[color:var(--muted)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)] disabled:opacity-50"
    >
      <span>{pending ? "⏳" : "\u{1F6AA}"}</span>
    </button>
  );
}
