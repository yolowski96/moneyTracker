export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <div className="mb-10 h-8 w-40 animate-pulse rounded bg-[color:var(--surface)]" />
      <div className="mb-10 h-32 animate-pulse rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]" />
      <div className="space-y-3">
        <div className="h-12 animate-pulse rounded bg-[color:var(--surface)]" />
        <div className="h-12 animate-pulse rounded bg-[color:var(--surface)]" />
        <div className="h-12 animate-pulse rounded bg-[color:var(--surface)]" />
      </div>
    </main>
  );
}
