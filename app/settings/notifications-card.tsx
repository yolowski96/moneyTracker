"use client";

import { useEffect, useState, useTransition } from "react";

type Labels = {
  describe: string;
  enable: string;
  disable: string;
  working: string;
  enabled: string;
  disabled: string;
  unsupported: string;
  denied: string;
};

type Props = {
  vapidPublicKey: string;
  labels: Labels;
  onSubscribe: (input: { endpoint: string; p256dh: string; auth: string }) => Promise<void>;
  onUnsubscribe: (endpoint: string) => Promise<void>;
};

type Status = "loading" | "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function NotificationsCard({
  vapidPublicKey,
  labels,
  onSubscribe,
  onUnsubscribe,
}: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (
        !vapidPublicKey ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      // getRegistration (not .ready): resolves undefined instead of hanging
      // when no worker is registered (dev mode registers none).
      const reg = await navigator.serviceWorker.getRegistration();
      if (cancelled) return;
      if (!reg) {
        setStatus("unsupported");
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      if (cancelled) return;
      setStatus(sub ? "on" : "off");
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  function enable() {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          setStatus("unsupported");
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          await sub.unsubscribe();
          setStatus("off");
          return;
        }
        await onSubscribe({
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        });
        setStatus("on");
      } catch {
        setStatus("off");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await onUnsubscribe(sub.endpoint);
        }
        setStatus("off");
      } catch {
        // keep current state; user can retry
      }
    });
  }

  if (status === "loading") return null;

  if (status === "unsupported" || status === "denied") {
    return (
      <div className="text-xs text-[color:var(--muted)]">
        {status === "unsupported" ? labels.unsupported : labels.denied}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[color:var(--muted)]">{labels.describe}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={status === "on" ? disable : enable}
          disabled={isPending}
          className="rounded-md border border-[color:var(--border)] px-3 py-1.5 text-xs hover:bg-[color:var(--background)] disabled:opacity-50"
        >
          {isPending
            ? `${labels.working}…`
            : status === "on"
              ? labels.disable
              : labels.enable}
        </button>
        <span className="text-xs text-[color:var(--muted)]">
          {status === "on" ? labels.enabled : labels.disabled}
        </span>
      </div>
    </div>
  );
}
