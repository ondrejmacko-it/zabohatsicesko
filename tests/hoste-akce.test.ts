import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { integrationCredentials } from "@/server/db/schema";
import { loadInvitePreview } from "@/server/services/calendar-status";
import { admin, lead, organizer, outsider, participant, resetDemo } from "./helpers";

// Blok „Pozvánku dostane N lidí“ v dialogu akce: kdo ho smí načíst a co ukáže v každém režimu Kalendáře.

const GOOGLE_ENV = {
  CALENDAR_MODE: "google-test",
  GOOGLE_OAUTH_CLIENT_ID: "client",
  GOOGLE_OAUTH_CLIENT_SECRET: "secret",
  GOOGLE_CALENDAR_ID: "kalendar@example.com",
  GOOGLE_ALLOWED_CALENDAR_IDS: "kalendar@example.com",
  GOOGLE_ALLOWED_ATTENDEES: "Tester@example.com",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  APP_URL: "https://wiki.example.invalid",
};
const useGoogle = (extra: Record<string, string> = {}) => {
  for (const [name, value] of Object.entries({ ...GOOGLE_ENV, ...extra })) vi.stubEnv(name, value);
};

describe("hosté v dialogu akce", () => {
  let db: Awaited<ReturnType<typeof resetDemo>>;
  beforeAll(async () => {
    db = await resetDemo();
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await db.delete(integrationCredentials);
  });
  const connect = () =>
    db.insert(integrationCredentials).values({ orgId: "zbc-demo", provider: "google-calendar", accountEmail: "spravce@example.com", encryptedRefreshToken: "x", scopes: "", connectedBy: "demo-spravce" });

  test("hosty smí načíst jen správce (obě hodnoty role), člen týmu ani vedoucí akce ne", async () => {
    for (const viewer of [admin, organizer]) expect((await loadInvitePreview(viewer)).mode).toBe("simulation");
    for (const viewer of [lead, participant, outsider]) await expect(loadInvitePreview(viewer)).rejects.toMatchObject({ code: "forbidden" });
  });

  test("simulace ukáže fiktivní role podle skupiny akce", async () => {
    const { mode, recipients } = await loadInvitePreview(admin);
    expect(mode).toBe("simulation");
    expect(recipients.vsichni.length).toBeGreaterThan(recipients.fp.length);
    expect(recipients.fp.map((r) => r.name)).toContain("Účastník FP");
    expect(recipients.fp.map((r) => r.name)).not.toContain("Účastník RM");
    expect(Object.values(recipients).flat().every((r) => r.email.endsWith("@example.invalid"))).toBe(true);
  });

  test("Google bez propojení hlásí, že pozvánka neodejde, a oprávnění drží stejně", async () => {
    useGoogle();
    expect((await loadInvitePreview(admin)).mode).toBe("disconnected");
    await expect(loadInvitePreview(participant)).rejects.toMatchObject({ code: "forbidden" });
  });

  test("Google s pevným seznamem ukáže u každé skupiny jen testovací příjemce", async () => {
    useGoogle();
    await connect();
    const { mode, recipients } = await loadInvitePreview(admin);
    expect(mode).toBe("allowlist");
    for (const list of Object.values(recipients)) expect(list.map((r) => r.email)).toEqual(["tester@example.com"]);
  });

  test("Google se skutečným publikem fiktivní role bez účtu Google nezve", async () => {
    useGoogle({ CALENDAR_ATTENDEES: "audience" });
    await connect();
    const { mode, recipients } = await loadInvitePreview(admin);
    expect(mode).toBe("audience");
    expect(Object.values(recipients).flat()).toEqual([]);
  });
});
