import { asc, eq } from "drizzle-orm";
import { config } from "@/server/config";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";

/** Popis fiktivních rolí pro výběr v ukázce. */
const DESCRIPTIONS: Record<string, string> = {
  "demo-organizator": "Plánuje a zveřejňuje harmonogram, spravuje vazbu na Kalendář.",
  "demo-vedouci": "Vede akce, nahrává záznamy a kontroluje zápisy.",
  "demo-ucastnik": "Kolega ze skupiny finančních poradců.",
  "demo-mimo-skupinu": "Kolega ze skupiny RM, mimo publikum tréninku poradců.",
};

export type Persona = { id: string; name: string; description: string };

export async function listPersonas(): Promise<Persona[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.orgId, config.orgId))
    .orderBy(asc(users.id));
  const order = Object.keys(DESCRIPTIONS);
  return rows
    .map((u) => ({ ...u, description: DESCRIPTIONS[u.id] ?? "" }))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
