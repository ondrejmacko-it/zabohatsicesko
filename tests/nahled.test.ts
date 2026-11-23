import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { greeting } from "@/lib/greeting";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { canManageUsers } from "@/server/policy";
import { monthSummary, monthTasks } from "@/features/vzdelavani/status";
import { getEventDetail } from "@/server/services/detail";
import { listMonth, nextEventsFor } from "@/server/services/events";
import { listPublishedMinutes } from "@/server/services/journey";
import { listPreviewOptions, resolvePreview } from "@/server/services/preview";
import { encodePreviewCookie, previewKeyFor } from "@/server/services/preview-context";
import { listTopics } from "@/server/services/topics";
import { admin, lead, organizer, outsider, participant, resetDemo } from "./helpers";

beforeEach(resetDemo);

const ids = async (viewer: Parameters<typeof listMonth>[0]) => (await listMonth(viewer, "2026-11")).map((c) => c.id);

describe("náhled harmonogramu očima někoho jiného", () => {
  test("náhled za skupinu ukáže přesně to, co vidí skutečný účastník", async () => {
    const fp = (await resolvePreview(organizer, "skupina-fp"))!;
    const rm = (await resolvePreview(organizer, "skupina-rm"))!;
    expect(await ids(fp.viewer)).toEqual(await ids(participant));
    expect(await ids(rm.viewer)).toEqual(await ids(outsider));

    const cards = await listMonth(fp.viewer, "2026-11");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThan((await listMonth(organizer, "2026-11")).length);
    // Návrhy, stav Kalendáře ani rozpracované přesuny se v náhledu neukazují.
    expect(cards.every((c) => c.planStatus !== "draft" && c.syncStatus === null && !c.unpublishedChanges && c.movedFrom === null)).toBe(true);
  });

  test("náhled za kolegu použije jeho roli a skupiny z databáze", async () => {
    const preview = (await resolvePreview(organizer, "kolega-demo-vedouci"))!;
    expect(preview.viewer).toEqual(lead);
    expect(await ids(preview.viewer)).toEqual(await ids(lead));
  });

  test("F16: náhled kolegy nese jeho jméno a oprávnění kolegy (Správa systému skrytá), náhled skupiny jméno nemá", async () => {
    const colleague = (await resolvePreview(organizer, "kolega-demo-vedouci"))!;
    const [row] = await (await getDb()).select({ name: users.name }).from(users).where(eq(users.id, lead.id));
    expect(colleague.personName).toBe(row!.name);
    expect(greeting(colleague.personName)).not.toContain("Správce");
    expect(canManageUsers(colleague.viewer)).toBe(false);
    expect(canManageUsers(admin)).toBe(true);
    const group = (await resolvePreview(organizer, "skupina-rm"))!;
    expect(group.personName).toBeUndefined();
    expect(greeting(group.personName)).toBe("Ahoj");
  });

  test("náhled smí zapnout jen organizátor a jen pro známý klíč", async () => {
    expect(await resolvePreview(participant, "skupina-rm")).toBeNull();
    expect(await resolvePreview(lead, "kolega-demo-organizator")).toBeNull();
    expect(await resolvePreview(organizer, "skupina-vsichni")).toBeNull();
    expect(await resolvePreview(organizer, "kolega-neexistuje")).toBeNull();
    expect(await resolvePreview(organizer, undefined)).toBeNull();
    await expect(listPreviewOptions(participant)).rejects.toThrow();

    const options = await listPreviewOptions(organizer);
    expect(options.groups.map((o) => o.key)).toEqual(["skupina-fp", "skupina-rm", "skupina-tym-a"]);
    expect(options.people.some((o) => o.key === "kolega-demo-organizator")).toBe(false);
  });

  test("detail akce v náhledu neukáže návrh ani nástroje organizátora", async () => {
    const fp = (await resolvePreview(organizer, "skupina-fp"))!;
    const all = await listMonth(organizer, "2026-11");
    const visible = new Set(await ids(fp.viewer));
    const hidden = all.find((c) => !visible.has(c.id))!;
    expect(await getEventDetail(fp.viewer, hidden.id)).toBeNull();

    const shown = (await getEventDetail(fp.viewer, [...visible][0]!))!;
    expect(shown.form).toBeNull();
    expect(shown.sync).toBeNull();
    expect(shown.canCancel || shown.canDelete).toBe(false);
    expect(shown.recording.access).not.toBe("handler");
  });
});

describe("horní bloky Plánu", () => {
  test("stav měsíce se organizátorovi převede na úkoly se správným skloňováním", async () => {
    const summary = monthSummary(await listMonth(organizer, "2026-11"), "2026-11");
    const tasks = monthTasks(summary, "Listopad");
    expect(tasks.map((t) => t.state)).toEqual(["doplnit", "navrhy"]);
    expect(tasks[0]!.title).toContain(String(summary.toComplete));

    expect(monthTasks({ planned: 3, toPublish: 1, toComplete: 2 }, "Prosinec").map((t) => t.title)).toEqual([
      "Prosinec: 2 termíny k doplnění",
      "Prosinec: 1 návrh čeká na zveřejnění",
    ]);
    expect(monthTasks({ planned: 3, toPublish: 0, toComplete: 0 }, "Prosinec")).toEqual([]);
  });

  test("nejbližší akce jsou jen zveřejněné, seřazené a nejvýš v požadovaném počtu", async () => {
    const cards = await nextEventsFor(participant, 3);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(3);
    expect(cards.every((c) => c.planStatus === "published" && c.type !== "holiday")).toBe(true);
    expect(cards.map((c) => c.startsAt)).toEqual([...cards.map((c) => c.startsAt)].sort());
  });
});

describe("globální náhled (cookie zbc_nahled)", () => {
  test("klíč platí jen pro účet, který náhled zapnul", () => {
    const value = encodePreviewCookie(organizer.id, "skupina-fp");
    expect(previewKeyFor(organizer.id, value)).toBe("skupina-fp");
    expect(previewKeyFor(participant.id, value)).toBeUndefined();
    expect(previewKeyFor(organizer.id, undefined)).toBeUndefined();
    expect(previewKeyFor(organizer.id, "skupina-fp")).toBeUndefined();
    expect(previewKeyFor(organizer.id, `${organizer.id}|`)).toBeUndefined();
    expect(previewKeyFor(organizer.id, `|skupina-fp`)).toBeUndefined();
  });

  test("podvržený klíč účastníka nic nezapne", async () => {
    expect(await resolvePreview(participant, previewKeyFor(participant.id, encodePreviewCookie(participant.id, "skupina-rm")))).toBeNull();
    expect(await resolvePreview(organizer, "skupina-neexistuje")).toBeNull();
  });

  test("Témata a Zápisy v náhledu skupiny = co vidí skutečný účastník", async () => {
    const fp = (await resolvePreview(organizer, "skupina-fp"))!;
    const rm = (await resolvePreview(organizer, "skupina-rm"))!;
    const topicIds = async (viewer: Parameters<typeof listTopics>[0]) => (await listTopics(viewer)).map((t) => t.id).sort();
    expect(await topicIds(fp.viewer)).toEqual(await topicIds(participant));
    expect(await topicIds(rm.viewer)).toEqual(await topicIds(outsider));
    const minuteIds = async (viewer: Parameters<typeof listPublishedMinutes>[0]) => (await listPublishedMinutes(viewer)).map((m) => m.eventId).sort();
    expect(await minuteIds(fp.viewer)).toEqual(await minuteIds(participant));
    expect(await minuteIds(rm.viewer)).toEqual(await minuteIds(outsider));
  });
});
