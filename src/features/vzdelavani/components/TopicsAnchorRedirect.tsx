"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Témata bývala na stránce Zápisů pod kotvou `#temata`. Kotva se na server neposílá,
 * proto starý odkaz přesměruje až prohlížeč.
 */
export function TopicsAnchorRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (window.location.hash === "#temata") router.replace("/vzdelavani/temata");
  }, [router]);
  return null;
}
