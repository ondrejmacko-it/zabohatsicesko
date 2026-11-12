import { generateKeyPairSync, createSign } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { clearSigningKeyCache, completeLogin, MAX_PENDING_REQUESTS } from "@/server/auth/google-login";
import { listPersonas } from "@/server/auth/personas";
import { resolveSessionUser } from "@/server/auth/session";
import { googleLoginConfig } from "@/server/config";
import { getDb } from "@/server/db/client";
import { userIdentities, users } from "@/server/db/schema";
import { resetDatabase } from "@/server/seed";
import { inviteUser, listAccounts, pendingRequestCount, rejectRequest, updateAccess } from "@/server/services/users";
import { admin, organizer, participant, resetDemo } from "./helpers";

// Správa uživatelů: pozvánka, žádost po prvním přihlášení, schválení, role, odebrání.
// Google je napodobený, ověřují se pravidla Wiki.

const CLIENT_ID = "wiki-test.apps.googleusercontent.com";
const NOW = 1_800_000_000;
const NONCE = "nonce";
const KOLEGA = "nova.kolegyne@gmail.test";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
let nextToken = "";
const fakeFetch: typeof fetch = async (input) => {
  const url = String(input);
  if (url.includes("/certs")) {
    return Response.json({ keys: [{ ...keys.publicKey.export({ format: "jwk" }), kid: "k", alg: "RS256" }] });
  }
  return Response.json({ id_token: nextToken });
};

async function login(email: string, sub: string, name?: string) {
  const claims = { iss: "https://accounts.google.com", aud: CLIENT_ID, sub, email, email_verified: true, nonce: NONCE, iat: NOW, exp: NOW + 600, name };
  const input = `${b64({ alg: "RS256", kid: "k" })}.${b64(claims)}`;
  nextToken = `${input}.${createSign("RSA-SHA256").update(input).sign(keys.privateKey).toString("base64url")}`;
  return completeLogin(await getDb(), googleLoginConfig()!, { code: "c", verifier: "v", nonce: NONCE }, fakeFetch, NOW);
}

const session = async (userId: string, method: "demo" | "google" = "google") => resolveSessionUser(await getDb(), { userId, method });

beforeAll(() => {
  vi.stubEnv("LOGIN_MODE", "google-test");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", CLIENT_ID);
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "test");
  vi.stubEnv("GOOGLE_LOGIN_ACCOUNTS", "");
  vi.stubEnv("APP_URL", "https://wiki.test.invalid");
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(async () => {
  clearSigningKeyCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const db = await resetDemo();
  await db.delete(userIdentities);
});

describe("žádost po prvním přihlášení", () => {
  test("neznámý účet založí čekající žádost bez skupin a session nevznikne", async () => {
    const result = await login(KOLEGA, "sub-kolegyne", "Nová Kolegyně");
    expect(result).toMatchObject({ ok: false, reason: "pending", created: true });
    const id = (result as { userId: string }).userId;
    const [row] = await (await getDb()).select().from(users).where(eq(users.id, id));
    expect(row).toMatchObject({ name: "Nová Kolegyně", email: KOLEGA, role: "member", groups: [], status: "pending", origin: "request" });
    expect(await session(id)).toBeNull();
    // Opakované přihlášení novou žádost nezaloží.
    expect(await login(KOLEGA, "sub-kolegyne")).toMatchObject({ reason: "pending", created: false });
    expect(await pendingRequestCount(await getDb(), admin)).toBe(1);
  });

  test("po schválení vstoupí s přidělenou rolí a skupinami", async () => {
    const { userId } = (await login(KOLEGA, "sub-kolegyne")) as { userId: string };
    await updateAccess(organizer, userId, { role: "member", groups: ["vsichni", "fp"], status: "active" });
    expect(await login(KOLEGA, "sub-kolegyne")).toEqual({ ok: true, userId });
    expect(await session(userId)).toMatchObject({ role: "member", groups: ["vsichni", "fp"] });
  });

  test("zamítnutá žádost zmizí i s vazbou, počet čekajících je omezený", async () => {
    const { userId } = (await login(KOLEGA, "sub-kolegyne")) as { userId: string };
    await rejectRequest(admin, userId);
    expect(await (await getDb()).select().from(userIdentities)).toHaveLength(0);
    for (let i = 1; i < MAX_PENDING_REQUESTS; i++) await login(`zadost${i}@gmail.test`, `sub-${i}`);
    await login(KOLEGA, "sub-kolegyne");
    expect(await login("posledni@gmail.test", "sub-posledni")).toEqual({ ok: false, reason: "requests_full" });
  });
});

describe("pozvánka a odebrání přístupu", () => {
  test("pozvaná adresa se při prvním přihlášení sváže a vstoupí rovnou", async () => {
    const id = await inviteUser(organizer, { email: "Pozvany@Gmail.test", name: "Pozvaný kolega", role: "member", groups: ["vsichni", "rm"] });
    expect(await login("pozvany@gmail.test", "sub-pozvany")).toEqual({ ok: true, userId: id });
    await expect(inviteUser(admin, { email: "pozvany@gmail.test", name: "Znovu", role: "member", groups: [] })).rejects.toMatchObject({
      code: "email_taken",
    });
  });

  test("odebraný přístup ukončí běžící session i další přihlášení, vrácení ho obnoví", async () => {
    const id = await inviteUser(admin, { email: KOLEGA, name: "Kolegyně", role: "member", groups: ["vsichni"] });
    await login(KOLEGA, "sub-kolegyne");
    expect(await session(id)).not.toBeNull();
    await updateAccess(admin, id, { role: "member", groups: ["vsichni"], status: "disabled" });
    expect(await session(id)).toBeNull();
    expect(await login(KOLEGA, "sub-kolegyne")).toEqual({ ok: false, reason: "not_allowed" });
    await updateAccess(admin, id, { role: "member", groups: ["vsichni"], status: "active" });
    expect(await login(KOLEGA, "sub-kolegyne")).toEqual({ ok: true, userId: id });
  });
});

describe("kdo smí co měnit", () => {
  test("člen týmu správu nevidí ani nemění", async () => {
    await expect(listAccounts(participant)).rejects.toMatchObject({ code: "forbidden" });
    await expect(inviteUser(participant, { email: KOLEGA, name: "X y", role: "member", groups: [] })).rejects.toMatchObject({ code: "forbidden" });
    await expect(updateAccess(participant, "demo-vedouci", { role: "organizer", groups: [], status: "active" })).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(await pendingRequestCount(await getDb(), participant)).toBe(0);
  });

  test("organizátor roli správce nepřidělí ani správci nic nezmění, nikdo nemění sám sebe", async () => {
    await expect(inviteUser(organizer, { email: KOLEGA, name: "X y", role: "admin", groups: [] })).rejects.toMatchObject({ code: "forbidden" });
    await expect(updateAccess(organizer, "demo-vedouci", { role: "admin", groups: [], status: "active" })).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(updateAccess(organizer, "demo-spravce", { role: "member", groups: [], status: "disabled" })).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(updateAccess(admin, "demo-spravce", { role: "member", groups: [], status: "active" })).rejects.toMatchObject({
      code: "forbidden",
    });
    await updateAccess(admin, "demo-vedouci", { role: "admin", groups: ["vsichni"], status: "active" });
    const accounts = await listAccounts(organizer);
    expect(accounts.find((a) => a.id === "demo-vedouci")?.editable).toBe(false);
    expect(accounts.find((a) => a.id === "demo-ucastnik")?.editable).toBe(true);
  });

  test("odebraný správce už nemůže měnit ostatní, i s rolí načtenou před odebráním", async () => {
    await updateAccess(admin, "demo-vedouci", { role: "admin", groups: ["vsichni"], status: "active" });
    const staleViewer = { id: "demo-vedouci", role: "admin" as const, groups: ["vsichni"] };
    await updateAccess(admin, "demo-vedouci", { role: "member", groups: ["vsichni"], status: "active" });
    await expect(updateAccess(staleViewer, "demo-spravce", { role: "member", groups: [], status: "disabled" })).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

describe("skutečné účty a ukázka", () => {
  test("výběr fiktivní role skutečné účty nenabízí a session ukázky je neotevře", async () => {
    const id = await inviteUser(admin, { email: KOLEGA, name: "Kolegyně", role: "organizer", groups: ["vsichni"] });
    expect((await listPersonas()).map((p) => p.id)).not.toContain(id);
    expect((await listPersonas()).map((p) => p.id)).toContain("demo-spravce");
    expect(await session(id, "demo")).toBeNull();
  });

  test("obnova ukázkových dat skutečné účty, jejich role i vazby zachová", async () => {
    const id = await inviteUser(admin, { email: KOLEGA, name: "Kolegyně", role: "organizer", groups: ["vsichni", "fp"] });
    await login(KOLEGA, "sub-kolegyne");
    const db = await getDb();
    await db.transaction((tx) => resetDatabase(tx));
    expect(await session(id)).toMatchObject({ role: "organizer", groups: ["vsichni", "fp"] });
  });
});
