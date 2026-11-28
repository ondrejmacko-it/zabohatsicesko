import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { calendarStatus } from "@/lib/calendar-note";
import { config, now } from "@/server/config";
import { getDb } from "@/server/db/client";
import { personalCalendarEntries, personalCalendars } from "@/server/db/schema";
import { attendanceByEvent, attendanceByPerson, attendanceDetail, attendanceHistory, attendanceScope } from "@/server/services/attendance";
import { setExcuseManagers } from "@/server/services/excuse-managers";
import { changeOwnParticipation } from "@/server/services/participation";
import { admin, lead, outsider, participant, resetDemo } from "./helpers";

// Bod 6: přehled účasti podle akcí. Správce celá firma, nadřízený jen přidělení, ostatní a náhled nic.

const DAY = 24 * 60 * 60 * 1000;
const window = () => [now(), new Date(now().getTime() + 60 * DAY)] as const;

describe("přehled účasti podle akcí", () => {
  beforeEach(async () => {
    vi.stubEnv("PARTICIPATION", "on");
    await resetDemo();
  });
  afterEach(() => vi.unstubAllEnvs());

  test("rozsah: správce vše, nadřízený jen svoje lidi, účastník a náhled nic", async () => {
    expect(await attendanceScope(admin, false)).toEqual({ kind: "all" });
    expect(await attendanceScope(admin, true)).toBeNull();
    expect(await attendanceScope(participant, false)).toBeNull();
    expect(await attendanceScope(lead, false)).toBeNull();
    await setExcuseManagers(admin, participant.id, [lead.id]);
    const scope = await attendanceScope(lead, false);
    expect(scope).toEqual({ kind: "managed", ids: new Set([participant.id]) });
    expect(await attendanceScope(lead, true)).toBeNull();
    // Odebrání vazby přístup hned ruší.
    await setExcuseManagers(admin, participant.id, []);
    expect(await attendanceScope(lead, false)).toBeNull();
  });

  test("bez zapnuté účasti se záložka nezobrazí", async () => {
    vi.stubEnv("PARTICIPATION", "off");
    expect(await attendanceScope(admin, false)).toBeNull();
  });

  test("počty podle domény: omluva a přihláška se projeví, nadřízený vidí jen svého člověka", async () => {
    const before = await attendanceByEvent({ kind: "all" }, ...window());
    const fp = before.find((e) => e.audience === "fp" && !e.cancelled);
    const rm = before.find((e) => e.audience === "rm" && !e.cancelled);
    expect(fp && rm).toBeTruthy();
    expect(before.every((e) => e.counts.expected === e.counts.required + e.counts.enrolled)).toBe(true);

    await changeOwnParticipation(participant, fp!.id, { kind: "excuse", excuse: { reason: "illness", note: null } });
    await changeOwnParticipation(participant, rm!.id, { kind: "enroll" });
    const after = await attendanceByEvent({ kind: "all" }, ...window());
    const fpAfter = after.find((e) => e.id === fp!.id)!;
    const rmAfter = after.find((e) => e.id === rm!.id)!;
    expect(fpAfter.counts.required).toBe(fp!.counts.required - 1);
    expect(fpAfter.counts.excused).toBe(fp!.counts.excused + 1);
    expect(rmAfter.counts.enrolled).toBe(rm!.counts.enrolled + 1);

    const managed = await attendanceByEvent({ kind: "managed", ids: new Set([participant.id]) }, ...window());
    expect(managed.find((e) => e.id === fp!.id)!.counts).toEqual({ required: 0, excused: 1, enrolled: 0, withdrawn: 0, expected: 0 });
    expect(managed.find((e) => e.id === rm!.id)!.counts).toEqual({ required: 0, excused: 0, enrolled: 1, withdrawn: 0, expected: 1 });
    // Člověk mimo rozsah se do počtů nedostane.
    const other = await attendanceByEvent({ kind: "managed", ids: new Set([outsider.id]) }, ...window());
    expect(other.find((e) => e.id === fp!.id)!.counts.excused).toBe(0);
  });

  test("detail akce: lidé podle stavu, důvod omluvy jen pro výslovně určeného nadřízeného", async () => {
    const list = await attendanceByEvent({ kind: "all" }, ...window());
    const fp = list.find((e) => e.audience === "fp" && !e.cancelled)!;
    await changeOwnParticipation(participant, fp.id, { kind: "excuse", excuse: { reason: "illness", note: "chřipka" } });

    // Správce vidí všechny, ale důvod omluvy ne (není určeným nadřízeným).
    const all = (await attendanceDetail(admin, { kind: "all" }, fp.id))!;
    const me = all.people.find((p) => p.id === participant.id)!;
    expect(me.state).toBe("excused");
    expect(me.excuse).toBeNull();
    expect(all.people.every((p) => p.state !== "optional")).toBe(true);
    expect(all.counts.excused).toBe(all.people.filter((p) => p.state === "excused").length);
    expect(all.people.some((p) => p.id === outsider.id)).toBe(false);

    await setExcuseManagers(admin, participant.id, [lead.id]);
    const scope = (await attendanceScope(lead, false))!;
    const managed = (await attendanceDetail(lead, scope, fp.id))!;
    expect(managed.people.map((p) => p.id)).toEqual([participant.id]);
    expect(managed.people[0]?.excuse).toEqual({ reason: "illness", note: "chřipka" });

    expect(await attendanceDetail(admin, { kind: "all" }, "neexistuje")).toBeNull();
  });

  test("přehled podle lidí a historie z auditu, nadřízený jen svého člověka", async () => {
    const list = await attendanceByEvent({ kind: "all" }, ...window());
    const fp = list.find((e) => e.audience === "fp" && !e.cancelled)!;
    const before = (await attendanceByPerson({ kind: "all" }, ...window())).find((p) => p.id === participant.id)!;
    await changeOwnParticipation(participant, fp.id, { kind: "excuse", excuse: { reason: "illness", note: null } });
    const after = (await attendanceByPerson({ kind: "all" }, ...window())).find((p) => p.id === participant.id)!;
    expect(after.counts.excused).toBe(before.counts.excused + 1);
    expect(after.counts.required).toBe(before.counts.required - 1);

    await setExcuseManagers(admin, participant.id, [lead.id]);
    const history = (await attendanceHistory({ kind: "all" }, participant.id))!;
    expect(history.map((h) => h.action)).toEqual(["excuse_managers.changed", "participation.excuse"]);
    expect(history[1]).toMatchObject({ eventId: fp.id, eventTitle: fp.title });

    const scope = (await attendanceScope(lead, false))!;
    expect((await attendanceByPerson(scope, ...window())).map((p) => p.id)).toEqual([participant.id]);
    expect(await attendanceHistory(scope, outsider.id)).toBeNull();
    expect(await attendanceHistory({ kind: "all" }, "neexistuje")).toBeNull();
  });

  test("problémy Kalendáře za akci odpovídají detailu, osobní režim počítá nepropojené i chybějící zápisy", async () => {
    const problemsInDetail = async (eventId: string, cancelled: boolean, scope: Parameters<typeof attendanceDetail>[1] = { kind: "all" }) =>
      (await attendanceDetail(admin, scope, eventId))!.people.filter((p) => calendarStatus(cancelled ? "cancelled" : p.state, p.calendar)?.problem).length;
    for (const e of await attendanceByEvent({ kind: "all" }, ...window())) expect(e.calendarProblems).toBe(await problemsInDetail(e.id, e.cancelled));

    vi.stubEnv("CALENDAR_MODE", "google-test");
    vi.stubEnv("CALENDAR_DELIVERY", "personal");
    const scope = { kind: "managed", ids: new Set([participant.id]) } as const;
    const fp = (await attendanceByEvent(scope, ...window())).find((e) => e.audience === "fp" && !e.cancelled)!;
    // Bez propojeného kalendáře je problémem každá akce, na kterou má člověk přijít.
    expect(fp.counts.expected).toBe(1);
    expect(fp.calendarProblems).toBe(1);

    const db = await getDb();
    await db.insert(personalCalendars).values({ userId: participant.id, orgId: config.orgId, accountEmail: "p@example.com", encryptedRefreshToken: "x", scopes: "s", status: "active", syncedAt: now() });
    expect((await attendanceByEvent(scope, ...window())).find((e) => e.id === fp.id)!.calendarProblems).toBe(1);
    await db.insert(personalCalendarEntries).values({ userId: participant.id, eventId: fp.id, externalEventId: "x", dataHash: "h" });
    const synced = await attendanceByEvent(scope, ...window());
    expect(synced.find((e) => e.id === fp.id)!.calendarProblems).toBe(0);
    for (const e of synced) expect(e.calendarProblems).toBe(await problemsInDetail(e.id, e.cancelled, scope));
  });
});
