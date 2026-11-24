import { and, eq, inArray } from "drizzle-orm";
import type { ExcuseReason } from "@/lib/types";
import { audit } from "@/server/audit";
import { config, excuseManagersEnabled } from "@/server/config";
import { getDb, type Executor } from "@/server/db/client";
import { eventParticipation, excuseManagers, users } from "@/server/db/schema";
import { canManageUsers, canReadExcuseDetails, type Viewer } from "@/server/policy";
import { DomainError } from "@/server/services/errors";

// Nadřízení pro omluvy (F03/D01, migrace 0018). Vazba je zároveň oprávnění a platí jen pro konkrétního člověka.
// Skutečné vazby i dobu uchování určuje firma; Wiki si žádné vztahy neodvozuje (ani z rolí, ani z vedení akcí).

export const MAX_EXCUSE_MANAGERS = 5;

/** Lidé, jejichž důvody omluv smí `managerId` číst. */
export async function managedEmployeeIds(db: Executor, managerId: string): Promise<Set<string>> {
  if (!excuseManagersEnabled()) return new Set();
  const rows = await db
    .select({ id: excuseManagers.employeeId })
    .from(excuseManagers)
    .where(and(eq(excuseManagers.orgId, config.orgId), eq(excuseManagers.managerId, managerId)));
  return new Set(rows.map((row) => row.id));
}

/** Pro Správu: kdo je u koho nadřízeným pro omluvy. Jen správce; nic o samotných omluvách. */
export async function listExcuseManagers(viewer: Viewer): Promise<Map<string, string[]> | null> {
  if (!canManageUsers(viewer)) throw new DomainError("forbidden");
  if (!excuseManagersEnabled()) return null;
  const db = await getDb();
  const rows = await db
    .select({ managerId: excuseManagers.managerId, employeeId: excuseManagers.employeeId })
    .from(excuseManagers)
    .where(eq(excuseManagers.orgId, config.orgId));
  const map = new Map<string, string[]>();
  for (const row of rows) map.set(row.employeeId, [...(map.get(row.employeeId) ?? []), row.managerId]);
  return map;
}

/**
 * Nastaví nadřízené pro omluvy jednoho člověka (nahradí dosavadní). Jen správce. Nadřízený musí být aktivní
 * účet v organizaci a nesmí to být člověk sám. Do auditu jde jen kdo změnil koho, nic o omluvách.
 */
export async function setExcuseManagers(viewer: Viewer, employeeId: string, managerIds: string[]): Promise<void> {
  if (!canManageUsers(viewer)) throw new DomainError("forbidden");
  if (!excuseManagersEnabled()) throw new DomainError("forbidden");
  const ids = [...new Set(managerIds)];
  if (ids.length > MAX_EXCUSE_MANAGERS || ids.includes(employeeId)) throw new DomainError("invalid_input");
  const db = await getDb();
  await db.transaction(async (tx) => {
    const people = await tx
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(and(eq(users.orgId, config.orgId), inArray(users.id, [employeeId, ...ids])))
      .for("update");
    if (!people.some((p) => p.id === employeeId)) throw new DomainError("not_found");
    if (ids.some((id) => people.find((p) => p.id === id)?.status !== "active")) throw new DomainError("invalid_input");
    await tx.delete(excuseManagers).where(and(eq(excuseManagers.orgId, config.orgId), eq(excuseManagers.employeeId, employeeId)));
    if (ids.length > 0) {
      await tx.insert(excuseManagers).values(ids.map((managerId) => ({ orgId: config.orgId, managerId, employeeId, createdBy: viewer.id })));
    }
    await audit(tx, viewer.id, "excuse_managers.changed", "user", employeeId);
  });
}

export type ManagedExcuse = { name: string; reason: ExcuseReason; note: string | null };

/**
 * Omluvení u akce, jejichž důvod smí přihlášený číst jako nadřízený. Náhled nikdy (volající předá `preview`):
 * správce se díváním „za kolegu“ k důvodům nedostane, ani když je sám něčím nadřízeným.
 */
export async function managedExcusesAt(viewer: Viewer, eventId: string, preview: boolean): Promise<ManagedExcuse[]> {
  if (preview || !excuseManagersEnabled()) return [];
  const db = await getDb();
  const managed = await managedEmployeeIds(db, viewer.id);
  if (managed.size === 0) return [];
  const rows = await db
    .select({ userId: eventParticipation.userId, name: users.name, reason: eventParticipation.excuseReason, note: eventParticipation.excuseNote })
    .from(eventParticipation)
    .innerJoin(users, and(eq(users.orgId, eventParticipation.orgId), eq(users.id, eventParticipation.userId)))
    .where(
      and(
        eq(eventParticipation.orgId, config.orgId),
        eq(eventParticipation.eventId, eventId),
        eq(eventParticipation.kind, "excused"),
        inArray(eventParticipation.userId, [...managed]),
      ),
    );
  return rows
    .filter((row) => row.reason && canReadExcuseDetails(viewer, row.userId, managed))
    .map((row) => ({ name: row.name, reason: row.reason!, note: row.note }))
    .sort((a, b) => a.name.localeCompare(b.name, "cs"));
}
