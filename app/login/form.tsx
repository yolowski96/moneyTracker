"use client";

import { useFormStatus } from "react-dom";

type Props = {
  action: (formData: FormData) => Promise<void>;
  redirectTo: string;
  error: string | null;
};

export function LoginForm({ action, redirectTo, error }: Props) {
  return (
    <form action={action} className="space-y-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error === "invalid"
            ? "Invalid email or password."
            : error === "missing"
              ? "Email and password are required."
              : "Something went wrong. Try again."}
        </div>
      )}

      <label className="block">
        <span className="text-xs text-[color:var(--muted)]">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--foreground)]"
        />
      </label>

      <label className="block">
        <span className="text-xs text-[color:var(--muted)]">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--foreground)]"
        />
      </label>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--foreground)] px-3 py-2 text-sm font-medium text-[color:var(--background)] transition hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}
