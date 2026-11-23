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
    expect(await noteFor(outsider, id)).toBe("Odebrání z pozvánky v Kalendáři čeká na odeslání.");
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
    expect(await noteFor(outsider, id)).toBe("Wiki tě na tuto akci do Kalendáře nezve.");

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
    expect(await noteFor(participant, id)).toBe("Wiki tě na tuto akci do Kalendáře nezve.");
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
    expect(await noteFor(participant, id)).toBe("Pozvánku máš v Kalendáři.");

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
    expect(await noteFor(outsider, PUBLISHED_RM)).toBeNull();
  });

  test("pozvánka, kterou fronta založí nad ukázkovou akcí, zná stav: povinná, omluva, přihláška", async () => {
    await syncPublished();
    expect((await guests(SEED_RM)).link.syncStatus).toBe("synced");
    expect(await noteFor(outsider, SEED_RM)).toBe("Pozvánku máš v Kalendáři.");
    expect(await noteFor(participant, SEED_RM)).toBe("Do Kalendáře se akce přidá, až se přihlásíš.");

    expect(await act(outsider, { id: SEED_RM, change: "excuse", reason: "illness", note: "" })).toMatchObject({ ok: true });
    await runAfter();
    expect((await guests(SEED_RM)).emails).not.toContain(email(outsider.id));
    expect(await noteFor(outsider, SEED_RM)).toBe("Wiki tě na tuto akci do Kalendáře nezve.");

    expect(await act(participant, { id: SEED_RM, change: "enroll" })).toMatchObject({ ok: true });
    await runAfter();
    expect((await guests(SEED_RM)).emails).toContain(email(participant.id));
    expect(await noteFor(participant, SEED_RM)).toBe("Pozvánku máš v Kalendáři.");
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

    expect(await noteFor(outsider, PUBLISHED_RM)).toBe("Wiki tvoji pozvánku nespravuje. Její stav ověř v Kalendáři.");
    expect(await act(outsider, { id: PUBLISHED_RM, change: "excuse", reason: "illness", note: "" })).toMatchObject({ ok: true });
    await runAfter();
    expect((await guests(PUBLISHED_RM)).emails).toContain(email(outsider.id)); // ruční hosty Wiki nemění
    const note = await noteFor(outsider, PUBLISHED_RM);
    expect(note).toBe("Wiki tě na tuto akci do Kalendáře nezve.");
    expect(note).not.toMatch(/nemáš|odmítla/);
  });
});

describe("calendarNote: věta panelu podle stavu", () => {
  const cal = (link: OwnCalendar["link"], inCalendar: boolean): OwnCalendar => ({ link, inCalendar });
  test.each([
    ["required", cal("synced", true), "Pozvánku máš v Kalendáři."],
    ["required", cal("none", false), "Pozvánka do Kalendáře čeká na odeslání."],
    ["required", cal("pending", true), "Pozvánka do Kalendáře čeká na odeslání."],
    ["voluntary_enrolled", cal("synced", true), "Pozvánku máš v Kalendáři."],
    ["excused", cal("pending", true), "Odebrání z pozvánky v Kalendáři čeká na odeslání."],
    ["excused", cal("synced", false), "Wiki tě na tuto akci do Kalendáře nezve."],
    ["excused", cal("none", false), "Wiki tě na tuto akci do Kalendáře nezve."],
    ["optional", cal("synced", false), "Do Kalendáře se akce přidá, až se přihlásíš."],
    ["optional", cal("pending", true), "Wiki akci z tvého Kalendáře právě odebírá."],
    ["required", cal("synced", false), "Wiki tvoji pozvánku nespravuje. Její stav ověř v Kalendáři."],
    ["required", cal("attention", true), "Kalendář se teď nepodařilo upravit, Wiki to zkusí znovu."],
  ] as const)("%s + %j", (state, calendar, text) => expect(calendarNote(state, calendar)).toBe(text));

  test("bez znalosti stavu (osobní kalendáře, testovací příjemci) a u zrušené akce nic netvrdí", () => {
    expect(calendarNote("required", null)).toBeNull();
    expect(calendarNote("cancelled", cal("synced", true))).toBeNull();
  });
});
