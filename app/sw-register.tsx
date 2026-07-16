"use client";

import { useEffect } from "react";

// Registers the PWA service worker. Production only: a worker in dev outlives
// the dev server and serves confusing stale state.
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failing only means no install prompt; the app works.
    });
  }, []);
  return null;
}
