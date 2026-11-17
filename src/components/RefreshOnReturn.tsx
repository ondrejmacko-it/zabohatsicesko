"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Obnoví data stránky po návratu do okna (nejvýš jednou za minutu) a jinak mírně, jednou za 5 minut,
 * jen když je karta vidět. Žádný agresivní polling.
 */
export function RefreshOnReturn({ minGapMs = 60_000, intervalMs = 5 * 60_000 }: { minGapMs?: number; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < minGapMs) return;
      last = Date.now();
      router.refresh();
    };
    const timer = setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [minGapMs, intervalMs, router]);
  return null;
}
