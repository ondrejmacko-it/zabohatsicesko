"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, hashKey, withinRateLimit } from "@/server/audit";
import { DEVICE_COOKIE, confirmDevice, deviceCookieOptions, redeemCode, trustedDevice } from "@/server/auth/access-links";
import { RETURN_COOKIE, safeReturnPath } from "@/server/auth/return-path";
import { accessCodeMatches, endSession, getCurrentUser, startSession } from "@/server/auth/session";
import { listPersonas } from "@/server/auth/personas";
import { config, gateMode } from "@/server/config";
import { getDb } from "@/server/db/client";

export type GateState = { error: string | null };

const gateSchema = z.object({
  code: z.string().max(200).optional(),
  persona: z.string().min(1).max(64),
});

/** Vstup do ukázky: na hostingu ověří přístupový kód, pak založí session zvolené fiktivní role. */
export async function enterDemo(_prev: GateState, formData: FormData): Promise<GateState> {
  // Fiktivní role patří jen do ukázky. Při vstupu na pozvánku se jimi přihlásit nedá.
  if (gateMode() === "invite") return { error: "Přihlášení je možné jen osobním odkazem od správce." };
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
  // Kdo přišel odkazem z pozvánky, vrátí se tam, kam mířil.
  const jar = await cookies();
  const returnPath = safeReturnPath(jar.get(RETURN_COOKIE)?.value);
  jar.delete(RETURN_COOKIE);
  redirect(returnPath ?? "/");
}

/** Přihlášení jednorázovým kódem. Kód platí jen v prohlížeči, který otevřel osobní odkaz téhož člověka. */
export async function enterWithCode(_prev: GateState, formData: FormData): Promise<GateState> {
  const code = z.string().max(40).safeParse(formData.get("code"));
  const jar = await cookies();
  const db = await getDb();
  const device = await trustedDevice(db, jar.get(DEVICE_COOKIE)?.value);
  if (!device) return { error: "Přihlášení je možné jen osobním odkazem od správce." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const allowed =
    (await withinRateLimit(db, `kod-ip:${hashKey(ip)}`, 10, 900)) && (await withinRateLimit(db, `kod-ucet:${hashKey(device.userId)}`, 10, 900));
  if (!allowed) return { error: "Příliš mnoho pokusů. Zkuste to prosím za 15 minut." };
  if (!code.success || !(await redeemCode(db, device, code.data))) {
    return { error: "Kód nesouhlasí, už byl použit, nebo vypršel. Požádejte správce o nový." };
  }
  const deviceCookie = await confirmDevice(db, device);
  if (!deviceCookie) return { error: "Odkaz už byl použit na jiném zařízení. Požádejte správce o nový." };
  jar.set(DEVICE_COOKIE, deviceCookie, deviceCookieOptions);
  await startSession(device.userId, "code");
  await audit(db, device.userId, "session.start.code", "user", device.userId);
  const returnPath = safeReturnPath(jar.get(RETURN_COOKIE)?.value);
  jar.delete(RETURN_COOKIE);
  redirect(returnPath ?? "/");
}

/** Přepnutí fiktivní role. Vyžaduje platnou session, tedy už prošlou přístupovou bránu. */
export async function switchPersona(formData: FormData): Promise<void> {
  const current = await getCurrentUser();
  if (!current) redirect("/vstup");
  // Kdo se přihlásil svým účtem Google, vystupuje jen sám za sebe. Cizí roli si zvolit nesmí.
  if (current.signedInWith !== "demo" || gateMode() === "invite") redirect("/");
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
