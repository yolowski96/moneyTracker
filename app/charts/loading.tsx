export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <div className="mb-10 h-10 w-40 animate-pulse rounded bg-[color:var(--surface)]" />
      <div className="mb-6 h-64 animate-pulse rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]" />
      <div className="h-64 animate-pulse rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]" />
    </main>
  );
}
