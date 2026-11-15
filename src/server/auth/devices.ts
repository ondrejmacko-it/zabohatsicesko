import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { audit } from "@/server/audit";
import { config, isLiveWiki } from "@/server/config";
import type { Executor } from "@/server/db/client";
import { loginInvites, trustedDevices, users } from "@/server/db/schema";

// Přihlášení do ostré Wiki jen přes pozvánku na jedno zařízení.
//
// 1. Správce vytvoří odkaz `/vstup#<token>`. Token má 256 bitů, v DB je jen jeho otisk (HMAC).
// 2. Prohlížeč pošle token POSTem (fragment se na server sám neposílá). Server pozvánku jedním
//    podmíněným UPDATE spotřebuje a založí zařízení. Prohlížeč dostane HttpOnly cookie `<id>.<tajemství>`,
//    v DB je opět jen otisk tajemství.
// 3. Jen se zařízením server nabídne a dokončí přihlášení Googlem, a to jen pro účet z pozvánky.
//    Session nese ID zařízení, takže zneplatnění zařízení odhlásí hned.

export const INVITE_TTL_DAYS = 7;
/**
 * Zařízení samo nevyprší: platí, dokud ho správce nezruší nebo neodebere přístup. Sloupec `expires_at`
 * zůstává kvůli dotazům a úklidu, nová zařízení v něm mají vzdálené datum.
 */
export const DEVICE_NEVER_EXPIRES = new Date("9999-12-31T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
/** Prodloužení platnosti zařízení se zapisuje nejvýš jednou za hodinu, ne při každém požadavku. */
const TOUCH_AFTER_MS = 60 * 60 * 1000;

export const DEVICE_COOKIE = config.isProduction ? "__Host-zbc_device" : "zbc_device";
export const deviceCookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: "lax" as const,
  path: "/",
  // Rozhoduje platnost v DB. Cookie jen musí vydržet déle, prohlížeče víc než 400 dní nedovolí.
  maxAge: 400 * 24 * 60 * 60,
};

/** Přihlášení jen přes pozvánku platí v ostré Wiki. Ukázka (preview) má vlastní bránu s kódem. */
export const inviteOnlyLogin = () => isLiveWiki();

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const ID = /^d-[0-9a-f-]{36}$/;

const digest = (kind: "invite" | "device", value: string) =>
  createHmac("sha256", config.sessionSecret).update(`${kind}:${value}`).digest("base64url");

const newSecret = () => randomBytes(32).toString("base64url");

export const isInviteToken = (value: unknown): value is string => typeof value === "string" && TOKEN.test(value);

/** Krátký popisek zařízení pro správce. Jen prohlížeč a systém, nic identifikujícího. */
export function deviceLabel(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Prohlížeč";
  const system = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "neznámý systém";
  return `${browser} · ${system}`;
}

/** Část adresy pro nápovědu, kterým účtem se přihlásit: „on•••@gmail.com“. */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}•••@${domain}`;
}

// ——— Pozvánky ———

/**
 * Vytvoří nový odkaz pro účet. Předchozí nepoužité odkazy téhož účtu přestanou platit, takže
 * v oběhu je vždy nejvýš jeden. Vrací token, který se ukáže jen správci, a datum vypršení.
 */
export async function createInvite(tx: Executor, actorId: string, userId: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = newSecret();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS);
  await tx
    .update(loginInvites)
    .set({ revokedAt: now })
    .where(and(eq(loginInvites.userId, userId), isNull(loginInvites.usedAt), isNull(loginInvites.revokedAt)));
  const id = `i-${randomUUID()}`;
  await tx.insert(loginInvites).values({ id, orgId: config.orgId, userId, tokenHash: digest("invite", token), createdBy: actorId, createdAt: now, expiresAt });
  await audit(tx, actorId, "invite.created", "user", userId);
  return { token, expiresAt };
}

/** Zneplatní nepoužité odkazy účtu. */
export async function revokeInvites(tx: Executor, actorId: string, userId: string, now = new Date()): Promise<number> {
  const revoked = await tx
    .update(loginInvites)
    .set({ revokedAt: now })
    .where(and(eq(loginInvites.orgId, config.orgId), eq(loginInvites.userId, userId), isNull(loginInvites.usedAt), isNull(loginInvites.revokedAt)))
    .returning({ id: loginInvites.id });
  if (revoked.length) await audit(tx, actorId, "invite.revoked", "user", userId);
  return revoked.length;
}

export type ClaimResult = { ok: true; cookieValue: string; userId: string } | { ok: false };

/**
 * Spotřebuje odkaz a založí zařízení. Podmíněný UPDATE … RETURNING pustí ze dvou souběžných
 * pokusů jen jeden. Prošlý, použitý nebo zneplatněný odkaz i účet bez přístupu vrací stejnou chybu.
 */
export async function claimInvite(tx: Executor, token: string, label: string, now = new Date()): Promise<ClaimResult> {
  if (!isInviteToken(token)) return { ok: false };
  const [invite] = await tx
    .update(loginInvites)
    .set({ usedAt: now })
    .where(
      and(
        eq(loginInvites.orgId, config.orgId),
        eq(loginInvites.tokenHash, digest("invite", token)),
        isNull(loginInvites.usedAt),
        isNull(loginInvites.revokedAt),
        gt(loginInvites.expiresAt, now),
      ),
    )
    .returning({ id: loginInvites.id, userId: loginInvites.userId });
  if (!invite) return { ok: false };
  const [user] = await tx.select({ status: users.status, orgId: users.orgId }).from(users).where(eq(users.id, invite.userId)).limit(1);
  // Odkaz použitý až po odebrání přístupu zůstane spotřebovaný, zařízení nevznikne.
  if (!user || user.orgId !== config.orgId || user.status !== "active") return { ok: false };
  const { id, cookieValue } = await insertDevice(tx, invite.userId, label, now);
  await tx.update(loginInvites).set({ deviceId: id }).where(eq(loginInvites.id, invite.id));
  await audit(tx, invite.userId, "invite.used", "device", id);
  return { ok: true, cookieValue, userId: invite.userId };
}

// ——— Zařízení ———

async function insertDevice(tx: Executor, userId: string, label: string, now: Date) {
  const id = `d-${randomUUID()}`;
  const secret = newSecret();
  await tx.insert(trustedDevices).values({
    id,
    orgId: config.orgId,
    userId,
    secretHash: digest("device", secret),
    label: label.slice(0, 60),
    createdAt: now,
    lastSeenAt: now,
    expiresAt: DEVICE_NEVER_EXPIRES,
  });
  return { id, cookieValue: `${id}.${secret}` };
}

/** Pojistka proti zamčení: zařízení pro adresu z `BOOTSTRAP_ADMIN_EMAILS` po ověření u Googlu. */
export async function registerBootstrapDevice(tx: Executor, userId: string, label: string, now = new Date()) {
  const device = await insertDevice(tx, userId, label, now);
  await audit(tx, userId, "device.bootstrap", "device", device.id);
  return device;
}

export type KnownDevice = { id: string; userId: string; email: string };

/** Platné zařízení z cookie: správné tajemství, nezneplatněné, nevypršelé, aktivní účet. */
export async function findDevice(db: Executor, cookieValue: string | undefined, now = new Date()): Promise<KnownDevice | null> {
  const cut = cookieValue?.indexOf(".") ?? -1;
  if (!cookieValue || cut < 0) return null;
  const id = cookieValue.slice(0, cut);
  const secret = cookieValue.slice(cut + 1);
  if (!ID.test(id) || !TOKEN.test(secret)) return null;
  const [row] = await db
    .select({ id: trustedDevices.id, userId: trustedDevices.userId, secretHash: trustedDevices.secretHash, email: users.email })
    .from(trustedDevices)
    .innerJoin(users, eq(users.id, trustedDevices.userId))
    .where(
      and(
        eq(trustedDevices.id, id),
        eq(trustedDevices.orgId, config.orgId),
        isNull(trustedDevices.revokedAt),
        gt(trustedDevices.expiresAt, now),
        eq(users.status, "active"),
      ),
    )
    .limit(1);
  // Otisk se porovnává v DB přes ID a tady přes hodnotu. Obojí je HMAC, délky jsou pevné.
  if (!row || row.secretHash !== digest("device", secret)) return null;
  return { id: row.id, userId: row.userId, email: row.email };
}

/**
 * Platí zařízení session pro daného uživatele? Volá se při každém požadavku přihlášeného uživatele
 * ostré Wiki. Používané zařízení si zároveň prodlužuje platnost (nejvýš jeden zápis za hodinu).
 */
export async function deviceAllowsSession(db: Executor, deviceId: string, userId: string, now = new Date()): Promise<boolean> {
  const [row] = await db
    .select({ lastSeenAt: trustedDevices.lastSeenAt })
    .from(trustedDevices)
    .where(
      and(
        eq(trustedDevices.id, deviceId),
        eq(trustedDevices.userId, userId),
        eq(trustedDevices.orgId, config.orgId),
        isNull(trustedDevices.revokedAt),
        gt(trustedDevices.expiresAt, now),
      ),
    )
    .limit(1);
  if (!row) return false;
  if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_AFTER_MS) await touchDevice(db, deviceId, now);
  return true;
}

export async function touchDevice(db: Executor, deviceId: string, now = new Date()): Promise<void> {
  await db
    .update(trustedDevices)
    // Zařízení z doby, kdy platnost vypršela po 30 dnech, se při použití převedou na trvalá.
    .set({ lastSeenAt: now, expiresAt: DEVICE_NEVER_EXPIRES })
    .where(and(eq(trustedDevices.id, deviceId), isNull(trustedDevices.revokedAt), gt(trustedDevices.expiresAt, now)));
}

/** Odhlásí zařízení. Session z něj přestane platit při dalším požadavku. */
export async function revokeDevice(tx: Executor, actorId: string, deviceId: string, now = new Date()): Promise<boolean> {
  const revoked = await tx
    .update(trustedDevices)
    .set({ revokedAt: now })
    .where(and(eq(trustedDevices.id, deviceId), eq(trustedDevices.orgId, config.orgId), isNull(trustedDevices.revokedAt)))
    .returning({ id: trustedDevices.id });
  if (revoked.length) await audit(tx, actorId, "device.revoked", "device", deviceId);
  return revoked.length > 0;
}

/** Odhlásí všechna zařízení účtu (při odebrání přístupu). */
export async function revokeUserDevices(tx: Executor, userId: string, now = new Date()): Promise<void> {
  await tx
    .update(trustedDevices)
    .set({ revokedAt: now })
    .where(and(eq(trustedDevices.userId, userId), isNull(trustedDevices.revokedAt)));
}

// ——— Přehled pro Správu ———

export type InviteState = { kind: "none" } | { kind: "waiting"; expiresAt: Date } | { kind: "expired"; expiredAt: Date };
export type DeviceSummary = { id: string; label: string; lastSeenAt: Date; expiresAt: Date };
export type UserAccess = { invite: InviteState; devices: DeviceSummary[] };

/** Stav posledního odkazu a platná zařízení pro každý účet. Dva dotazy pro celou stránku. */
export async function listUserAccess(db: Executor, userIds: string[], now = new Date()): Promise<Map<string, UserAccess>> {
  const result = new Map<string, UserAccess>(userIds.map((id) => [id, { invite: { kind: "none" }, devices: [] }]));
  if (!userIds.length) return result;
  const [invites, devices] = await Promise.all([
    db
      .select({ userId: loginInvites.userId, expiresAt: loginInvites.expiresAt, usedAt: loginInvites.usedAt, revokedAt: loginInvites.revokedAt })
      .from(loginInvites)
      .where(and(eq(loginInvites.orgId, config.orgId), inArray(loginInvites.userId, userIds)))
      .orderBy(desc(loginInvites.createdAt)),
    db
      .select({ id: trustedDevices.id, userId: trustedDevices.userId, label: trustedDevices.label, lastSeenAt: trustedDevices.lastSeenAt, expiresAt: trustedDevices.expiresAt })
      .from(trustedDevices)
      .where(and(eq(trustedDevices.orgId, config.orgId), inArray(trustedDevices.userId, userIds), isNull(trustedDevices.revokedAt), gt(trustedDevices.expiresAt, now)))
      .orderBy(desc(trustedDevices.lastSeenAt)),
  ]);
  const seen = new Set<string>();
  for (const invite of invites) {
    // Rozhoduje jen poslední odkaz. Použitý nebo zneplatněný = žádný čekající odkaz.
    if (seen.has(invite.userId)) continue;
    seen.add(invite.userId);
    const access = result.get(invite.userId)!;
    if (invite.usedAt || invite.revokedAt) continue;
    access.invite = invite.expiresAt > now ? { kind: "waiting", expiresAt: invite.expiresAt } : { kind: "expired", expiredAt: invite.expiresAt };
  }
  for (const device of devices) result.get(device.userId)?.devices.push(device);
  return result;
}

/** Úklid: smaže dávno prošlé a zneplatněné záznamy (starší 90 dní). Volá se při vytváření odkazu. */
export async function pruneOldAccess(tx: Executor, now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - 90 * DAY_MS);
  await tx.delete(loginInvites).where(and(eq(loginInvites.orgId, config.orgId), lt(loginInvites.expiresAt, cutoff)));
  await tx
    .delete(trustedDevices)
    .where(and(eq(trustedDevices.orgId, config.orgId), sql`coalesce(${trustedDevices.revokedAt}, ${trustedDevices.expiresAt}) < ${cutoff}`));
}
