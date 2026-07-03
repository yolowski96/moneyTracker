"use client";

import { useFormStatus } from "react-dom";

export function DemoButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:opacity-80 disabled:opacity-50"
    >
      {pending ? "Preparing demo…" : "Try the demo"}
    </button>
  );
}
