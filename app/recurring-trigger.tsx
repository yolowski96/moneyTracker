"use client";

import { useEffect, useRef } from "react";

// Fires the recurring-transactions materializer once per mount. Runs as a
// server action (not during render) because inserting rows means invalidating
// the transactions cache tag, which Next.js only allows outside of render.
export function RecurringTrigger({ action }: { action: () => Promise<void> }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void action();
  }, [action]);
  return null;
}
