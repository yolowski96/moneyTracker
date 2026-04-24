"use client";

import { useState, useTransition } from "react";

type Labels = {
  yourKey: string;
  noKeyYet: string;
  noKeyHint: string;
  show: string;
  hide: string;
  copy: string;
  copied: string;
  regenerate: string;
  regenerating: string;
  generate: string;
  generating: string;
  regenerateWarn: string;
};

type Props = {
  token: string | null;
  labels: Labels;
  action: () => Promise<void>;
};

export function ApiKeyCard({ token, labels, action }: Props) {
  const [isPending, startTransition] = useTransition();
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  const masked = token
    ? token.slice(0, 4) + "\u2026".repeat(8) + token.slice(-4)
    : null;

  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-medium">
          {token ? labels.yourKey : labels.noKeyYet}
        </div>
        <div className="text-xs text-[color:var(--muted)]">
          <code className="font-mono">{"Authorization: Bearer \u2026"}</code>
        </div>
      </div>

      {token ? (
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 font-mono text-xs tabular-nums">
            {reveal ? token : masked}
          </code>
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="rounded-md border border-[color:var(--border)] px-3 py-2 text-xs hover:bg-[color:var(--background)]"
          >
            {reveal ? labels.hide : labels.show}
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded-md border border-[color:var(--border)] px-3 py-2 text-xs hover:bg-[color:var(--background)]"
          >
            {copied ? labels.copied : labels.copy}
          </button>
        </div>
      ) : (
        <div className="mt-3 text-xs text-[color:var(--muted)]">
          {labels.noKeyHint}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => startTransition(() => action())}
          disabled={isPending}
          className="rounded-md border border-[color:var(--border)] px-3 py-1.5 text-xs hover:bg-[color:var(--background)] disabled:opacity-50"
        >
          {isPending
            ? token
              ? `${labels.regenerating}\u2026`
              : `${labels.generating}\u2026`
            : token
              ? labels.regenerate
              : labels.generate}
        </button>
        {token && (
          <span className="text-xs text-[color:var(--muted)]">
            {labels.regenerateWarn}
          </span>
        )}
      </div>
    </div>
  );
}
