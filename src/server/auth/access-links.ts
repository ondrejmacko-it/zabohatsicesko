import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { audit } from "@/server/audit";
import { config } from "@/server/config";
import { getDb, type Executor } from "@/server/db/client";
import { accessLinks, users } from "@/server/db/schema";
import { canManageUsers, type Viewer } from "@/server/policy";
import { DomainError } from "@/server/services/errors";

// Vstup na pozvánku. Správce vytvoří člověku osobní odkaz, případně jednorázový kód (pro ty, kdo nemají účet
// Google). Odkaz otevře přihlašovací okno jen v prohlížeči, který ho použil: ten dostane podepsanou cookie
// zařízení. Odkaz přestane platit prvním úspěšným přihlášením, takže ho nespotřebuje náhled v e-mailu.
// Cookie zařízení sama nikoho nepřihlásí, jen dovolí zobrazit přihlášení pro jednoho konkrétního člověka.

export const ACCESS_TTL_DAYS = 7;
const DEVICE_TTL_SEC = 180 * 24 * 3600;

export const DEVICE_COOKIE = config.isProduction ? "__Host-zbc_zarizeni" : "zbc_zarizeni";
export const deviceCookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  // Lax, aby cookie dorazila při návratu z Googlu.
  sameSite: "lax" as const,
  path: "/",
  maxAge: DEVICE_TTL_SEC,
};

export type Device = { userId: string; exp: number; linkId?: string };
type Payload = { uid: string; exp: number; link?: string };

const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
const sign = (data: string) => createHmac("sha256", config.sessionSecret).update(`zarizeni:${data}`).digest("base64url");

export function encodeDevice(userId: string, linkId?: string, exp = Math.floor(Date.now() / 1000) + DEVICE_TTL_SEC): string {
  const payload: Payload = { uid: userId, exp, ...(linkId ? { link: linkId } : {}) };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function decodeDevice(value: string | undefined, nowSec = Math.floor(Date.now() / 1000)): Device | null {
  const [data, signature] = value?.split(".") ?? [];
  if (!data || !signature) return null;
  const expected = Buffer.from(sign(data));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Partial<Payload>;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number" || payload.exp <= nowSec) return null;
    return { userId: payload.uid, exp: payload.exp, ...(typeof payload.link === "string" ? { linkId: payload.link } : {}) };
  } catch {
    return null;
  }
}

/**
 * Zařízení, které smí vidět přihlášení: platná cookie, aktivní účet a odkaz, který mezitím nepoužil nikdo jiný
 * ani nevypršel. Po prvním přihlášení už cookie odkaz nenese a platí sama.
 */
export async function trustedDevice(db: Executor, cookieValue: string | undefined): Promise<Device | null> {
  const device = decodeDevice(cookieValue);
  if (!device) return null;
  const [user] = await db.select({ status: users.status, orgId: users.orgId }).from(users).where(eq(users.id, device.userId)).limit(1);
  if (!user || user.orgId !== config.orgId || user.status !== "active") return null;
  if (device.linkId) {
    const [link] = await db
      .select({ id: accessLinks.id })
      .from(accessLinks)
      .where(and(eq(accessLinks.id, device.linkId), eq(accessLinks.userId, device.userId), isNull(accessLinks.usedAt), gt(accessLinks.expiresAt, new Date())))
      .limit(1);
    if (!link) return null;
  }
  return device;
}

/** Otevření osobního odkazu. Nic nespotřebuje, jen řekne, komu odkaz patří. */
export async function openAccessLink(db: Executor, token: string): Promise<{ userId: string; linkId: string; expiresAt: Date } | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db
    .select({ linkId: accessLinks.id, userId: accessLinks.userId, expiresAt: accessLinks.expiresAt, status: users.status })
    .from(accessLinks)
    .innerJoin(users, eq(users.id, accessLinks.userId))
    .where(and(eq(accessLinks.tokenHash, hashToken(token)), eq(accessLinks.kind, "link"), eq(accessLinks.orgId, config.orgId), isNull(accessLinks.usedAt), gt(accessLinks.expiresAt, new Date())))
    .limit(1);
  return row && row.status === "active" ? { userId: row.userId, linkId: row.linkId, expiresAt: row.expiresAt } : null;
}

/**
 * První úspěšné přihlášení ze zařízení: odkaz se označí jako použitý a zařízení dostane vlastní dlouhou cookie.
 * Vrací novou hodnotu cookie, nebo null, když odkaz mezitím použil někdo jiný (přihlášení se pak nedokončí).
 */
export async function confirmDevice(db: Executor, device: Device): Promise<string | null> {
  if (!device.linkId) return encodeDevice(device.userId);
  const used = await db
    .update(accessLinks)
    .set({ usedAt: new Date() })
    .where(and(eq(accessLinks.id, device.linkId), eq(accessLinks.userId, device.userId), isNull(accessLinks.usedAt), gt(accessLinks.expiresAt, new Date())))
    .returning({ id: accessLinks.id });
  if (!used.length) return null;
  await audit(db, device.userId, "access.link_used", "user", device.userId);
  return encodeDevice(device.userId);
}

// Kód se opisuje ručně: bez znaků, které se pletou (0/O, 1/I/L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 10 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
export const normalizeCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const formatCode = (code: string) => `${code.slice(0, 5)}-${code.slice(5)}`;

export type CreatedAccess = { link: string; code: string | null; expiresAt: Date; name: string; email: string };

/**
 * Vytvoří člověku nový osobní odkaz, volitelně i jednorázový kód. Starší nepoužité odkazy a kódy téhož člověka
 * přestanou platit. Hodnoty se vrací jen teď, v databázi zůstává otisk.
 */
export async function createAccess(viewer: Viewer, userId: string, withCode: boolean): Promise<CreatedAccess> {
  if (!canManageUsers(viewer)) throw new DomainError("forbidden");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [target] = await tx.select().from(users).where(eq(users.id, userId)).limit(1).for("update");
    if (!target || target.orgId !== config.orgId) throw new DomainError("not_found");
    if (target.status !== "active") throw new DomainError("forbidden");
    await tx.delete(accessLinks).where(and(eq(accessLinks.userId, userId), isNull(accessLinks.usedAt)));
    const expiresAt = new Date(Date.now() + ACCESS_TTL_DAYS * 24 * 3600 * 1000);
    const token = randomBytes(32).toString("base64url");
    const code = withCode ? newCode() : null;
    const row = (kind: "link" | "code", value: string) => ({
      id: `al-${randomBytes(12).toString("hex")}`, orgId: config.orgId, userId, kind, tokenHash: hashToken(value), createdBy: viewer.id, expiresAt,
    });
    await tx.insert(accessLinks).values([row("link", token), ...(code ? [row("code", `${userId}:${code}`)] : [])]);
    await audit(tx, viewer.id, withCode ? "access.code_created" : "access.link_created", "user", userId);
    return { link: `${config.appUrl}/pozvanka/${token}`, code: code ? formatCode(code) : null, expiresAt, name: target.name, email: target.email };
  });
}

/** Jednorázový kód platí jen pro člověka, kterému patří zařízení, a jen jednou. */
export async function redeemCode(db: Executor, device: Device, input: string): Promise<boolean> {
  const code = normalizeCode(input);
  if (code.length !== 10) return false;
  const used = await db
    .update(accessLinks)
    .set({ usedAt: new Date() })
    .where(and(eq(accessLinks.tokenHash, hashToken(`${device.userId}:${code}`)), eq(accessLinks.kind, "code"), eq(accessLinks.userId, device.userId), isNull(accessLinks.usedAt), gt(accessLinks.expiresAt, new Date())))
    .returning({ id: accessLinks.id });
  return used.length > 0;
}
