"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/server/audit";
import { checkAccessCode, grantGatePass, hasGatePass } from "@/server/auth/gate";
import { endSession, getCurrentUser, startSession } from "@/server/auth/session";
import { listPersonas } from "@/server/auth/personas";
import { config, isLiveWiki } from "@/server/config";
import { getDb } from "@/server/db/client";

export type GateState = { error: string | null };

const gateSchema = z.object({
  code: z.string().max(200).optional(),
  persona: z.string().min(1).max(64),
});

/**
 * Vstup do ukázky: na hostingu stačí platná cookie brány (zvací odkaz), jinak ověří ručně zadaný kód
 * a cookie vydá. Pak založí session zvolené fiktivní role.
 */
export async function enterDemo(_prev: GateState, formData: FormData): Promise<GateState> {
  const parsed = gateSchema.safeParse({ code: formData.get("code") ?? undefined, persona: formData.get("persona") });
  // Ostrá Wiki pouští dovnitř jen účty Google. Kontrola je tady, ne jen ve skrytém formuláři.
  if (isLiveWiki()) return { error: "Do Wiki se přihlaste účtem Google." };
  if (!parsed.success) return { error: "Vyberte roli, se kterou chcete ukázku projít." };

  const db = await getDb();
  const expected = config.accessCode;
  if (expected !== null && !(await hasGatePass())) {
    const check = await checkAccessCode(db, parsed.data.code ?? "", expected);
    if (check === "limited") return { error: "Příliš mnoho pokusů. Zkuste to prosím za 15 minut." };
    if (check === "wrong") return { error: "Přístupový kód nesouhlasí." };
    await grantGatePass(expected);
  }
  const personas = await listPersonas();
  if (!personas.some((p) => p.id === parsed.data.persona)) return { error: "Vyberte roli ze seznamu." };

  await startSession(parsed.data.persona);
  await audit(db, parsed.data.persona, "session.start", "user", parsed.data.persona);
  redirect("/");
}

/** Přepnutí fiktivní role. Vyžaduje platnou session, tedy už prošlou přístupovou bránu. */
export async function switchPersona(formData: FormData): Promise<void> {
  const current = await getCurrentUser();
  if (!current) redirect("/vstup");
  // Kdo se přihlásil svým účtem Google, vystupuje jen sám za sebe. Cizí roli si zvolit nesmí.
  if (current.signedInWith === "google" || isLiveWiki()) redirect("/");
  const persona = String(formData.get("persona") ?? "");
  const personas = await listPersonas();
  if (personas.some((p) => p.id === persona)) {
    await startSession(persona);
    await audit(await getDb(), current.id, "session.switch", "user", persona);
  }
  redirect("/");
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/vstup");
}
