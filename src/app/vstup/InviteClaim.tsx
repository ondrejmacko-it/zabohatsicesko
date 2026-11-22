"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const MESSAGES = {
  invalid: "Odkaz neplatí. Mohl vypršet, být už použitý na jiném zařízení, nebo ho správce zneplatnil. Požádej o nový.",
  limit: "Příliš mnoho pokusů. Zkus to prosím za 15 minut.",
  failed: "Odkaz se nepodařilo ověřit. Zkus stránku načíst znovu.",
} as const;

/**
 * Přečte token pozvánky z fragmentu adresy (na server se sám neposílá), hned ho z adresy smaže,
 * aby nezůstal v historii, a pošle ho POSTem. Server pak uloží cookie zařízení a stránka se obnoví.
 */
export function InviteClaim() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "checking" | keyof typeof MESSAGES>("idle");
  useEffect(() => {
    const token = window.location.hash.slice(1);
    if (!token) return;
    window.history.replaceState(null, "", window.location.pathname);
    // Fragment existuje jen v prohlížeči, server ho nezná. Stav se proto může nastavit až po hydrataci.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("checking");
    fetch("/api/pozvanka", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }), credentials: "same-origin" })
      .then(async (response) => {
        if (response.status === 204) {
          setState("idle");
          return router.refresh();
        }
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setState(body.error === "limit" ? "limit" : body.error === "invalid" ? "invalid" : "failed");
      })
      .catch(() => setState("failed"));
  }, [router]);
  if (state === "idle") return null;
  if (state === "checking") return <p role="status">Ověřuji pozvánku…</p>;
  return (
    <p className="form-error" role="alert">
      {MESSAGES[state]}
    </p>
  );
}
