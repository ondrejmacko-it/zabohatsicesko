import { eq } from "drizzle-orm";
import { isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { calendarNote, type OwnCalendar } from "@/lib/calendar-note";
import { syncEvent, syncPublished } from "@/server/calendar/sync";
import { getDb } from "@/server/db/client";
import { calendarLinks, eventParticipation, simCalendarEvents, simCalendarNotifications } from "@/server/db/schema";
import { snapshotOf } from "@/server/domain/snapshot";
import { formValuesOf } from "@/server/services/detail";
import { createEvent, loadEventRow, updateEvent } from "@/server/services/events";
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
// Mimo požadavek nejsou cookies: bez náhledu „Zobrazit jako“.
vi.mock("next/headers", async (original) => ({ ...(await original<typeof import("next/headers")>()), cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (task: () => unknown) => void queued.push(task),
}));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: async () => ({ ...sessionUser, name: "Test", email: "t@example.invalid", signedInWith: "demo" }) }));
const { changeParticipationAction } = await import("@/features/vzdelavani/actions");
const { EventPeek } = await import("@/features/vzdelavani/components/EventPeek");
const { ParticipationPanel } = await import("@/features/vzdelavani/components/ParticipationPanel");

const NOTE = "f04-soukroma-poznamka";
const email = (id: string) => `${id}@example.invalid`;
/** Budoucí zveřejněná akce RM ze seedu bez ukázkové pozvánky (pozvánku založí fronta). */
const SEED_RM = "ev-11-26";

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
    expect(await noteFor(outsider, id)).toBe("Kalendář: pozvánka potvrzena systémem.");
    expect(await noteFor(participant, id)).toBe("Kalendář: po přihlášení se pozvánka zapíše.");
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
    expect(await noteFor(outsider, id)).toBe("Kalendář: aktualizuje se.");
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
    expect(await noteFor(outsider, id)).toBe("Kalendář: Wiki tě na akci nezve.");

    // Zrušení omluvy vrátí pozvánku.
    expect(await act(outsider, { id, change: "revoke_excuse" })).toMatchObject({ ok: true });
    await runAfter();
    expect((await guests(id)).emails).toContain(email(outsider.id));
    expect(await noteFor(outsider, id)).toBe("Kalendář: pozvánka potvrzena systémem.");
  });

  test("když Kalendář selže, omluva ve Wiki platí dál a panel řekne pravdu", async () => {
    const id = await publishRm();
    await writeSwitch(await getDb(), "calendar.revoked", true);
    expect(await act(outsider, { id, change: "excuse", reason: "vacation", note: "" })).toMatchObject({ ok: true });
    await runAfter();
    const [record] = await (await getDb()).select().from(eventParticipation).where(eq(eventParticipation.eventId, id));
    expect(record?.kind).toBe("excused");
    expect((await guests(id)).link.syncStatus).toBe("attention");
    expect(await noteFor(outsider, id)).toBe("Kalendář: zápis se nepodařil, Wiki to zkusí znovu.");
  });
});

describe("F04: dobrovolná akce se přidá až po přihlášení", () => {
  test("přihláška přidá do pozvánky, odhlášení odebere", async () => {
    const id = await publishRm();
    expect(await act(participant, { id, change: "enroll" })).toMatchObject({ ok: true });
    expect(await noteFor(participant, id)).toBe("Kalendář: aktualizuje se.");
    await runAfter();
    expect((await guests(id)).emails).toContain(email(participant.id));
    expect(await noteFor(participant, id)).toBe("Kalendář: pozvánka potvrzena systémem.");

    expect(await act(participant, { id, change: "withdraw" })).toMatchObject({ ok: true });
    expect(await noteFor(participant, id)).toBe("Kalendář: aktualizuje se.");
    await runAfter();
    expect((await guests(id)).emails).not.toContain(email(participant.id));
    expect(await noteFor(participant, id)).toBe("Kalendář: Wiki tě na akci nezve.");
  });

  // Audit P1-K1: stav Odhlášeno (withdrawn) z PR #86. Opětovná přihláška vrátí hosta právě jednou a souběžné
  // synchronizace téže akce nezaloží druhou pozvánku ani druhý řádek vazby.
  test("odhlášení a nová přihláška: host jednou, souběžný sync bez duplicitní pozvánky", async () => {
    const id = await publishRm();
    for (const change of ["enroll", "withdraw", "enroll"]) {
      expect(await act(participant, { id, change })).toMatchObject({ ok: true });
      await runAfter();
    }
    const first = await guests(id);
    expect(first.emails.filter((e) => e === email(participant.id))).toHaveLength(1);
    expect(await noteFor(participant, id)).toBe("Kalendář: pozvánka potvrzena systémem.");

    const db = await getDb();
    const before = (await db.select().from(simCalendarEvents)).length;
    await Promise.all([syncEvent(id), syncEvent(id), syncEvent(id)]);
    expect(await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, id))).toHaveLength(1);
    expect((await db.select().from(simCalendarEvents)).length).toBe(before);
    const after = await guests(id);
    expect(after.invite.id).toBe(first.invite.id);
    expect(after.emails).toEqual(first.emails);
  });
});

// Příčina padajícího e2e F04: test otevíral první kartu v seznamu, a to byla ukázková tr-rm-1112 (první budoucí
// akce ukázky). Ta má spárovanou existující pozvánku bez hostů spravovaných Wiki, panel o ní proto nic netvrdí.
// Akce ze seedu, kterým pozvánku založí až fronta (`syncPublished`, jako při návštěvě Úvodu), stav znají.
describe("F04 nad ukázkovými daty: spárovaná pozvánka vs. pozvánka založená Wiki", () => {
  test("spárovaná ukázková pozvánka: hosté nejsou spravovaní Wiki, panel stav nezná a nic netvrdí", async () => {
    await syncPublished();
    expect((await guests(PUBLISHED_RM)).link.managedAttendees).toBeNull();
    expect((await ownParticipationDetail(outsider, null, PUBLISHED_RM))?.calendar).toBeNull();
    expect(await noteFor(outsider, PUBLISHED_RM)).toBe("Kalendář: stav nelze ověřit.");
  });

  test("pozvánka, kterou fronta založí nad ukázkovou akcí, zná stav: povinná, omluva, přihláška", async () => {
    await syncPublished();
    expect((await guests(SEED_RM)).link.syncStatus).toBe("synced");
    expect(await noteFor(outsider, SEED_RM)).toBe("Kalendář: pozvánka potvrzena systémem.");
    expect(await noteFor(participant, SEED_RM)).toBe("Kalendář: po přihlášení se pozvánka zapíše.");

    expect(await act(outsider, { id: SEED_RM, change: "excuse", reason: "illness", note: "" })).toMatchObject({ ok: true });
    await runAfter();
    expect((await guests(SEED_RM)).emails).not.toContain(email(outsider.id));
    expect(await noteFor(outsider, SEED_RM)).toBe("Kalendář: Wiki tě na akci nezve.");

    expect(await act(participant, { id: SEED_RM, change: "enroll" })).toMatchObject({ ok: true });
    await runAfter();
    expect((await guests(SEED_RM)).emails).toContain(email(participant.id));
    expect(await noteFor(participant, SEED_RM)).toBe("Kalendář: pozvánka potvrzena systémem.");
  });
});

// Druhá příčina padajícího e2e F04: okno akce v Plánu (`?akce=`) stav spočítalo, ale panelu ho nepředalo.
describe("F04: okno akce v Plánu ukazuje stav vlastní pozvánky", () => {
  /** Najde ve stromu React elementů (bez renderu) první element dané komponenty. */
  function findElement(node: unknown, type: unknown): { props: Record<string, unknown> } | null {
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = findElement(child, type);
        if (found) return found;
      }
      return null;
    }
    if (!isValidElement(node)) return null;
    const element = node as { type: unknown; props: Record<string, unknown> };
    if (element.type === type) return element;
    for (const value of Object.values(element.props)) {
      const found = findElement(value, type);
      if (found) return found;
    }
    return null;
  }

  test("panel v okně dostane stejný stav Kalendáře jako detail akce", async () => {
    await syncPublished();
    const window = await EventPeek({ user: outsider, eventId: SEED_RM, preview: null, closeHref: "/vzdelavani/harmonogram" });
    const panel = findElement(window, ParticipationPanel);
    expect(panel?.props.calendar).toEqual({ link: "synced", inCalendar: true });
    expect(panel?.props.calendar).toEqual((await ownParticipationDetail(outsider, null, SEED_RM))!.calendar);
  });
});

describe("O09: ruční host spárované pozvánky (finální integrační kolo)", () => {
  // Spárovaná pozvánka po první změně: Wiki doplní chybějící hosty jako spravované, ruční host (RM účastník)
  // zůstává ručním. Panel o něm nesmí tvrdit, že pozvánku nemá nebo že na ni čeká.
  test("panel neříká nepravdu o pozvánce, kterou Wiki nespravuje, a omluva ručního hosta z pozvánky neodebere", async () => {
    const row = (await loadEventRow(await getDb(), PUBLISHED_RM))!;
    const v = formValuesOf(snapshotOf(row));
    await updateEvent(
      organizer,
      PUBLISHED_RM,
      row.revision,
      { type: v.type, label: v.label, date: v.date, endDate: v.endDate, startTime: v.startTime, endTime: v.endTime, topicTitle: "Jiné téma", topicId: null, audience: v.audience, leadId: v.leadId || null, reviewerId: v.reviewerId || null },
      "publish",
    );
    await syncEvent(PUBLISHED_RM);
    const paired = await guests(PUBLISHED_RM);
    expect(paired.link.managedAttendees).not.toBeNull();
    expect(paired.link.managedAttendees).not.toContain(email(outsider.id));
    expect(paired.emails).toContain(email(outsider.id)); // ruční host

    expect(await noteFor(outsider, PUBLISHED_RM)).toBe("Kalendář: ručně spravovaná pozvánka, Wiki ji neověřuje.");
    expect(await act(outsider, { id: PUBLISHED_RM, change: "excuse", reason: "illness", note: "" })).toMatchObject({ ok: true });
    await runAfter();
    expect((await guests(PUBLISHED_RM)).emails).toContain(email(outsider.id)); // ruční hosty Wiki nemění
    const note = await noteFor(outsider, PUBLISHED_RM);
    expect(note).toBe("Kalendář: Wiki tě na akci nezve.");
    expect(note).not.toMatch(/nemáš|odmítla/);
  });
});

describe("calendarNote: věta panelu podle stavu", () => {
  const cal = (link: OwnCalendar["link"], inCalendar: boolean): OwnCalendar => ({ link, inCalendar });
  test.each([
    ["required", cal("synced", true), "Kalendář: pozvánka potvrzena systémem."],
    ["required", cal("none", false), "Kalendář: aktualizuje se."],
    ["required", cal("pending", true), "Kalendář: aktualizuje se."],
    ["voluntary_enrolled", cal("synced", true), "Kalendář: pozvánka potvrzena systémem."],
    ["excused", cal("pending", true), "Kalendář: aktualizuje se."],
    ["excused", cal("synced", false), "Kalendář: Wiki tě na akci nezve."],
    ["excused", cal("none", false), "Kalendář: Wiki tě na akci nezve."],
    ["optional", cal("synced", false), "Kalendář: po přihlášení se pozvánka zapíše."],
    ["optional", cal("pending", true), "Kalendář: aktualizuje se."],
    ["required", cal("synced", false), "Kalendář: ručně spravovaná pozvánka, Wiki ji neověřuje."],
    ["required", cal("attention", true), "Kalendář: zápis se nepodařil, Wiki to zkusí znovu."],
  ] as const)("%s + %j", (state, calendar, text) => expect(calendarNote(state, calendar)).toBe(text));

  test.each([
    ["required", "synced", true, "Kalendář: akce je zapsaná ve tvém kalendáři „Vzdělávání ZBC“."],
    ["required", "pending", false, "Kalendář: aktualizuje se."],
    ["excused", "synced", false, "Kalendář: akce ve tvém kalendáři není."],
    ["excused", "synced", true, "Kalendář: aktualizuje se."],
    ["optional", "synced", false, "Kalendář: po přihlášení se akce zapíše do tvého kalendáře."],
    ["required", "attention", true, "Kalendář: zápis se nepodařil, Wiki to zkusí znovu."],
    ["required", "none", false, "Kalendář: osobní Kalendář Google nemáš propojený, propojíš ho na Úvodu."],
  ] as const)("osobní kalendář: %s + %s/%s", (state, link, inCalendar, text) =>
    expect(calendarNote(state, { link, inCalendar, personal: true })).toBe(text),
  );

  test("bez znalosti stavu (osobní kalendáře, testovací příjemci) a u zrušené akce nic netvrdí", () => {
    expect(calendarNote("required", null)).toBe("Kalendář: stav nelze ověřit.");
    expect(calendarNote("cancelled", cal("synced", true))).toBeNull();
  });
});
