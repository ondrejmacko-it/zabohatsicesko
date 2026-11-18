import { and, asc, eq } from "drizzle-orm";
import { config, isLiveWiki } from "@/server/config";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";

/** Popis fiktivních rolí pro výběr v ukázce. */
const DESCRIPTIONS: Record<string, string> = {
  "demo-spravce": "Plánuje a zveřejňuje akce, spravuje účty a skupiny, vidí vše.",
  "demo-vedouci": "Vede akce, nahrává nahrávky a kontroluje zápisy.",
  "demo-ucastnik": "Kolega ze skupiny finančních poradců.",
  "demo-mimo-skupinu": "Kolega ze skupiny RM, mimo publikum tréninku poradců.",
};

export type Persona = { id: string; name: string; description: string };

/** Jen fiktivní role ukázky. Skutečné účty z pozvánek a žádostí se za ně nikdy nedají vydávat. */
export async function listPersonas(): Promise<Persona[]> {
  if (isLiveWiki()) return [];
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.orgId, config.orgId), eq(users.origin, "demo"), eq(users.status, "active")))
    .orderBy(asc(users.id));
  const order = Object.keys(DESCRIPTIONS);
  // Druhý účet správce má stejná práva jako první, ve výběru by jen mátl. Účet zůstává (váže se na něj testovací účet Google).
  // Starší sdílená DB (seed z doby před `demo-spravce`) prvního správce nemá; pak výběr ukáže druhého, ať správce nechybí.
  const hasPrimaryAdmin = rows.some((u) => u.id === "demo-spravce");
  const slotOf = (id: string) => (!hasPrimaryAdmin && id === "demo-organizator" ? "demo-spravce" : id);
  return rows
    .filter((u) => slotOf(u.id) in DESCRIPTIONS)
    .map((u) => ({ ...u, description: DESCRIPTIONS[slotOf(u.id)] ?? "" }))
    .sort((a, b) => order.indexOf(slotOf(a.id)) - order.indexOf(slotOf(b.id)));
}
