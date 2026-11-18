import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { GROUPS, type Group, type Role, type UserOrigin, type UserStatus } from "@/lib/types";
import { audit } from "@/server/audit";
import { createInvite, inviteOnlyLogin, listUserAccess, pruneOldAccess, revokeDevice, revokeInvites, revokeUserDevices, type UserAccess } from "@/server/auth/devices";
import { requeueAttendeeSync } from "@/server/calendar/attendees";
import { config, isPrimaryAdmin } from "@/server/config";
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
  /** Hlavní správce (`BOOTSTRAP_ADMIN_EMAILS`): účet nikdo nemění, ani on sám. */
  primary: boolean;
  /** Hlavní správce se dívá na vlastní účet: smí si vytvořit odkaz pro další zařízení. */
  ownPrimary: boolean;
  /** Poslední zvací odkaz a platná zařízení (ostrá Wiki). */
  access: UserAccess;
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
  const accessByUser = await listUserAccess(db, rows.map((r) => r.user.id));
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
      primary: isPrimaryAdmin(user),
      ownPrimary: isPrimaryAdmin(user) && user.id === viewer.id,
      editable: canManageAccount(viewer, user) && !isPrimaryAdmin(user),
      access: accessByUser.get(user.id) ?? { invite: { kind: "none" as const }, devices: [] },
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

export type AccessInput = { role: Role; groups: Group[] };

/**
 * Pozve adresu Google. Účet je hned aktivní, s účtem Google se sváže při prvním přihlášení.
 * E-mail Wiki neposílá: kolega dostane odkaz od správce a přihlásí se touto adresou.
 */
export async function inviteUser(
  viewer: Viewer,
  input: AccessInput & { email: string; name: string },
): Promise<{ id: string; link: { token: string; expiresAt: Date } | null }> {
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
    // Pozvaný patří do publika hned: budoucí pozvánky jeho skupin ho přiberou.
    await requeueAttendeeSync(tx, input.groups);
    // Ostrá Wiki pustí dovnitř jen přes odkaz. Ukázka ho nepotřebuje (přihlášení řeší její brána).
    const link = inviteOnlyLogin() ? await createInvite(tx, viewer.id, id) : null;
    return { id, link };
  });
}

/**
 * Účet, se kterým správce smí pracovat: odkazy a zařízení i pro sebe (třeba druhé zařízení).
 * `ownPrimaryLink`: hlavní správce smí pracovat s odkazem jen pro vlastní účet, nikdo jiný.
 */
async function manageableUser(tx: Executor, viewer: Viewer, userId: string, { ownPrimaryLink = false } = {}) {
  if (!canManageUsers(viewer)) throw new DomainError("forbidden");
  const [target] = await tx
    .select({ id: users.id, status: users.status, origin: users.origin, email: users.email })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, config.orgId)))
    .limit(1);
  if (!target) throw new DomainError("not_found");
  // Hlavnímu správci nikdo jiný nevytvoří odkaz ani nezruší zařízení, aby se z Wiki nedal vyřadit.
  // Odkaz pro další zařízení si smí vytvořit (a zneplatnit) jen on sám. Zařízení mu nezruší nikdo.
  if (isPrimaryAdmin(target) && !(ownPrimaryLink && target.id === viewer.id)) throw new DomainError("forbidden");
  return target;
}

/** Nový zvací odkaz pro aktivní účet. Starší nepoužitý odkaz přestane platit. */
export async function createLoginLink(viewer: Viewer, userId: string): Promise<{ token: string; expiresAt: Date }> {
  if (!inviteOnlyLogin()) throw new DomainError("forbidden");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const target = await manageableUser(tx, viewer, userId, { ownPrimaryLink: true });
    if (target.status !== "active" || target.origin === "demo") throw new DomainError("forbidden");
    await pruneOldAccess(tx);
    return createInvite(tx, viewer.id, userId);
  });
}

export async function revokeLoginLink(viewer: Viewer, userId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await manageableUser(tx, viewer, userId, { ownPrimaryLink: true });
    await revokeInvites(tx, viewer.id, userId);
  });
}

/** Odhlásí jedno zařízení účtu. Session z něj skončí při dalším požadavku. */
export async function revokeUserDevice(viewer: Viewer, userId: string, deviceId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await manageableUser(tx, viewer, userId);
    const access = (await listUserAccess(tx, [userId])).get(userId);
    if (!access?.devices.some((d) => d.id === deviceId)) throw new DomainError("not_found");
    await revokeDevice(tx, viewer.id, deviceId);
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
      .select({ id: users.id, role: users.role, status: users.status, orgId: users.orgId, groups: users.groups, email: users.email })
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
    if (!canManageAccount(current, target, input.role) || isPrimaryAdmin(target)) throw new DomainError("forbidden");

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
    // Odebraný přístup = žádné platné zařízení ani odkaz. Vrácený přístup pak potřebuje nový odkaz.
    if (input.status === "disabled") {
      await revokeUserDevices(tx, userId);
      await revokeInvites(tx, viewer.id, userId);
    }
    // Publikum se mohlo změnit ve starých i nových skupinách. Budoucí pozvánky se podle toho upraví.
    await requeueAttendeeSync(tx, [...new Set([...target.groups, ...input.groups])]);
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
