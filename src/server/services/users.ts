import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { GROUPS, type Group, type Role, type UserOrigin, type UserStatus } from "@/lib/types";
import { audit } from "@/server/audit";
import { config } from "@/server/config";
import { getDb, type Executor } from "@/server/db/client";
import { userIdentities, users } from "@/server/db/schema";
import { canManageAccount, canManageUsers, type Viewer } from "@/server/policy";
import { DomainError } from "@/server/services/errors";

// Správa uživatelů Wiki: pozvání adresy, schválení žádosti, změna role a skupin, odebrání přístupu.
// Google jen ověřuje identitu. Kdo smí dovnitř a co uvidí, rozhoduje výhradně tento modul.

export type Account = {
  id: string;
  name: string;
  email: string;
  role: Role;
  groups: Group[];
  status: UserStatus;
  origin: UserOrigin;
  googleLinked: boolean;
  lastLoginAt: Date | null;
  /** Smí přihlášený uživatel tento účet měnit (ne sebe, správce jen jiný správce). */
  editable: boolean;
};

const STATUS_ORDER: Record<UserStatus, number> = { pending: 0, active: 1, disabled: 2 };

/** Všechny účty organizace pro stránku Správa. Čekající žádosti jsou první. */
export async function listAccounts(viewer: Viewer): Promise<Account[]> {
  if (!canManageUsers(viewer)) throw new DomainError("forbidden");
  const db = await getDb();
  const rows = await db
    .select({ user: users, lastLoginAt: userIdentities.lastLoginAt, subject: userIdentities.subject })
    .from(users)
    .leftJoin(userIdentities, eq(userIdentities.userId, users.id))
    .where(eq(users.orgId, config.orgId))
    .orderBy(asc(users.name));
  return rows
    .map(({ user, lastLoginAt, subject }) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      groups: user.groups.filter((g): g is Group => (GROUPS as readonly string[]).includes(g)),
      status: user.status,
      origin: user.origin,
      googleLinked: subject !== null,
      lastLoginAt,
      editable: canManageAccount(viewer, user),
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

export type AccessInput = { role: Role; groups: Group[] };

/**
 * Pozve adresu Google. Účet je hned aktivní, s účtem Google se sváže při prvním přihlášení.
 * E-mail Wiki neposílá: kolega dostane odkaz od správce a přihlásí se touto adresou.
 */
export async function inviteUser(viewer: Viewer, input: AccessInput & { email: string; name: string }): Promise<string> {
  if (!canManageAccount(viewer, { id: "", role: "member" }, input.role)) throw new DomainError("forbidden");
  const email = input.email.trim().toLowerCase();
  const db = await getDb();
  const id = `u-${randomUUID()}`;
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(users)
      .values({ id, orgId: config.orgId, name: input.name, email, role: input.role, groups: input.groups, status: "active", origin: "invite" })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (!inserted.length) throw new DomainError("email_taken");
    await audit(tx, viewer.id, "user.invited", "user", id);
    return id;
  });
}

/**
 * Nastaví roli, skupiny a stav účtu. Schválení žádosti je změna stavu z „čeká“ na „aktivní“.
 * Běží pod zámkem na účtu správce i cíle, aby si dva správci souběžně neodebrali práva navzájem
 * a nezůstala Wiki bez správce. Zámky se berou v pořadí podle ID, takže se nezablokují.
 */
export async function updateAccess(
  viewer: Viewer,
  userId: string,
  input: AccessInput & { status: "active" | "disabled" },
): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const ids = [viewer.id, userId].sort();
    const locked = await tx
      .select({ id: users.id, role: users.role, status: users.status, orgId: users.orgId })
      .from(users)
      .where(inArray(users.id, ids))
      .orderBy(asc(users.id))
      .for("update");
    const actor = locked.find((u) => u.id === viewer.id);
    const target = locked.find((u) => u.id === userId);
    if (!target || target.orgId !== config.orgId) throw new DomainError("not_found");
    // Práva čtená na začátku požadavku mohla mezitím zmizet. Rozhoduje stav pod zámkem.
    if (!actor || actor.status !== "active") throw new DomainError("forbidden");
    const current = { ...viewer, role: actor.role };
    if (!canManageAccount(current, target, input.role)) throw new DomainError("forbidden");

    await tx
      .update(users)
      .set({ role: input.role, groups: input.groups, status: input.status })
      .where(eq(users.id, userId));
    const action =
      target.status === "pending" && input.status === "active"
        ? "user.approved"
        : input.status !== target.status
          ? input.status === "disabled" ? "user.disabled" : "user.enabled"
          : "user.access_changed";
    await audit(tx, viewer.id, action, "user", userId);
  });
}

/** Zamítne čekající žádost. Účet i vazba na Google zmizí, příští přihlášení vytvoří novou žádost. */
export async function rejectRequest(viewer: Viewer, userId: string): Promise<void> {
  if (!canManageUsers(viewer)) throw new DomainError("forbidden");
  const db = await getDb();
  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(users)
      .where(and(eq(users.id, userId), eq(users.orgId, config.orgId), eq(users.status, "pending"), eq(users.origin, "request")))
      .returning({ id: users.id });
    if (!deleted.length) throw new DomainError("not_found");
    await audit(tx, viewer.id, "user.rejected", "user", userId);
  });
}

/** Počet čekajících žádostí pro odznak v menu. Jen pro toho, kdo je smí vyřídit. */
export async function pendingRequestCount(db: Executor, viewer: Viewer): Promise<number> {
  if (!canManageUsers(viewer)) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.orgId, config.orgId), eq(users.status, "pending")));
  return row?.n ?? 0;
}
