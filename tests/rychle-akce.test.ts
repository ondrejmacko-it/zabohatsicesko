import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { clearRateLimit } from "@/server/audit";
import { getDb } from "@/server/db/client";
import { calendarLinks, events } from "@/server/db/schema";
import { cardActions, type CardActionContext } from "@/features/vzdelavani/status";
import { duplicateFormValues, suggestedCopyDate } from "@/server/services/detail";
import { createEvent, listMonth, type EventCard, type EventInput } from "@/server/services/events";
import { DomainError } from "@/server/services/errors";
import { lead, organizer, participant, resetDemo } from "./helpers";

vi.mock("next/cache", () => ({ refresh: () => undefined }));
// Mimo požadavek nejsou cookies: bez náhledu „Zobrazit jako“.
vi.mock("next/headers", async (original) => ({ ...(await original<typeof import("next/headers")>()), cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: async () => ({ ...organizer, name: "Správce" }) }));

const { saveEventAction } = await import("@/features/vzdelavani/actions");

const NOW = new Date("2026-11-12T09:00:00+01:00");
const manager: CardActionContext = { managing: true, preview: false, movable: true, now: NOW };
const reader: CardActionContext = { managing: false, preview: false, movable: false, now: NOW };

const card = (over: Partial<EventCard> = {}): EventCard => ({
  id: "x",
  type: "training-fp",
  label: "Trénink",
  topicTitle: "Téma",
  startsAt: "2026-12-01T09:00:00.000Z",
  endsAt: "2026-12-01T10:00:00.000Z",
  allDay: false,
  audience: "fp",
  leadName: "Vedoucí",
  planStatus: "published",
  unpublishedChanges: false,
  extraordinary: false,
  past: false,
  syncStatus: "synced",
  movedFrom: null,
  original: null,
  revision: 3,
  handler: true,
  leadsOrReviews: false,
  minutesPublished: false,
  ...over,
});
const kinds = (c: EventCard, ctx: CardActionContext) => cardActions(c, ctx).map((a) => a.kind);
const PAST = { startsAt: "2026-11-05T09:00:00.000Z", endsAt: "2026-11-05T10:00:00.000Z", past: true };

describe("menu ⋯ na kartě: položky podle stavu a role", () => {
  test("návrh správce: Upravit, Přesunout, Duplikovat, Zveřejnit a pod čarou Smazat", () => {
    const draft = card({ planStatus: "draft", syncStatus: null });
    expect(kinds(draft, manager)).toEqual(["edit", "move", "duplicate", "publish", "delete"]);
    expect(cardActions(draft, manager).at(-1)).toEqual({ kind: "delete", label: "Smazat návrh…", danger: true });
    // Mimo přesunutelný rozsah (např. sousední měsíc) bez Přesunout.
    expect(kinds(draft, { ...manager, movable: false })).toEqual(["edit", "duplicate", "publish", "delete"]);
  });

  test("proběhlý návrh nejde zveřejnit ani přesunout, smazat ano", () => {
    expect(kinds(card({ planStatus: "draft", ...PAST }), manager)).toEqual(["edit", "duplicate", "delete"]);
  });

  test("zveřejněná budoucí: Upravit, Přesunout, Duplikovat, Podrobnosti a Zrušit, nikdy Smazat", () => {
    const actions = cardActions(card(), manager);
    expect(actions.map((a) => a.kind)).toEqual(["edit", "move", "duplicate", "details", "cancel"]);
    expect(actions.at(-1)).toEqual({ kind: "cancel", label: "Zrušit akci…", danger: true });
    expect(kinds(card({ unpublishedChanges: true }), manager)).not.toContain("delete");
  });

  test("proběhlá: podrobnosti, zápis podle zveřejnění, nahrávka pro obsluhu, kopie jen správce", () => {
    expect(kinds(card({ ...PAST, minutesPublished: true }), manager)).toEqual(["details", "minutes", "recording", "duplicate"]);
    expect(cardActions(card(PAST), manager).find((a) => a.kind === "recording")?.label).toBe("Doplnit zápis");
    // C-02: vedle „Zobrazit zápis“ (čtení) je obsluha „Upravit zápis“, ne „Nahrávka a zápis“.
    expect(cardActions(card({ ...PAST, minutesPublished: true }), manager).find((a) => a.kind === "recording")?.label).toBe("Upravit zápis");
    expect(cardActions(card(PAST), manager).find((a) => a.kind === "duplicate")?.label).toBe("Duplikovat jako novou");
    // Vedoucí (obsluha nahrávky), bez úprav a bez kopie.
    expect(kinds(card({ ...PAST, minutesPublished: true }), reader)).toEqual(["details", "minutes", "recording"]);
    // Účastník se zveřejněným zápisem: dvě položky, menu má smysl.
    expect(kinds(card({ ...PAST, minutesPublished: true, handler: false }), reader)).toEqual(["details", "minutes"]);
  });

  test("ne-správce s jedinou položkou menu nedostane", () => {
    expect(cardActions(card({ handler: false }), reader)).toEqual([]);
    expect(cardActions(card({ ...PAST, handler: false }), reader)).toEqual([]);
    expect(cardActions(card({ planStatus: "cancelled", handler: false }), reader)).toEqual([]);
  });

  test("zrušená akce: jen podrobnosti a kopie pro správce; svátek bez menu", () => {
    expect(kinds(card({ planStatus: "cancelled" }), manager)).toEqual(["details", "duplicate"]);
    expect(cardActions(card({ type: "holiday", planStatus: "published" }), manager)).toEqual([]);
  });

  test("náhled očima skupiny nebo kolegy: jen čtení, žádné úpravy ani nahrávka", () => {
    const preview = { ...manager, managing: false, preview: true };
    expect(kinds(card(), preview)).toEqual([]);
    expect(kinds(card({ ...PAST, minutesPublished: true }), preview)).toEqual(["details", "minutes"]);
    expect(kinds(card({ planStatus: "draft" }), preview)).toEqual([]);
  });

  test("D2: náhled očima správce nabídne stejné položky jako u něj (zamyká je CardMenu), nahrávku ne", () => {
    const asOrganizer = { ...manager, preview: true };
    for (const c of [card(), card({ planStatus: "draft" }), card({ planStatus: "cancelled" })]) expect(kinds(c, asOrganizer)).toEqual(kinds(c, manager));
    expect(kinds(card({ ...PAST, handler: true }), asOrganizer)).not.toContain("recording");
  });
});

const source: EventInput = {
  type: "workshop",
  label: "Workshop kopie",
  date: "2026-11-24",
  endDate: null,
  startTime: "14:00",
  endTime: "16:00",
  topicTitle: "Porovnání dvou postupů",
  topicId: null,
  audience: "fp",
  leadId: "demo-vedouci",
  reviewerId: "demo-ucastnik",
};

describe("Duplikovat akci", () => {
  beforeEach(resetDemo);
  afterEach(async () => clearRateLimit(await getDb(), `action:${organizer.id}`));

  test("navržené datum: o týden později, jinak nejbližší stejný den v týdnu od zítřka", () => {
    expect(suggestedCopyDate("2026-11-24", "2026-11-12")).toBe("2026-12-01");
    // O týden později by byl dnešek nebo minulost: nejbližší úterý od zítřka.
    expect(suggestedCopyDate("2026-11-05", "2026-11-12")).toBe("2026-11-19");
    expect(suggestedCopyDate("2026-10-06", "2026-11-12")).toBe("2026-11-17");
    expect(suggestedCopyDate("2026-11-06", "2026-11-12")).toBe("2026-11-13");
  });

  test("kopíruje jen pole formuláře, datum navrhne", async () => {
    const id = await createEvent(organizer, source, "publish");
    expect(await duplicateFormValues(organizer, id, "2026-11-12")).toEqual({
      type: "workshop",
      label: "Workshop kopie",
      date: "2026-12-01",
      endDate: null,
      startTime: "14:00",
      endTime: "16:00",
      topicTitle: "Porovnání dvou postupů",
      audience: "fp",
      leadId: "demo-vedouci",
      reviewerId: "demo-ucastnik",
    });
  });

  test("jen správce; neznámá akce a svátek nic nepředvyplní", async () => {
    await expect(duplicateFormValues(participant, "ev-11-25", "2026-11-12")).rejects.toThrow(DomainError);
    await expect(duplicateFormValues(lead, "tr-fp-1111", "2026-11-12")).rejects.toThrow(DomainError);
    expect(await duplicateFormValues(organizer, "neexistuje", "2026-11-12")).toBeNull();
    expect(await duplicateFormValues(organizer, "ev-11-17", "2026-11-12")).toBeNull();
  });

  const form = (values: Record<string, string>) => {
    const fd = new FormData();
    for (const [key, value] of Object.entries(values)) fd.set(key, value);
    return fd;
  };
  const copyForm = (intent: "draft" | "publish", extra: Record<string, string> = {}) =>
    form({
      type: "workshop",
      label: "Kopie e2e",
      date: "2026-12-01",
      startTime: "14:00",
      endTime: "16:00",
      topicTitle: "Porovnání dvou postupů",
      audience: "fp",
      leadId: "demo-vedouci",
      reviewerId: "",
      intent,
      duplicateOf: "tr-fp-1111",
      ...extra,
    });

  test("kopie vznikne jen jako nový návrh bez vazeb zdroje, zveřejnění server odmítne", async () => {
    const db = await getDb();
    const before = await db.select({ id: events.id }).from(events);

    const refused = await saveEventAction(null, copyForm("publish"));
    expect(refused.ok).toBe(false);
    // Kopii nejde ani podstrčit jako úpravu existující akce.
    expect((await saveEventAction(null, copyForm("draft", { id: "ev-11-25", revision: "1" }))).ok).toBe(false);
    expect(await db.select({ id: events.id }).from(events)).toHaveLength(before.length);

    const saved = await saveEventAction(null, copyForm("draft"));
    expect(saved.ok).toBe(true);
    const id = saved.ok ? saved.id! : "";
    expect(id).not.toBe("tr-fp-1111");
    const [row] = await db.select().from(events).where(eq(events.id, id));
    expect(row).toMatchObject({ status: "draft", publishedRevision: null, published: null, revision: 1, generationKey: null });
    expect(await db.select().from(calendarLinks).where(and(eq(calendarLinks.eventId, id)))).toHaveLength(0);
    const mine = (await listMonth(organizer, "2026-12")).find((c) => c.id === id)!;
    expect(mine).toMatchObject({ planStatus: "draft", minutesPublished: false, label: "Kopie e2e" });
  });
});

describe("karta nese údaje pro menu bez dalších dotazů na akci", () => {
  beforeEach(resetDemo);

  test("zveřejněný zápis a obsluha nahrávky podle oprávnění", async () => {
    // Vedoucí akce ev-11-6 není, zápis ale čte jako člen skupiny. Kdo akci nevidí, kartu nemá vůbec.
    expect((await listMonth(lead, "2026-11")).find((c) => c.id === "ev-11-6")).toMatchObject({ minutesPublished: true });
    expect((await listMonth(organizer, "2026-11")).find((c) => c.id === "ev-11-6")).toMatchObject({ minutesPublished: true, handler: true });
    expect((await listMonth(lead, "2026-11")).find((c) => c.id === "tr-fp-1111")).toMatchObject({ handler: true });
    expect((await listMonth(organizer, "2026-11")).find((c) => c.id === "ev-11-25")).toMatchObject({ handler: false, minutesPublished: false });
  });
});
