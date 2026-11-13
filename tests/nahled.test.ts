import { beforeEach, describe, expect, test } from "vitest";
import { monthSummary, monthTasks } from "@/features/vzdelavani/status";
import { getEventDetail } from "@/server/services/detail";
import { listMonth, nextEventsFor } from "@/server/services/events";
import { listPreviewOptions, resolvePreview } from "@/server/services/preview";
import { lead, organizer, outsider, participant, resetDemo } from "./helpers";

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
