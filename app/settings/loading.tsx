export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <div className="mb-10 h-10 w-40 animate-pulse rounded bg-[color:var(--surface)]" />
      <div className="space-y-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="h-14 animate-pulse" />
        <div className="h-14 animate-pulse" />
        <div className="h-14 animate-pulse" />
        <div className="h-14 animate-pulse" />
      </div>
    </main>
  );
}
