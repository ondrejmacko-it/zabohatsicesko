import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { calendarNote, type OwnCalendar } from "@/lib/calendar-note";
import { syncEvent } from "@/server/calendar/sync";
import { getDb } from "@/server/db/client";
import { calendarLinks, eventParticipation, simCalendarEvents, simCalendarNotifications } from "@/server/db/schema";
import { snapshotOf } from "@/server/domain/snapshot";
import { formValuesOf } from "@/server/services/detail";
import { createEvent, loadEventRow } from "@/server/services/events";
import { ownParticipationDetail } from "@/server/services/participation";
import { writeSwitch } from "@/server/settings";
import type { Viewer } from "@/server/policy";
import { PUBLISHED_RM, organizer, outsider, participant, resetDemo } from "./helpers";

// F04 v simulaci Kalendáře (PARTICIPATION=on, režim organizátora): povinná akce přijde po zveřejnění jako pozvánka,
// omluva ji hned odmítne (D01), dobrovolná se přidá až po přihlášení a odhlášení ji odebere.
// Ověřuje chování Wiki proti simulovanému Googlu. Živý Google Kalendář se tu nevolá (D06).

let sessionUser: Viewer = participant;
const queued: Array<() => unknown> = [];
vi.mock("next/cache", () => ({ refresh: () => undefined }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (task: () => unknown) => void queued.push(task),
}));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: async () => ({ ...sessionUser, name: "Test", email: "t@example.invalid", signedInWith: "demo" }) }));
const { changeParticipationAction } = await import("@/features/vzdelavani/actions");

const NOTE = "f04-soukroma-poznamka";
const email = (id: string) => `${id}@example.invalid`;

/** Úlohy po odpovědi (`after`) v pořadí, v jakém je Next spustí. */
async function runAfter() {
  while (queued.length) await queued.shift()!();
}

async function act(as: Viewer, fields: Record<string, string>) {
  sessionUser = as;
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return changeParticipationAction(null, data);
}

/** Nová zveřejněná akce pro RM (jako PUBLISHED_RM, jen v budoucnu). */
async function publishRm(): Promise<string> {
  const row = (await loadEventRow(await getDb(), PUBLISHED_RM))!;
  const v = formValuesOf(snapshotOf(row));
  const id = await createEvent(
    organizer,
    { type: v.type, label: v.label, date: "2026-11-26", endDate: "2026-11-26", startTime: v.startTime, endTime: v.endTime, topicTitle: "F04 pozvánky", topicId: null, audience: "rm", leadId: v.leadId || null, reviewerId: null },
    "publish",
  );
  await syncEvent(id); // po zveřejnění to dělá `after(() => syncEvent(created))`
  return id;
}

async function guests(id: string) {
  const db = await getDb();
  const [link] = await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, id));
  const [invite] = await db.select().from(simCalendarEvents).where(eq(simCalendarEvents.id, link!.externalEventId!));
  return { link: link!, invite: invite!, emails: invite!.attendees.map((a) => a.email).sort() };
}

const noteFor = async (as: Viewer, id: string) => {
  const detail = (await ownParticipationDetail(as, null, id))!;
  return calendarNote(detail.state, detail.calendar);
};

beforeEach(async () => {
  queued.length = 0;
  vi.stubEnv("PARTICIPATION", "on");
  vi.spyOn(console, "error").mockImplementation(() => {});
  await resetDemo();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("F04: povinná akce přijde po zveřejnění jako pozvánka", () => {
  test("pozvaní jsou jen ti, pro které je akce povinná; dobrovolný účastník pozvánku nedostane", async () => {
    const id = await publishRm();
    const { link, emails } = await guests(id);
    expect(link.syncStatus).toBe("synced");
    expect(emails).toContain(email(outsider.id)); // RM: povinná
    expect(emails).not.toContain(email(participant.id)); // jen FP: dobrovolná
    expect(link.managedAttendees).toEqual(expect.arrayContaining([email(outsider.id)]));
    expect(await noteFor(outsider, id)).toBe("Pozvánku máš v Kalendáři.");
    expect(await noteFor(participant, id)).toBe("Do Kalendáře se akce přidá, až se přihlásíš.");
    const sent = await (await getDb()).select().from(simCalendarNotifications).where(eq(simCalendarNotifications.externalEventId, link.externalEventId!));
    expect(sent.map((n) => n.kind)).toEqual(["created"]);
  });
});

describe("F04 + D01: omluva pozvánku odmítne a platí ihned", () => {
  test("omluva platí ve Wiki hned, po odpovědi Wiki omluveného z pozvánky odebere; důvod ani poznámka do Kalendáře nejdou", async () => {
    const id = await publishRm();
    expect(await act(outsider, { id, change: "excuse", reason: "illness", note: NOTE })).toMatchObject({ ok: true });
    // Ve Wiki platí hned, ještě před úlohou po odpovědi. Kalendář čeká.
    const [record] = await (await getDb()).select().from(eventParticipation).where(eq(eventParticipation.eventId, id));
    expect(record).toMatchObject({ userId: outsider.id, kind: "excused" });
    expect(await noteFor(outsider, id)).toBe("Omluveno ve Wiki, Kalendář čeká.");
    expect(queued).toHaveLength(1);

    await runAfter();
    const after = await guests(id);
    expect(after.link.syncStatus).toBe("synced");
    expect(after.emails).not.toContain(email(outsider.id));
    expect(after.emails).toContain(email(organizer.id)); // ostatní povinní zůstávají
    expect(JSON.stringify(after.invite)).not.toContain(NOTE);
    expect(JSON.stringify(after.invite)).not.toContain("illness");
    // `declined` Wiki za omluveného nenastavuje (O04): z hostů zmizí, Google mu pošle zrušení.
    expect(after.invite.attendees.some((a) => a.responseStatus === "declined")).toBe(false);
    expect(await noteFor(outsider, id)).toBe("Pozvánku v Kalendáři nemáš, omluva ji odmítla.");

    // Zrušení omluvy vrátí pozvánku.
    expect(await act(outsider, { id, change: "revoke_excuse" })).toMatchObject({ ok: true });
    await runAfter();
    expect((await guests(id)).emails).toContain(email(outsider.id));
    expect(await noteFor(outsider, id)).toBe("Pozvánku máš v Kalendáři.");
  });

  test("když Kalendář selže, omluva ve Wiki platí dál a panel řekne pravdu", async () => {
    const id = await publishRm();
    await writeSwitch(await getDb(), "calendar.revoked", true);
    expect(await act(outsider, { id, change: "excuse", reason: "vacation", note: "" })).toMatchObject({ ok: true });
    await runAfter();
    const [record] = await (await getDb()).select().from(eventParticipation).where(eq(eventParticipation.eventId, id));
    expect(record?.kind).toBe("excused");
    expect((await guests(id)).link.syncStatus).toBe("attention");
    expect(await noteFor(outsider, id)).toBe("Kalendář se teď nepodařilo upravit, Wiki to zkusí znovu.");
  });
});

describe("F04: dobrovolná akce se přidá až po přihlášení", () => {
  test("přihláška přidá do pozvánky, odhlášení odebere", async () => {
    const id = await publishRm();
    expect(await act(participant, { id, change: "enroll" })).toMatchObject({ ok: true });
    expect(await noteFor(participant, id)).toBe("Pozvánka do Kalendáře čeká na odeslání.");
    await runAfter();
    expect((await guests(id)).emails).toContain(email(participant.id));
    expect(await noteFor(participant, id)).toBe("Pozvánku máš v Kalendáři.");

    expect(await act(participant, { id, change: "withdraw" })).toMatchObject({ ok: true });
    expect(await noteFor(participant, id)).toBe("Wiki akci z tvého Kalendáře právě odebírá.");
    await runAfter();
    expect((await guests(id)).emails).not.toContain(email(participant.id));
    expect(await noteFor(participant, id)).toBe("Do Kalendáře se akce přidá, až se přihlásíš.");
  });
});

describe("calendarNote: věta panelu podle stavu", () => {
  const cal = (link: OwnCalendar["link"], inCalendar: boolean): OwnCalendar => ({ link, inCalendar });
  test.each([
    ["required", cal("synced", true), "Pozvánku máš v Kalendáři."],
    ["required", cal("none", false), "Pozvánka do Kalendáře čeká na odeslání."],
    ["required", cal("pending", true), "Pozvánka do Kalendáře čeká na odeslání."],
    ["voluntary_enrolled", cal("synced", true), "Pozvánku máš v Kalendáři."],
    ["excused", cal("pending", true), "Omluveno ve Wiki, Kalendář čeká."],
    ["excused", cal("synced", false), "Pozvánku v Kalendáři nemáš, omluva ji odmítla."],
    ["excused", cal("none", false), "Pozvánku v Kalendáři nemáš, omluva ji odmítla."],
    ["optional", cal("synced", false), "Do Kalendáře se akce přidá, až se přihlásíš."],
    ["optional", cal("pending", true), "Wiki akci z tvého Kalendáře právě odebírá."],
    ["required", cal("attention", true), "Kalendář se teď nepodařilo upravit, Wiki to zkusí znovu."],
  ] as const)("%s + %j", (state, calendar, text) => expect(calendarNote(state, calendar)).toBe(text));

  test("bez znalosti stavu (osobní kalendáře, testovací příjemci) a u zrušené akce nic netvrdí", () => {
    expect(calendarNote("required", null)).toBeNull();
    expect(calendarNote("cancelled", cal("synced", true))).toBeNull();
  });
});
