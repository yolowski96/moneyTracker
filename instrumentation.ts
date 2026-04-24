// Runs once per serverless instance at boot. Warms the Prisma engine so the
// first request doesn't pay the ~1-3s engine-spawn + TLS handshake tax.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { prisma } = await import("./lib/prisma");
    try {
      await prisma.$connect();
    } catch {
      // Don't crash boot on DB hiccups — first real query will retry.
    }
  }
}
