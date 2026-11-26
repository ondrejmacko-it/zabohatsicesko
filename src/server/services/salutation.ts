import { and, eq } from "drizzle-orm";
import { config, salutationsEnabled } from "@/server/config";
import { getDb } from "@/server/db/client";
import { userSalutations } from "@/server/db/schema";
import type { Viewer } from "@/server/policy";
import { DomainError } from "@/server/services/errors";

export const SALUTATION_MAX = 40;

/**
 * Vlastní oslovení: prázdné = smazat (pozdrav se vrátí ke slovníku). Jen písmena, mezera, tečka, apostrof a
 * spojovník, aby pozdrav nešel zneužít k jinému textu. Null = neplatný vstup.
 */
export function normalizeSalutation(input: string): string | "" | null {
  const value = input.normalize("NFC").trim().replace(/\s+/g, " ");
  if (value === "") return "";
  if (value.length > SALUTATION_MAX || !/^\p{L}[\p{L}\p{M} .'’-]*$/u.test(value)) return null;
  return value;
}

/** Oslovení člověka, nebo null (bez migrace, nenastavené). */
export async function getSalutation(userId: string): Promise<string | null> {
  if (!salutationsEnabled()) return null;
  const db = await getDb();
  const [row] = await db
    .select({ salutation: userSalutations.salutation })
    .from(userSalutations)
    .where(and(eq(userSalutations.orgId, config.orgId), eq(userSalutations.userId, userId)))
    .limit(1);
  return row?.salutation ?? null;
}

/** Uloží nebo smaže oslovení přihlášeného. Měnit lze jen vlastní (id ze session, ne z formuláře). */
export async function setSalutation(viewer: Viewer, input: string): Promise<void> {
  if (!salutationsEnabled()) throw new DomainError("invalid_state");
  const value = normalizeSalutation(input);
  if (value === null) throw new DomainError("invalid_input");
  const db = await getDb();
  const key = and(eq(userSalutations.orgId, config.orgId), eq(userSalutations.userId, viewer.id));
  if (value === "") {
    await db.delete(userSalutations).where(key);
    return;
  }
  await db
    .insert(userSalutations)
    .values({ orgId: config.orgId, userId: viewer.id, salutation: value })
    .onConflictDoUpdate({ target: [userSalutations.orgId, userSalutations.userId], set: { salutation: value, updatedAt: new Date() } });
}
