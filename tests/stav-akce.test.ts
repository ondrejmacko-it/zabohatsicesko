import { beforeEach, describe, expect, test } from "vitest";
import { detailBadges, lifecycleStatus } from "@/features/vzdelavani/status";
import type { Viewer } from "@/server/policy";
import { getEventDetail } from "@/server/services/detail";
import { cancelEvent, loadEventRow, updateEvent, type EventCard } from "@/server/services/events";
import { getDb } from "@/server/db/client";
import { formValuesOf } from "@/server/services/detail";
import { snapshotOf } from "@/server/domain/snapshot";
import { PAST_FP, PUBLISHED_RM, admin, lead, organizer, outsider, participant, resetDemo } from "./helpers";

const card = (over: Partial<EventCard> = {}): EventCard => ({
  id: "x",
  type: "training-fp",
  label: "Trénink",
  topicTitle: null,
  startsAt: "2026-12-01T09:00:00.000Z",
  endsAt: "2026-12-01T10:00:00.000Z",
  allDay: false,
  audience: "vsichni",
  leadName: null,
  planStatus: "published",
  unpublishedChanges: false,
  extraordinary: false,
  past: false,
  syncStatus: null,
  movedFrom: null,
  original: null,
  revision: null,
  handler: false,
  minutesPublished: false,
  ...over,
});

const labels = (c: EventCard) => detailBadges(c).map((b) => b.label);

describe("štítky stavu akce v detailu", () => {
  // Správce vidí stav Kalendáře a návrh změny, ostatní role mají syncStatus null a návrh změny nevidí.
  const roles = [
    { name: "správce", syncStatus: "synced" as const, unpublishedChanges: true },
    { name: "účastník", syncStatus: null, unpublishedChanges: false },
  ];

  for (const role of roles) {
    test(`${role.name}: každý stav má právě jeden životní štítek`, () => {
      const base = { syncStatus: role.syncStatus, unpublishedChanges: role.unpublishedChanges };
      expect(labels(card({ ...base, planStatus: "draft", syncStatus: null, unpublishedChanges: false }))[0]).toBe("Návrh");
      expect(labels(card({ ...base, planStatus: "published" }))[0]).toBe("Zveřejněno");
      expect(labels(card({ ...base, planStatus: "published", past: true }))[0]).toBe("Proběhlo");
      expect(labels(card({ ...base, planStatus: "cancelled" }))).toEqual(["Zrušeno"]);
      expect(labels(card({ ...base, planStatus: "cancelled", past: true }))).toEqual(["Zrušeno"]);
      expect(labels(card({ ...base, planStatus: "draft", past: true, syncStatus: null, unpublishedChanges: false }))[0]).toBe("Návrh");
    });
  }

  test("zrušení má přednost i před svátkem, chybou Kalendáře a návrhem změny", () => {
    expect(labels(card({ planStatus: "cancelled", syncStatus: "attention", unpublishedChanges: true, extraordinary: true }))).toEqual(["Zrušeno"]);
    expect(lifecycleStatus(card({ type: "holiday", planStatus: "cancelled" })).label).toBe("Zrušeno");
    expect(labels(card({ type: "holiday" }))).toEqual(["Svátek"]);
  });

  test("zveřejněná akce s návrhem změny nebo chybou Kalendáře má jeden doplňkový štítek", () => {
    expect(labels(card({ unpublishedChanges: true, syncStatus: "synced" }))).toEqual(["Zveřejněno", "Návrh změny"]);
    expect(labels(card({ unpublishedChanges: true, syncStatus: "attention" }))).toEqual(["Zveřejněno", "Kalendář k opravě"]);
    expect(labels(card({ extraordinary: true }))).toEqual(["Zveřejněno", "Mimořádná"]);
    // Běžící synchronizace není stav, který by běžný uživatel potřeboval vidět.
    expect(labels(card({ syncStatus: "pending" }))).toEqual(["Zveřejněno"]);
  });

  test("štítky nikdy neodporují barvě: zrušeno je vždy červené", () => {
    expect(lifecycleStatus(card({ planStatus: "cancelled" })).tone).toBe("danger");
    expect(lifecycleStatus(card({ planStatus: "draft" })).tone).toBe("draft");
  });
});

describe("zrušená akce pro jednotlivé role", () => {
  beforeEach(resetDemo);

  const visible: Array<[string, Viewer]> = [
    ["organizátor", organizer],
    ["správce", admin],
    ["vedoucí", lead],
    ["kolega mimo skupinu FP", outsider],
  ];

  test("každá role, která akci vidí, dostane štítek Zrušeno a důvod", async () => {
    const row = await loadEventRow(await getDb(), PUBLISHED_RM);
    await cancelEvent(organizer, PUBLISHED_RM, row!.revision, "Vedoucí onemocněl");
    for (const [name, viewer] of visible) {
      const detail = await getEventDetail(viewer, PUBLISHED_RM);
      expect(detail, name).not.toBeNull();
      expect(detail!.card.planStatus, name).toBe("cancelled");
      expect(labels(detail!.card), name).toEqual(["Zrušeno"]);
      expect(detail!.cancelReason, name).toBe("Vedoucí onemocněl");
    }
    // Účastník bez skupiny RM akci nevidí ani zrušenou.
    expect(await getEventDetail(participant, PUBLISHED_RM)).toBeNull();
  });

  test("zrušenou akci nejde uložit jako aktivní", async () => {
    const db = await getDb();
    const row = await loadEventRow(db, PUBLISHED_RM);
    await cancelEvent(organizer, PUBLISHED_RM, row!.revision, "Nestihne se");
    const after = (await loadEventRow(db, PUBLISHED_RM))!;
    const detail = await getEventDetail(organizer, PUBLISHED_RM);
    expect(detail!.canCancel).toBe(false);
    const v = formValuesOf(snapshotOf(after));
    const input = {
      type: v.type, label: v.label, date: v.date, endDate: v.endDate, startTime: v.startTime, endTime: v.endTime,
      topicTitle: "Jiné", topicId: null, audience: v.audience, leadId: v.leadId || null, reviewerId: v.reviewerId || null,
    };
    await expect(updateEvent(organizer, PUBLISHED_RM, after.revision, input, "publish")).rejects.toThrow();
    await expect(updateEvent(organizer, PUBLISHED_RM, after.revision, input, "draft")).rejects.toThrow();
  });

  test("proběhlá zveřejněná akce má štítek Proběhlo u všech rolí", async () => {
    for (const viewer of [organizer, admin, lead, participant]) {
      const detail = await getEventDetail(viewer, PAST_FP);
      expect(labels(detail!.card)[0]).toBe("Proběhlo");
    }
  });
});
