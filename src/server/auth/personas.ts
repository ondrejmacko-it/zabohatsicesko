import { and, asc, eq } from "drizzle-orm";
import { config } from "@/server/config";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";

/** Popis fiktivních rolí pro výběr v ukázce. */
const DESCRIPTIONS: Record<string, string> = {
  "demo-spravce": "Plánuje a zveřejňuje akce, spravuje účty a skupiny, vidí vše.",
  "demo-organizator": "Správce: plánuje a zveřejňuje harmonogram, spravuje účty a Kalendář.",
  "demo-vedouci": "Vede akce, nahrává záznamy a kontroluje zápisy.",
  "demo-ucastnik": "Kolega ze skupiny finančních poradců.",
  "demo-mimo-skupinu": "Kolega ze skupiny RM, mimo publikum tréninku poradců.",
};

export type Persona = { id: string; name: string; description: string };

/** Jen fiktivní role ukázky. Skutečné účty z pozvánek a žádostí se za ně nikdy nedají vydávat. */
export async function listPersonas(): Promise<Persona[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.orgId, config.orgId), eq(users.origin, "demo"), eq(users.status, "active")))
    .orderBy(asc(users.id));
  const order = Object.keys(DESCRIPTIONS);
  return rows
    .map((u) => ({ ...u, description: DESCRIPTIONS[u.id] ?? "" }))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
