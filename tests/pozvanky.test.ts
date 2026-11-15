import { createSign, generateKeyPairSync } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { DEVICE_NEVER_EXPIRES, claimInvite, findDevice } from "@/server/auth/devices";
import { clearSigningKeyCache, completeLogin, type LoginScope } from "@/server/auth/google-login";
import { resolveSessionUser } from "@/server/auth/session";
import { googleLoginConfig } from "@/server/config";
import { getDb } from "@/server/db/client";
import { trustedDevices, userIdentities, users } from "@/server/db/schema";
import { createLoginLink, inviteUser, listAccounts, revokeLoginLink, revokeUserDevice, updateAccess } from "@/server/services/users";
import { admin, participant, resetDemo } from "./helpers";

// Ostrá Wiki: přihlášení jen přes pozvánku na jedno zařízení. Google je napodobený.

const CLIENT_ID = "wiki-test.apps.googleusercontent.com";
const NOW = Math.floor(Date.now() / 1000);
const NONCE = "nonce";
const KOLEGA = "nova.kolegyne@gmail.test";
const BOOT = "zakladatel@gmail.test";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
let nextToken = "";
const fakeFetch: typeof fetch = async (input) => {
  if (String(input).includes("/certs")) return Response.json({ keys: [{ ...keys.publicKey.export({ format: "jwk" }), kid: "k", alg: "RS256" }] });
  return Response.json({ id_token: nextToken });
};

async function login(email: string, sub: string, scope?: LoginScope) {
  const claims = { iss: "https://accounts.google.com", aud: CLIENT_ID, sub, email, email_verified: true, nonce: NONCE, iat: NOW, exp: NOW + 600 };
  const input = `${b64({ alg: "RS256", kid: "k" })}.${b64(claims)}`;
  nextToken = `${input}.${createSign("RSA-SHA256").update(input).sign(keys.privateKey).toString("base64url")}`;
  return completeLogin(await getDb(), googleLoginConfig()!, { code: "c", verifier: "v", nonce: NONCE, ...(scope ? { scope } : {}) }, fakeFetch, NOW);
}

const claim = async (token: string, now?: Date) => (await getDb()).transaction((tx) => claimInvite(tx, token, "Chrome · Windows", now));

/** Pozve kolegyni a použije odkaz. Vrací ID účtu, cookie zařízení a rozsah přihlášení. */
async function invitedWithDevice() {
  const { id, link } = await inviteUser(admin, { email: KOLEGA, name: "Kolegyně", role: "member", groups: ["vsichni"] });
  const claimed = await claim(link!.token);
  if (!claimed.ok) throw new Error("odkaz měl platit");
  const device = (await findDevice(await getDb(), claimed.cookieValue))!;
  return { id, token: link!.token, cookie: claimed.cookieValue, device, scope: { kind: "device", deviceId: device.id, userId: id } as LoginScope };
}

beforeAll(() => {
  vi.stubEnv("LOGIN_MODE", "google-test");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", CLIENT_ID);
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "test");
  vi.stubEnv("APP_URL", "https://wiki.test.invalid");
  vi.stubEnv("BOOTSTRAP_ADMIN_EMAILS", BOOT);
});
beforeEach(async () => {
  clearSigningKeyCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("WIKI_MODE", "");
  const db = await resetDemo();
  await db.delete(userIdentities);
  vi.stubEnv("WIKI_MODE", "production");
});
afterEach(() => vi.stubEnv("WIKI_MODE", ""));

describe("pozvánka na jedno zařízení", () => {
  test("bez pozvánky se nepřihlásí nikdo a nevznikne žádná žádost", async () => {
    expect(await login(KOLEGA, "sub-cizi")).toEqual({ ok: false, reason: "not_allowed" });
    const db = await getDb();
    expect(await db.select().from(users).where(eq(users.email, KOLEGA))).toHaveLength(0);
  });

  test("platný odkaz založí zařízení a přihlášení správným účtem projde", async () => {
    const { id, scope, device } = await invitedWithDevice();
    expect(device.userId).toBe(id);
    expect(await login(KOLEGA, "sub-kolegyne", scope)).toEqual({ ok: true, userId: id });
    // Další přihlášení ze stejného zařízení už jen pozná svázaný účet.
    expect(await login(KOLEGA, "sub-kolegyne", scope)).toEqual({ ok: true, userId: id });
  });

  test("použitý odkaz podruhé (jiné zařízení) neplatí", async () => {
    const { token } = await invitedWithDevice();
    expect(await claim(token)).toEqual({ ok: false });
  });

  test("prošlý odkaz neplatí", async () => {
    const { link } = await inviteUser(admin, { email: KOLEGA, name: "Kolegyně", role: "member", groups: ["vsichni"] });
    expect(await claim(link!.token, new Date(Date.now() + 8 * 24 * 3600 * 1000))).toEqual({ ok: false });
  });

  test("zneplatněný odkaz i odkaz nahrazený novým neplatí", async () => {
    const { id, link } = await inviteUser(admin, { email: KOLEGA, name: "Kolegyně", role: "member", groups: ["vsichni"] });
    const second = await createLoginLink(admin, id);
    expect(await claim(link!.token)).toEqual({ ok: false });
    await revokeLoginLink(admin, id);
    expect(await claim(second.token)).toEqual({ ok: false });
  });

  test("cizí nebo podvržená cookie zařízení neplatí", async () => {
    const { cookie } = await invitedWithDevice();
    const [deviceId] = cookie.split(".");
    expect(await findDevice(await getDb(), `${deviceId}.${"A".repeat(43)}`)).toBeNull();
    expect(await findDevice(await getDb(), "nesmysl")).toBeNull();
  });

  test("jiný účet Google než v pozvánce se nepřihlásí a nesváže", async () => {
    const { id, scope } = await invitedWithDevice();
    expect(await login("jiny.ucet@gmail.test", "sub-jiny", scope)).toEqual({ ok: false, reason: "wrong_account" });
    expect(await login(KOLEGA, "sub-kolegyne", scope)).toEqual({ ok: true, userId: id });
    // Svázaný účet už nepomůže ani se správnou adresou z jiného účtu Google.
    expect(await login(KOLEGA, "sub-podvrh", scope)).toEqual({ ok: false, reason: "account_conflict" });
  });

  test("session platí jen se zařízením a odhlášení zařízení ji hned ukončí", async () => {
    const { id, device } = await invitedWithDevice();
    const db = await getDb();
    expect(await resolveSessionUser(db, { userId: id, method: "google", deviceId: device.id })).toBeNull(); // ještě bez vazby na Google
    await login(KOLEGA, "sub-kolegyne", { kind: "device", deviceId: device.id, userId: id });
    expect(await resolveSessionUser(db, { userId: id, method: "google", deviceId: device.id })).not.toBeNull();
    expect(await resolveSessionUser(db, { userId: id, method: "google" })).toBeNull();
    expect(await resolveSessionUser(db, { userId: "demo-spravce", method: "google", deviceId: device.id })).toBeNull();
    await revokeUserDevice(admin, id, device.id);
    expect(await resolveSessionUser(db, { userId: id, method: "google", deviceId: device.id })).toBeNull();
  });

  test("odebraný přístup zneplatní zařízení i odkaz", async () => {
    const { id, cookie } = await invitedWithDevice();
    await createLoginLink(admin, id);
    await updateAccess(admin, id, { role: "member", groups: ["vsichni"], status: "disabled" });
    expect(await findDevice(await getDb(), cookie)).toBeNull();
    const account = (await listAccounts(admin)).find((a) => a.id === id)!;
    expect(account.access).toEqual({ invite: { kind: "none" }, devices: [] });
  });

  test("zvát a spravovat odkazy smí jen správce", async () => {
    const { id } = await invitedWithDevice();
    await expect(createLoginLink(participant, id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(revokeLoginLink(participant, id)).rejects.toMatchObject({ code: "forbidden" });
  });

  test("pojistka: zaváděcí správce se přihlásí bez pozvánky, jiná adresa ne", async () => {
    expect(await login(KOLEGA, "sub-kolegyne", { kind: "bootstrap" })).toEqual({ ok: false, reason: "not_allowed" });
    const result = await login(BOOT, "sub-boot", { kind: "bootstrap" });
    expect(result.ok).toBe(true);
  });

  test("zařízení samo nevyprší: platí i po roce, dokud ho správce nezruší", async () => {
    const { device, cookie } = await invitedWithDevice();
    const [row] = await (await getDb()).select().from(trustedDevices).where(eq(trustedDevices.id, device.id));
    expect(row!.expiresAt.getTime()).toBe(DEVICE_NEVER_EXPIRES.getTime());
    const yearLater = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);
    expect(await findDevice(await getDb(), cookie, yearLater)).not.toBeNull();
  });

  test("hlavního správce nikdo neodebere, nezruší mu zařízení ani mu nevytvoří odkaz, ani on sám", async () => {
    const result = await login(BOOT, "sub-boot", { kind: "bootstrap" });
    if (!result.ok) throw new Error("hlavní správce se měl přihlásit");
    const primaryId = result.userId;
    const primary = (await listAccounts(admin)).find((a) => a.id === primaryId)!;
    expect(primary).toMatchObject({ primary: true, editable: false });
    const [self] = await (await getDb()).select().from(users).where(eq(users.id, primaryId));
    const primaryViewer = { id: primaryId, role: self!.role, groups: self!.groups };
    for (const viewer of [admin, primaryViewer]) {
      await expect(createLoginLink(viewer, primaryId)).rejects.toMatchObject({ code: "forbidden" });
      await expect(revokeLoginLink(viewer, primaryId)).rejects.toMatchObject({ code: "forbidden" });
      await expect(revokeUserDevice(viewer, primaryId, "d-cokoli")).rejects.toMatchObject({ code: "forbidden" });
    }
    await expect(updateAccess(admin, primaryId, { role: "member", groups: [], status: "disabled" })).rejects.toMatchObject({ code: "forbidden" });
    const [after] = await (await getDb()).select().from(users).where(eq(users.id, primaryId));
    expect(after).toMatchObject({ status: "active", role: "admin" });
  });
});
