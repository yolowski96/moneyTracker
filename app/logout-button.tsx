"use client";

import { useFormStatus } from "react-dom";
import { logoutAction } from "./actions";

export function LogoutButton({ label }: { label: string }) {
  return (
    <form action={logoutAction}>
      <Submit label={label} />
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)] disabled:opacity-50"
    >
      {pending ? `${label}\u2026` : label}
    </button>
  );
}
