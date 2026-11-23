import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { calendarLinks, calendarResponses, calendarSyncState, calendarWorkerRuns, integrationCredentials, users } from "@/server/db/schema";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { eventIdForKey } from "@/server/calendar/google";
import { clearAccessTokenCache, completeAuthorization } from "@/server/calendar/google-auth";
import { requestNewInvite, syncEvent, syncPending } from "@/server/calendar/sync";
import { changeOwnParticipation } from "@/server/services/participation";
import { config, googleCalendarConfig } from "@/server/config";
import { getDb } from "@/server/db/client";
import { inviteUser, updateAccess } from "@/server/services/users";
import type { Viewer } from "@/server/policy";
import { CALENDAR, FakeGoogle, type Stored } from "./fake-google";
import { PUBLISHED_RM, admin, organizer, resetDemo } from "./helpers";

// PR2: hosté podle individuální účasti (PARTICIPATION=on) proti napodobenému Googlu. Režim organizátora: skutečné pozvánky,
// fronta s opakováním, odpovědi pozvaných přes syncToken a chráněný endpoint plánovače.
// Ověřuje chování Wiki, NE skutečného Googlu (živý test čeká na účet organizátora).

const WORKER_TOKEN = "t".repeat(40);
const ENV = {
  GOOGLE_ORGANIZER_EMAIL: "organizator.test@example.com",
  CALENDAR_MODE: "google-test",
  CALENDAR_DELIVERY: "organizer",
  CALENDAR_ATTENDEES: "audience",
  GOOGLE_OAUTH_CLIENT_ID: "test-client.apps.example",
  GOOGLE_OAUTH_CLIENT_SECRET: "test-client-secret",
  GOOGLE_CALENDAR_ID: CALENDAR,
  GOOGLE_ALLOWED_CALENDAR_IDS: CALENDAR,
  GOOGLE_ALLOWED_ATTENDEES: "",
  TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  APP_URL: "https://wiki-test.example.invalid",
  CALENDAR_WORKER_TOKEN: WORKER_TOKEN,
  PARTICIPATION: "on",
};

const KOLEGA = "kolega@example.com";
const DRUHA = "druha@example.com";
const KEY_ID = () => eventIdForKey(`${config.orgId}:${PUBLISHED_RM}`);

let google: FakeGoogle;

beforeAll(() => {
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(async () => {
  google = new FakeGoogle();
  vi.stubGlobal("fetch", google.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
  clearAccessTokenCache();
  const db = await resetDemo();
  await db.delete(integrationCredentials);
  await db.delete(calendarResponses);
  await db.delete(calendarSyncState);
  await db.delete(calendarWorkerRuns);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const connect = async () =>
  completeAuthorization(await getDb(), googleCalendarConfig()!, { code: "valid-code", verifier: "v".repeat(64), userId: organizer.id });

const link = async (id = PUBLISHED_RM) => (await (await getDb()).select().from(calendarLinks).where(eq(calendarLinks.eventId, id)))[0]!;
const invite = () => google.events.get(KEY_ID())!;
const emails = (event: Stored) => ((event.attendees as Array<{ email: string }> | undefined) ?? []).map((a) => a.email);

async function viewerOf(email: string): Promise<Viewer> {
  const [row] = await (await getDb()).select().from(users).where(eq(users.email, email));
  return { id: row!.id, role: row!.role, groups: row!.groups };
}

async function setResponse(email: string, responseStatus: string) {
  const current = invite();
  google.put({
    ...current,
    attendees: (current.attendees as Array<Record<string, unknown>>).map((a) => (a.email === email ? { ...a, responseStatus } : a)),
  });
}

/** Propojený organizátor, dva kolegové ve skupině RM a odeslaná pozvánka na budoucí akci RM. */
async function invited() {
  await inviteUser(admin, { email: KOLEGA, name: "Nový Kolega", role: "member", groups: ["vsichni", "rm"] });
  await inviteUser(admin, { email: DRUHA, name: "Druhá Kolegyně", role: "member", groups: ["vsichni", "rm"] });
  await connect();
  await requestNewInvite(organizer, PUBLISHED_RM);
  await syncEvent(PUBLISHED_RM);
  expect((await link()).syncStatus).toBe("synced");
}


const NOTE = "soukroma-poznamka-kalendar";
const bodies = () => JSON.stringify(google.requests.map((r) => r.body ?? null));

describe("pozvánky podle účasti (desiredGuestIds)", () => {
  test("omluva odebere jen omluveného, ruční host a RSVP ostatních zůstanou, declined se nenastavuje", async () => {
    await invited();
    await setResponse(DRUHA, "accepted");
    google.put({ ...invite(), attendees: [...(invite().attendees as object[]), { email: "rucni@example.com", responseStatus: "tentative" }] });
    await changeOwnParticipation(await viewerOf(KOLEGA), PUBLISHED_RM, { kind: "excuse", excuse: { reason: "illness", note: NOTE } });
    expect((await link()).syncStatus).toBe("pending");
    await syncPending();
    expect(emails(invite()).sort()).toEqual([DRUHA, "rucni@example.com"]);
    expect(invite().attendees).toEqual(expect.arrayContaining([
      expect.objectContaining({ email: DRUHA, responseStatus: "accepted" }),
      expect.objectContaining({ email: "rucni@example.com", responseStatus: "tentative" }),
    ]));
    expect(bodies()).not.toContain("declined");
    expect(bodies()).not.toContain(NOTE);
    expect(bodies()).not.toContain("illness");
    expect((await link()).managedAttendees).toEqual([DRUHA]);

    await changeOwnParticipation(await viewerOf(KOLEGA), PUBLISHED_RM, { kind: "revoke_excuse" });
    await syncPending();
    expect(emails(invite()).sort()).toEqual([DRUHA, KOLEGA, "rucni@example.com"]);
  });

  test("dobrovolná přihláška FP kolegy k RM akci ho pozve, odhlášení odebere", async () => {
    await invited();
    await inviteUser(admin, { email: "fp@example.com", name: "FP Kolega", role: "member", groups: ["vsichni", "fp"] });
    await syncPending();
    expect(emails(invite())).not.toContain("fp@example.com");
    const fp = await viewerOf("fp@example.com");
    await changeOwnParticipation(fp, PUBLISHED_RM, { kind: "enroll" });
    await syncPending();
    expect(emails(invite())).toContain("fp@example.com");
    await changeOwnParticipation(fp, PUBLISHED_RM, { kind: "withdraw" });
    await syncPending();
    expect(emails(invite())).not.toContain("fp@example.com");
  });

  // Oprava A (finální integrační kolo): přepočet po změně účtu dřív hledal akce jen podle skupin. Dobrovolná
  // přihláška k akci jiné skupiny tak po deaktivaci zůstala v hostech spravovaných Wiki.
  test("deaktivace odebere i dobrovolnou přihlášku k akci jiné skupiny, opětovná aktivace ji vrátí", async () => {
    await invited();
    await inviteUser(admin, { email: "fp@example.com", name: "FP Kolega", role: "member", groups: ["vsichni", "fp"] });
    const fp = await viewerOf("fp@example.com");
    await changeOwnParticipation(fp, PUBLISHED_RM, { kind: "enroll" });
    await syncPending();
    google.put({ ...invite(), attendees: [...(invite().attendees as object[]), { email: "rucni@example.com", responseStatus: "accepted" }] });
    expect(emails(invite())).toContain("fp@example.com");

    await updateAccess(admin, fp.id, { role: "member", groups: ["vsichni", "fp"], status: "disabled" });
    expect((await link()).syncStatus).toBe("pending");
    await syncPending();
    expect(emails(invite()).sort()).toEqual([DRUHA, KOLEGA, "rucni@example.com"]);
    expect((await link()).managedAttendees?.sort()).toEqual([DRUHA, KOLEGA]);

    await updateAccess(admin, fp.id, { role: "member", groups: ["vsichni", "fp"], status: "active" });
    await syncPending();
    expect(emails(invite()).sort()).toEqual([DRUHA, "fp@example.com", KOLEGA, "rucni@example.com"]);
    // Dvojí spuštění fronty nic nezdvojí ani znovu neposílá.
    const before = google.requests.filter((r) => r.method === "PATCH").length;
    await syncPending();
    expect(google.requests.filter((r) => r.method === "PATCH").length).toBe(before);
    expect(emails(invite()).filter((e) => e === "fp@example.com")).toHaveLength(1);
  });

  test("odebrání poslední pracovní role i bez uloženého „vsichni“ odebere spravovaného hosta", async () => {
    await invited();
    // Účet jen s rolí RM (bez zaškrtnutého „vsichni“) přijde o roli: akce RM se musí přepočítat podle jeho adresy.
    await inviteUser(admin, { email: "jen-rm@example.com", name: "Jen RM", role: "member", groups: ["rm"] });
    await syncPending();
    expect(emails(invite())).toContain("jen-rm@example.com");
    const person = await viewerOf("jen-rm@example.com");
    await updateAccess(admin, person.id, { role: "member", groups: [], status: "active" });
    await syncPending();
    expect(emails(invite())).not.toContain("jen-rm@example.com");
    expect((await link()).managedAttendees?.sort()).toEqual([DRUHA, KOLEGA]);
  });

  test("výpadek Kalendáře po deaktivaci: změna účtu platí, pozvánka se srovná při dalším pokusu", async () => {
    await invited();
    const kolega = await viewerOf(KOLEGA);
    google.forced = [{ status: 400 }];
    await updateAccess(admin, kolega.id, { role: "member", groups: ["vsichni", "rm"], status: "disabled" });
    await syncPending();
    const [row] = await (await getDb()).select({ status: users.status }).from(users).where(eq(users.id, kolega.id));
    expect(row!.status).toBe("disabled");
    expect(emails(invite())).toContain(KOLEGA);
    expect((await link()).syncStatus).toBe("attention");
    await (await getDb()).update(calendarLinks).set({ syncStatus: "pending", attempts: 0 }).where(eq(calendarLinks.eventId, PUBLISHED_RM));
    await syncPending();
    expect(emails(invite())).toEqual([DRUHA]);
  });

  test("bez přepínače se hosté řídí publikem jako dřív a omluva Kalendář nemění", async () => {
    vi.stubEnv("PARTICIPATION", "");
    await invited();
    const before = google.requests.length;
    await changeOwnParticipation(await viewerOf(KOLEGA), PUBLISHED_RM, { kind: "excuse", excuse: { reason: "other", note: null } });
    expect((await link()).syncStatus).toBe("synced");
    await syncPending();
    expect(google.requests.slice(before).filter((r) => r.method !== "GET" && r.url.hostname !== "oauth2.googleapis.com")).toHaveLength(0);
    expect(emails(invite()).sort()).toEqual([DRUHA, KOLEGA]);
    vi.stubEnv("PARTICIPATION", "on");
  });
});
