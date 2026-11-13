import { and, asc, eq } from "drizzle-orm";
import { GROUP_LABELS } from "@/lib/labels";
import type { Group } from "@/lib/types";
import { config } from "@/server/config";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { isOrganizer, type Viewer } from "@/server/policy";
import { DomainError } from "@/server/services/errors";

// Náhled harmonogramu očima někoho jiného. Organizátor si vybere skupinu nebo kolegu a seznam akcí
// se spočítá stejnými pravidly (policy.ts) jako pro skutečného uživatele. Náhled je jen ke čtení.

/** Skupiny, za které jde náhled zapnout. Každý účastník je zároveň ve skupině Všichni. */
const PREVIEW_GROUPS: Group[] = ["fp", "rm", "tym-a"];

export type PreviewOption = { key: string; label: string };
export type PlanPreview = { viewer: Viewer; label: string };

const groupKey = (group: Group) => `skupina-${group}`;
const userKey = (id: string) => `kolega-${id}`;

/** Nabídka „Zobrazit jako“: skupiny účastníků a aktivní kolegové (kvůli pohledu vedoucího). */
export async function listPreviewOptions(viewer: Viewer): Promise<{ groups: PreviewOption[]; people: PreviewOption[] }> {
  if (!isOrganizer(viewer)) throw new DomainError("forbidden");
  const db = await getDb();
  const people = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.orgId, config.orgId), eq(users.status, "active")))
    .orderBy(asc(users.name));
  return {
    groups: PREVIEW_GROUPS.map((g) => ({ key: groupKey(g), label: `Účastník · ${GROUP_LABELS[g]}` })),
    people: people.filter((p) => p.id !== viewer.id).map((p) => ({ key: userKey(p.id), label: p.name })),
  };
}

/**
 * Uživatel, jehož očima se má harmonogram ukázat. Smí jen organizátor, jinak (a pro neznámý klíč)
 * vrací null a stránka ukáže běžný pohled přihlášeného.
 */
export async function resolvePreview(viewer: Viewer, key: string | undefined): Promise<PlanPreview | null> {
  if (!key || !isOrganizer(viewer)) return null;
  const group = PREVIEW_GROUPS.find((g) => groupKey(g) === key);
  if (group) {
    return { viewer: { id: "nahled-skupiny", role: "member", groups: ["vsichni", group] }, label: `účastník ze skupiny ${GROUP_LABELS[group]}` };
  }
  if (!key.startsWith("kolega-")) return null;
  const db = await getDb();
  const [person] = await db
    .select()
    .from(users)
    .where(and(eq(users.orgId, config.orgId), eq(users.id, key.slice("kolega-".length)), eq(users.status, "active")))
    .limit(1);
  if (!person || person.id === viewer.id) return null;
  return { viewer: { id: person.id, role: person.role, groups: person.groups }, label: person.name };
}
