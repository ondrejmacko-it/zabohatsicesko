"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, hashKey, withinRateLimit } from "@/server/audit";
import { accessCodeMatches, endSession, getCurrentUser, startSession } from "@/server/auth/session";
import { listPersonas } from "@/server/auth/personas";
import { config } from "@/server/config";
import { getDb } from "@/server/db/client";

export type GateState = { error: string | null };

const gateSchema = z.object({
  code: z.string().max(200).optional(),
  persona: z.string().min(1).max(64),
});

/** Vstup do ukázky: na hostingu ověří přístupový kód, pak založí session zvolené fiktivní role. */
export async function enterDemo(_prev: GateState, formData: FormData): Promise<GateState> {
  const parsed = gateSchema.safeParse({ code: formData.get("code") ?? undefined, persona: formData.get("persona") });
  if (!parsed.success) return { error: "Vyberte roli, se kterou chcete ukázku projít." };

  const db = await getDb();
  const expected = config.accessCode;
  if (expected !== null) {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!(await withinRateLimit(db, `gate:${hashKey(ip)}`, 10, 900))) {
      return { error: "Příliš mnoho pokusů. Zkuste to prosím za 15 minut." };
    }
    if (!accessCodeMatches(parsed.data.code ?? "", expected)) return { error: "Přístupový kód nesouhlasí." };
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
  if (current.signedInWith === "google") redirect("/");
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
