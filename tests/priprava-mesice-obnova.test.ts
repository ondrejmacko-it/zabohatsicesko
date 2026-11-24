import { and, eq, like } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { monthOf, toDateKey } from "@/lib/time";
import { getDb } from "@/server/db/client";
import { events, generationExclusions } from "@/server/db/schema";
import { defaultAudience } from "@/server/domain/generation";
import {
  cancelEvent,
  createEvent,
  deleteDraft,
  deleteDrafts,
  generateMonth,
  listMonthDrafts,
  loadEventRow,
  loadTemplate,
  publishDrafts,
  updateTemplate,
  type EventInput,
} from "@/server/services/events";
import { PAST_FP, organizer, participant, resetDemo } from "./helpers";

// Audit P0 §7 (23. 11. 2026): příprava měsíce a ztráta návrhů. Ukázka běží 12. 11. 2026.
// Prosinec 2026: úterý 10:00–12:00 je v šabloně akce pro tým A, 24. a 25. 12. jsou svátky.
const MONTH = "2026-12";
const TUESDAY = "2026-12-08";
const manual: EventInput = {
  type: "other", label: "Ruční akce", date: "2026-12-15", endDate: null, startTime: "10:30", endTime: "11:30",
  topicTitle: null, topicId: null, audience: defaultAudience("action"), leadId: null, reviewerId: null,
};

beforeEach(resetDemo);

const monthDrafts = async (month = MONTH) => (await listMonthDrafts(organizer, month)).drafts;
const templateDrafts = async (month = MONTH) => (await monthDrafts(month)).filter((d) => d.fromTemplate && d.type !== "holiday");
const draftOn = async (day: string) => (await templateDrafts(monthOf(day))).find((d) => toDateKey(new Date(d.startsAt)) === day);
const deleteAll = async (month = MONTH) => {
  const list = await templateDrafts(month);
  const { deleted } = await deleteDrafts(organizer, list.map((d) => ({ id: d.id, revision: d.revision })));
  expect(deleted).toHaveLength(list.length);
  return list.length;
};
const monthRows = async (month = MONTH) =>
  (await (await getDb()).select().from(events).where(like(events.generationKey, `%:${month}-%`)));
const exclusionsOf = async (month: string) =>
  (await getDb()).select().from(generationExclusions).where(like(generationExclusions.generationKey, `%:${month}-%`));
/** Každý klíč slotu je v tabulce akcí nejvýš jednou (unikátní index to vynucuje, test to hlídá i v datech). */
const expectNoDuplicates = async (month = MONTH) => {
  const keys = (await monthRows(month)).map((e) => e.generationKey);
  expect(new Set(keys).size).toBe(keys.length);
};

describe("příprava měsíce: obnova smazaných návrhů", () => {
  test("1 prázdný měsíc: doplnění vytvoří návrhy, nic neobnovuje a nic nezveřejní", async () => {
    const result = await generateMonth(organizer, MONTH);
    expect(result.created).toBeGreaterThan(10);
    expect(result).toMatchObject({ restored: 0, deletedLeft: 0 });
    expect((await templateDrafts()).length).toBeGreaterThan(10);
    expect((await listMonthDrafts(organizer, MONTH)).deletedSlots).toBe(0);
  });

  test("2 jen svátky: měsíc bez pracovních akcí doplnění obnoví celý, svátky se nezdvojí", async () => {
    await generateMonth(organizer, MONTH);
    const holidays = (await monthRows()).filter((e) => e.type === "holiday").length;
    const count = await deleteAll();
    expect((await listMonthDrafts(organizer, MONTH)).deletedSlots).toBe(count);
    const result = await generateMonth(organizer, MONTH);
    expect(result).toMatchObject({ created: count, restored: count, deletedLeft: 0 });
    expect((await monthRows()).filter((e) => e.type === "holiday")).toHaveLength(holidays);
    expect(await exclusionsOf(MONTH)).toHaveLength(0);
    await expectNoDuplicates();
  });

  test("3 existující návrhy: opakované doplnění nic nepřidá", async () => {
    await generateMonth(organizer, MONTH);
    const before = (await monthRows()).length;
    expect((await generateMonth(organizer, MONTH)).created).toBe(0);
    expect((await generateMonth(organizer, MONTH, { restoreDeleted: true })).created).toBe(0);
    expect(await monthRows()).toHaveLength(before);
  });

  test("4 zveřejněné akce: smazané návrhy vedle zveřejněné akce jdou vrátit, zveřejněná zůstane beze změny", async () => {
    await generateMonth(organizer, MONTH);
    const first = (await draftOn(TUESDAY))!;
    await publishDrafts(organizer, MONTH, [{ id: first.id, revision: first.revision, topicTitle: "Téma", leadId: "demo-vedouci" }]);
    const published = (await loadEventRow(await getDb(), first.id))!;
    const count = await deleteAll();

    // Dřív: zveřejněná akce zablokovala obnovu a hláška tvrdila, že všechny termíny v plánu jsou.
    const plain = await generateMonth(organizer, MONTH);
    expect(plain).toMatchObject({ created: 0, deletedLeft: count });
    const restored = await generateMonth(organizer, MONTH, { restoreDeleted: true });
    expect(restored).toMatchObject({ created: count, restored: count, deletedLeft: 0 });
    const after = (await loadEventRow(await getDb(), first.id))!;
    expect(after.revision).toBe(published.revision);
    expect(after.status).toBe("published");
    await expectNoDuplicates();
  });

  test("5 jeden smazaný návrh: běžné doplnění ho nevrátí, obnova ano a jen jednou", async () => {
    await generateMonth(organizer, MONTH);
    const draft = (await draftOn(TUESDAY))!;
    await deleteDraft(organizer, draft.id, draft.revision);
    expect(await generateMonth(organizer, MONTH)).toMatchObject({ created: 0, deletedLeft: 1 });
    expect(await draftOn(TUESDAY)).toBeUndefined();
    expect((await listMonthDrafts(organizer, MONTH)).deletedSlots).toBe(1);

    expect(await generateMonth(organizer, MONTH, { restoreDeleted: true })).toMatchObject({ created: 1, restored: 1, deletedLeft: 0 });
    const back = (await draftOn(TUESDAY))!;
    expect(back.id).not.toBe(draft.id);
    expect(back.fromTemplate).toBe(true);
    expect((await loadEventRow(await getDb(), back.id))!.status).toBe("draft");
    expect((await listMonthDrafts(organizer, MONTH)).deletedSlots).toBe(0);
  });

  test("6 ruční akce: jediná ruční akce obnovu nezablokuje a zůstane nedotčená", async () => {
    await generateMonth(organizer, MONTH);
    const id = await createEvent(organizer, { ...manual, audience: "fp", date: "2026-12-30", startTime: "18:00", endTime: "19:00" }, "draft");
    const count = await deleteAll();
    expect(await generateMonth(organizer, MONTH)).toMatchObject({ created: 0, deletedLeft: count });
    expect(await generateMonth(organizer, MONTH, { restoreDeleted: true })).toMatchObject({ created: count, deletedLeft: 0 });
    const kept = (await loadEventRow(await getDb(), id))!;
    expect(kept.revision).toBe(1);
    expect(kept.generationKey).toBeNull();
  });

  test("7 přesunutý termín: obnova ho na původním místě nezdvojí", async () => {
    await generateMonth(organizer, MONTH);
    const draft = (await draftOn(TUESDAY))!;
    await publishDrafts(organizer, MONTH, [{ id: draft.id, revision: draft.revision, topicTitle: null, leadId: null, date: "2026-12-10" }], 0, { publish: false });
    const other = (await draftOn("2026-12-15"))!;
    await deleteDraft(organizer, other.id, other.revision);
    expect(await generateMonth(organizer, MONTH, { restoreDeleted: true })).toMatchObject({ created: 1, restored: 1 });
    expect(await draftOn(TUESDAY)).toBeUndefined();
    expect(toDateKey((await loadEventRow(await getDb(), draft.id))!.startsAt)).toBe("2026-12-10");
    await expectNoDuplicates();
  });

  test("8 zrušený termín: ani prázdný měsíc, ani obnova vědomě zrušenou akci nevrátí", async () => {
    await generateMonth(organizer, MONTH);
    const draft = (await draftOn(TUESDAY))!;
    await publishDrafts(organizer, MONTH, [{ id: draft.id, revision: draft.revision, topicTitle: "Téma", leadId: "demo-vedouci" }]);
    const row = (await loadEventRow(await getDb(), draft.id))!;
    await cancelEvent(organizer, draft.id, row.revision, "Lektor onemocněl");
    const count = await deleteAll();

    // Měsíc má jen zrušenou akci a svátky: doplnění obnoví smazané návrhy, zrušený slot ne.
    expect(await generateMonth(organizer, MONTH)).toMatchObject({ created: count, restored: count });
    expect(await draftOn(TUESDAY)).toBeUndefined();
    expect((await generateMonth(organizer, MONTH, { restoreDeleted: true })).created).toBe(0);
    const tuesday = (await monthRows()).filter((e) => e.generationKey?.endsWith(`:${TUESDAY}`));
    expect(tuesday.map((e) => e.status)).toEqual(["cancelled"]);
  });

  test("9 konflikt: smazaný termín obsazený akcí stejné skupiny se neobnoví a zůstane smazaný", async () => {
    await generateMonth(organizer, MONTH);
    const draft = (await draftOn("2026-12-15"))!;
    await deleteDraft(organizer, draft.id, draft.revision);
    const id = await createEvent(organizer, manual, "publish");
    const result = await generateMonth(organizer, MONTH, { restoreDeleted: true });
    expect(result).toMatchObject({ created: 0, skipped: 1, restored: 0, deletedLeft: 1 });
    expect(await exclusionsOf(MONTH)).toHaveLength(1);

    // Po zrušení ruční akce se termín sám nevrátí, jen na výslovnou obnovu.
    const row = (await loadEventRow(await getDb(), id))!;
    await cancelEvent(organizer, id, row.revision, "Přesunuto");
    expect((await generateMonth(organizer, MONTH)).created).toBe(0);
    expect(await generateMonth(organizer, MONTH, { restoreDeleted: true })).toMatchObject({ created: 1, restored: 1 });
  });

  test("10 upravený rozvrh: obnova použije aktuální čas, vypnutý den se nenabízí a výjimka zůstane", async () => {
    await generateMonth(organizer, MONTH);
    const draft = (await draftOn(TUESDAY))!;
    await deleteDraft(organizer, draft.id, draft.revision);
    const template = await loadTemplate();
    const change = (patch: Partial<{ startTime: string; endTime: string; active: boolean }>) =>
      updateTemplate(organizer, template.map((s) => ({ isoWeekday: s.isoWeekday, startTime: s.startTime, endTime: s.endTime, types: s.types as never, active: s.active, ...(s.isoWeekday === 2 ? patch : {}) })));

    await change({ active: false });
    expect((await listMonthDrafts(organizer, MONTH)).deletedSlots).toBe(0);
    expect(await generateMonth(organizer, MONTH, { restoreDeleted: true })).toMatchObject({ created: 0, deletedLeft: 0 });
    expect(await exclusionsOf(MONTH)).toHaveLength(1);

    await change({ active: true, startTime: "13:00", endTime: "15:00" });
    expect(await generateMonth(organizer, MONTH, { restoreDeleted: true })).toMatchObject({ created: 1, restored: 1 });
    const back = (await draftOn(TUESDAY))!;
    expect(new Date(back.startsAt).toISOString()).toBe("2026-12-08T12:00:00.000Z");
  });

  test("11 opakované kliknutí: druhá obnova nic nepřidá", async () => {
    await generateMonth(organizer, MONTH);
    const draft = (await draftOn(TUESDAY))!;
    await deleteDraft(organizer, draft.id, draft.revision);
    expect((await generateMonth(organizer, MONTH, { restoreDeleted: true })).created).toBe(1);
    expect((await generateMonth(organizer, MONTH, { restoreDeleted: true })).created).toBe(0);
    expect((await generateMonth(organizer, MONTH)).created).toBe(0);
    await expectNoDuplicates();
  });

  test("12 souběžné generování: dva požadavky naráz nevytvoří duplicity", async () => {
    await generateMonth(organizer, MONTH);
    const count = await deleteAll();
    const results = await Promise.all([
      generateMonth(organizer, MONTH, { restoreDeleted: true }),
      generateMonth(organizer, MONTH, { restoreDeleted: true }),
      generateMonth(organizer, MONTH),
    ]);
    expect(results.reduce((sum, r) => sum + r.created, 0)).toBe(count);
    expect(await templateDrafts()).toHaveLength(count);
    await expectNoDuplicates();
  });

  test("13 historicky vyloučené sloty: proběhlý smazaný termín se neobnoví, budoucí ano", async () => {
    // Listopad 2026, dnes je 12. 11.: jeden smazaný termín před dneškem, jeden po něm.
    const db = await getDb();
    const keyed = (await monthRows("2026-11")).filter((e) => e.generationKey && e.type !== "holiday");
    const past = keyed.find((e) => toDateKey(e.startsAt) < "2026-11-12")!;
    const future = keyed.find((e) => toDateKey(e.startsAt) > "2026-11-12")!;
    expect(past && future).toBeTruthy();
    for (const row of [past, future]) {
      await db.delete(events).where(eq(events.id, row.id));
      await db.insert(generationExclusions).values({ orgId: row.orgId, generationKey: row.generationKey! });
    }
    expect((await listMonthDrafts(organizer, "2026-11")).deletedSlots).toBe(1);
    const result = await generateMonth(organizer, "2026-11", { restoreDeleted: true });
    expect(result.restored).toBe(1);
    const keys = new Set((await monthRows("2026-11")).map((e) => e.generationKey));
    expect(keys.has(future.generationKey)).toBe(true);
    expect(keys.has(past.generationKey)).toBe(false);
    const left = await db.select().from(generationExclusions).where(and(eq(generationExclusions.generationKey, past.generationKey!)));
    expect(left).toHaveLength(1);
  });

  test("14 přesah mezi měsíci: akce přes hranici měsíce obnovu neblokuje a obnova sousední měsíc nezmění", async () => {
    await generateMonth(organizer, MONTH);
    await generateMonth(organizer, "2027-01");
    const january = await deleteAll("2027-01");
    const count = await deleteAll();
    // Vícedenní ruční akce 30. 11. 9:00 – 1. 12. 9:00 zasahuje do prosince (před úterním termínem v 10:00).
    await createEvent(organizer, { ...manual, label: "Výjezd", date: "2026-11-30", endDate: "2026-12-01", startTime: "09:00", endTime: "09:00" }, "draft");
    expect(await generateMonth(organizer, MONTH)).toMatchObject({ created: 0, deletedLeft: count });
    expect(await generateMonth(organizer, MONTH, { restoreDeleted: true })).toMatchObject({ created: count, restored: count });
    expect(await exclusionsOf("2027-01")).toHaveLength(january);
    expect(await templateDrafts("2027-01")).toHaveLength(0);
  });
});

// Rozhodnutí vlastníka 23. 11. 2026 (O2, O3).
describe("příprava měsíce: proběhlé dny a obnova po jednom", () => {
  test("O2 aktuální měsíc: doplnění nevytvoří návrh pro proběhlý den, budoucí ano, minulé akce beze změny", async () => {
    const db = await getDb();
    const keyed = (await monthRows("2026-11")).filter((e) => e.generationKey && e.type !== "holiday" && e.id !== PAST_FP);
    const past = keyed.find((e) => toDateKey(e.startsAt) < "2026-11-12")!;
    const future = keyed.find((e) => toDateKey(e.startsAt) > "2026-11-12")!;
    // Termíny bez akce i bez výjimky (např. dřív vypnutý den rozvrhu): doplnění je vidí jako chybějící.
    for (const row of [past, future]) await db.delete(events).where(eq(events.id, row.id));
    const before = (await loadEventRow(db, PAST_FP))!;

    const result = await generateMonth(organizer, "2026-11");
    expect(result.created).toBe(1);
    const keys = new Set((await monthRows("2026-11")).map((e) => e.generationKey));
    expect(keys.has(future.generationKey)).toBe(true);
    expect(keys.has(past.generationKey)).toBe(false);
    const after = (await loadEventRow(db, PAST_FP))!;
    expect(after.revision).toBe(before.revision);
    expect(after.status).toBe(before.status);
  });

  test("O3 jeden smazaný termín: obnoví jen ten, jako návrh, idempotentně i v souběhu", async () => {
    await generateMonth(organizer, MONTH);
    const one = (await draftOn(TUESDAY))!;
    const other = (await draftOn("2026-12-15"))!;
    await deleteDraft(organizer, one.id, one.revision);
    await deleteDraft(organizer, other.id, other.revision);
    const listed = (await listMonthDrafts(organizer, MONTH)).deleted;
    expect(listed.map((d) => d.dateKey)).toEqual([TUESDAY, "2026-12-15"]);
    const key = listed[0]!.key;

    const results = await Promise.all([
      generateMonth(organizer, MONTH, { restoreKey: key }),
      generateMonth(organizer, MONTH, { restoreKey: key }),
    ]);
    expect(results.reduce((sum, r) => sum + r.created, 0)).toBe(1);
    expect((await loadEventRow(await getDb(), (await draftOn(TUESDAY))!.id))!.status).toBe("draft");
    expect(await draftOn("2026-12-15")).toBeUndefined();
    const left = await listMonthDrafts(organizer, MONTH);
    expect(left.deletedSlots).toBe(1);
    expect(left.deleted.map((d) => d.dateKey)).toEqual(["2026-12-15"]);
    expect((await generateMonth(organizer, MONTH, { restoreKey: key })).created).toBe(0);
    await expectNoDuplicates();
  });

  test("O3 jeden termín: zrušenou akci, existující návrh ani cizí klíč nevrátí, účastník nesmí", async () => {
    await generateMonth(organizer, MONTH);
    const draft = (await draftOn(TUESDAY))!;
    const key = (await monthRows()).find((e) => e.id === draft.id)!.generationKey!;
    await publishDrafts(organizer, MONTH, [{ id: draft.id, revision: draft.revision, topicTitle: "Téma", leadId: "demo-vedouci" }]);
    const row = (await loadEventRow(await getDb(), draft.id))!;
    await cancelEvent(organizer, draft.id, row.revision, "Lektor onemocněl");
    expect((await generateMonth(organizer, MONTH, { restoreKey: key })).created).toBe(0);

    const existing = (await draftOn("2026-12-15"))!;
    const existingKey = (await monthRows()).find((e) => e.id === existing.id)!.generationKey!;
    expect((await generateMonth(organizer, MONTH, { restoreKey: existingKey })).created).toBe(0);
    expect((await generateMonth(organizer, MONTH, { restoreKey: "jina-org:slot-2:2026-12-22" })).created).toBe(0);
    await expect(generateMonth(participant, MONTH, { restoreKey: key })).rejects.toThrow();
    await expectNoDuplicates();
  });
});
