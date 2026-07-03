// Demo mode (spec: docs/superpowers/specs/2026-07-02-demo-mode-design.md).
// Everything demo-related is gated on the DEMO_PASSWORD env var: without it
// the login page shows no demo button, the enter action refuses, and the
// mock portfolio route 404s. The value doubles as the demo account's
// credentials password so sign-in reuses the normal credentials provider.

export const DEMO_EMAIL = "demo@bankopolis.app";

export function demoEnabled(): boolean {
  return !!process.env.DEMO_PASSWORD;
}
