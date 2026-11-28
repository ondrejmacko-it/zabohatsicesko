import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { now } from "@/server/config";
import { attendanceByEvent, attendanceScope } from "@/server/services/attendance";
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
});
