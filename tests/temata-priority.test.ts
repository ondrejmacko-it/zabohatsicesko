import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { getDb } from "@/server/db/client";
import { auditLog, topics } from "@/server/db/schema";
import {
  guaranteedTopics,
  hasManualOrder,
  isRecommendable,
  moveInOrder,
  nextFreePriority,
  otherTopics,
  planCandidates,
  recommendTopics,
  suggestTopics,
  type PlanEvent,
  type RankedTopic,
} from "@/server/domain/topics";
import { topicFormValues } from "@/server/services/detail";
import { DomainError } from "@/server/services/errors";
import { assignTopicToDraft, loadEventRow } from "@/server/services/events";
import { listTasks } from "@/server/services/journey";
import {
  listTopics,
  moveTopic,
  resetTopicOrder,
  setTopicArchived,
  setTopicPriority,
  topicPlanOptions,
} from "@/server/services/topics";
import { admin, lead, organizer, participant, resetDemo } from "./helpers";

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => "ok",
    (error: unknown) => (error instanceof DomainError ? error.code : String(error)),
  );

const topic = (id: string, over: Partial<RankedTopic> = {}): RankedTopic => ({
  id,
  name: id,
  audience: "fp",
  interestCount: 1,
  interestedByViewer: false,
  lastHeld: null,
  nextPlanned: null,
  reason: "",
  ...over,
});

const ranks = async () =>
  Object.fromEntries((await listTopics(organizer)).map((t) => [t.id, { priority: t.priorityRank ?? null, manual: t.manualRank ?? null }]));

describe("garantovaná témata a ruční pořadí: pravidla", () => {
  test("garantovaná podle priority, ostatní ručně a pak podle zájmu", () => {
    const list = [
      topic("a", { interestCount: 5 }),
      topic("b", { priorityRank: 2 }),
      topic("c", { priorityRank: 1, interestCount: 0 }),
      topic("d", { manualRank: 1, interestCount: 0 }),
      topic("e", { interestCount: 3 }),
    ];
    expect(guaranteedTopics(list).map((t) => t.id)).toEqual(["c", "b"]);
    expect(otherTopics(list).map((t) => t.id)).toEqual(["d", "a", "e"]);
    expect(hasManualOrder(list)).toBe(true);
    expect(hasManualOrder([topic("x", { priorityRank: 1, manualRank: 4 })])).toBe(false);
  });

  test("volné pořadí je nejnižší neobsazené, nejvýš tři", () => {
    expect(nextFreePriority([])).toBe(1);
    expect(nextFreePriority([{ priorityRank: 1 }, { priorityRank: 3 }])).toBe(2);
    expect(nextFreePriority([{ priorityRank: 1 }, { priorityRank: 2 }, { priorityRank: 3 }])).toBeNull();
  });

  test("posun vymění se sousedem, na kraji nic nedělá", () => {
    expect(moveInOrder(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
    expect(moveInOrder(["a", "b"], "a", "up")).toBeNull();
    expect(moveInOrder(["a", "b"], "b", "down")).toBeNull();
    expect(moveInOrder(["a"], "x", "up")).toBeNull();
    // Přetažení na pozici: přesune, ne vymění; mimo rozsah se ořízne, stejné místo = nic.
    expect(moveInOrder(["a", "b", "c", "d"], "a", 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveInOrder(["a", "b", "c", "d"], "d", 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveInOrder(["a", "b", "c"], "a", 99)).toEqual(["b", "c", "a"]);
    expect(moveInOrder(["a", "b", "c"], "b", 1)).toBeNull();
  });
});

describe("doporučení témat", () => {
  test("garantované téma jde doporučit i bez zájemců, naplánované nikdy", () => {
    expect(isRecommendable(topic("a", { interestCount: 0, priorityRank: 1 }))).toBe(true);
    expect(isRecommendable(topic("b", { interestCount: 0 }))).toBe(false);
    expect(isRecommendable(topic("c", { priorityRank: 1, nextPlanned: "2026-12-01" }))).toBe(false);
  });

  test("pořadí: priorita odpovídající skupině, pak skupina, pak zájem (pořadí vstupu)", () => {
    const list = [
      topic("vsichni-zajem", { audience: "vsichni", interestCount: 9 }),
      topic("fp-zajem", { interestCount: 2 }),
      topic("rm-garant", { audience: "rm", priorityRank: 1 }),
      topic("vsichni-garant", { audience: "vsichni", priorityRank: 3, interestCount: 0 }),
      topic("fp-garant", { priorityRank: 2 }),
    ];
    expect(recommendTopics(list, "fp").map((t) => t.id)).toEqual(["fp-garant", "vsichni-garant", "fp-zajem", "vsichni-zajem"]);
    expect(recommendTopics(list, "rm").map((t) => t.id)).toEqual(["rm-garant", "vsichni-garant", "vsichni-zajem"]);
  });

  test("doplnění měsíce preferuje garantovaná témata", () => {
    const slots = [
      { generationKey: "s1", type: "education-fp" as const, audience: "fp" },
      { generationKey: "s2", type: "education-fp" as const, audience: "fp" },
    ];
    const ranked = [topic("zajem", { interestCount: 7 }), topic("garant", { interestCount: 0, priorityRank: 1 })];
    const result = suggestTopics(slots, ranked, new Set());
    expect(result.get("s1")?.id).toBe("garant");
    expect(result.get("s2")?.id).toBe("zajem");
    // Už naplánované garantované téma se znovu nepoužije.
    expect(suggestTopics(slots.slice(0, 1), ranked, new Set(["garant"])).get("s1")?.id).toBe("zajem");
  });
});

describe("Naplánovat téma: výběr akcí", () => {
  const at = (day: number) => new Date(`2026-12-${String(day).padStart(2, "0")}T09:00:00+01:00`);
  const ev = (id: string, day: number, over: Partial<PlanEvent> = {}): PlanEvent => ({
    id,
    revision: 1,
    type: "education-fp",
    label: id,
    audience: "fp",
    status: "draft",
    startsAt: at(day),
    topicId: null,
    topicTitle: null,
    ...over,
  });

  test("návrh bez tématu se stejnou skupinou a typem z témat má přednost, s vysvětlením", () => {
    const { candidates, scheduled } = planCandidates({ id: "t", audience: "fp" }, [
      ev("zverejnena", 1, { status: "published" }),
      ev("trenink", 2, { type: "training-fp" }),
      ev("pozdejsi", 9),
      ev("drivejsi", 4),
      ev("jina-skupina", 3, { audience: "rm" }),
      ev("s-tematem", 3, { topicTitle: "Jiné", topicId: "x" }),
      ev("zrusena", 3, { status: "cancelled" }),
      ev("svatek", 3, { type: "holiday" }),
    ]);
    expect(candidates.map((c) => c.id)).toEqual(["drivejsi", "pozdejsi", "trenink", "zverejnena"]);
    expect(candidates[0]!.reason).toBe("návrh");
    expect(candidates.at(-1)!.reason).toBe("zveřejněno, změnu potvrdíte");
    expect(scheduled).toBeNull();
  });

  test("téma pro všechny se hodí ke každé skupině, termín s tématem se ukáže", () => {
    const { candidates, scheduled } = planCandidates({ id: "t", audience: "vsichni" }, [
      ev("rm", 2, { audience: "rm" }),
      ev("ma-tema", 5, { topicId: "t", topicTitle: "T", status: "published" }),
    ]);
    expect(candidates.map((c) => c.id)).toEqual(["rm"]);
    expect(candidates[0]!.reason).toContain("téma je pro všechny");
    expect(scheduled?.id).toBe("ma-tema");
  });
});

describe("garantovaná témata a pořadí: služby", () => {
  beforeEach(resetDemo);

  test("ukázková data mají dvě garantovaná témata", async () => {
    const state = await ranks();
    expect(state["topic-questions"]?.priority).toBe(1);
    expect(state["topic-rm"]?.priority).toBe(2);
  });

  test("bez role správce nejde prioritu, pořadí ani plánování tématu měnit", async () => {
    for (const viewer of [lead, participant]) {
      expect(await code(setTopicPriority(viewer, "topic-priority", true))).toBe("forbidden");
      expect(await code(moveTopic(viewer, "topic-priority", "up"))).toBe("forbidden");
      expect(await code(resetTopicOrder(viewer))).toBe("forbidden");
      expect(await code(topicPlanOptions(viewer, "topic-questions"))).toBe("forbidden");
      expect(await code(assignTopicToDraft(viewer, "topic-questions", "ev-11-27", 1))).toBe("forbidden");
      expect(await code(topicFormValues(viewer, "topic-questions", "2026-11-12"))).toBe("forbidden");
    }
    // Obě hodnoty role správce (starší `organizer` i `admin`) smějí.
    expect(await code(setTopicPriority(admin, "topic-priority", true))).toBe("ok");
  });

  test("nejvýš tři garantovaná, zrušení pořadí sesype, opakované nastavení nic nemění", async () => {
    await setTopicPriority(organizer, "topic-priority", true);
    expect((await ranks())["topic-priority"]?.priority).toBe(3);
    expect(await code(setTopicPriority(organizer, "topic-preparation", true))).toBe("priority_full");
    expect(await code(setTopicPriority(organizer, "topic-priority", true))).toBe("ok");
    await setTopicPriority(organizer, "topic-questions", false);
    const state = await ranks();
    expect([state["topic-rm"]?.priority, state["topic-priority"]?.priority, state["topic-questions"]?.priority]).toEqual([1, 2, null]);
    const db = await getDb();
    const logs = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "topic"), eq(auditLog.entityId, "topic-questions")));
    expect(logs.map((l) => l.action)).toContain("topic.priority_clear");
  });

  test("souběžné nastavení posledního volného pořadí projde jen jednou", async () => {
    const results = await Promise.all([
      code(setTopicPriority(organizer, "topic-priority", true)),
      code(setTopicPriority(organizer, "topic-preparation", true)),
    ]);
    expect(results.sort()).toEqual(["ok", "priority_full"]);
  });

  test("přetažení na pozici: garantovaná drží čísla priorit, souběh se odmítne bez zápisu", async () => {
    const before = await ranks();
    // Druhé garantované na první místo: priority se jen přeskupí.
    await moveTopic(organizer, "topic-rm", 0, ["topic-questions", "topic-rm"]);
    const state = await ranks();
    expect([state["topic-rm"]?.priority, state["topic-questions"]?.priority]).toEqual([before["topic-questions"]?.priority, before["topic-rm"]?.priority]);
    // Zastaralé pořadí (správce viděl jiné) → conflict, nic se nezmění.
    expect(await code(moveTopic(organizer, "topic-rm", 1, ["topic-questions", "topic-rm"]))).toBe("conflict");
    expect(await ranks()).toEqual(state);
    // Přetažením se nedá změnit skupina: ostatní téma zůstane bez priority.
    await moveTopic(organizer, "topic-priority", 0);
    expect((await ranks())["topic-priority"]?.priority ?? null).toBeNull();
  });

  test("unikátní index nedovolí stejné pořadí dvěma nearchivovaným tématům", async () => {
    const db = await getDb();
    await expect(db.update(topics).set({ priorityRank: 1 }).where(eq(topics.id, "topic-priority"))).rejects.toThrow();
    await expect(db.update(topics).set({ priorityRank: 4 }).where(eq(topics.id, "topic-priority"))).rejects.toThrow();
  });

  test("posun garantovaného vymění prioritu, posun ostatního uloží ruční pořadí", async () => {
    await moveTopic(organizer, "topic-rm", "up");
    let state = await ranks();
    expect([state["topic-rm"]?.priority, state["topic-questions"]?.priority]).toEqual([1, 2]);
    // Ostatní podle zájmu: obě mají jednoho zájemce, abecedně Příprava… před Týmové priority.
    const before = otherTopics(await listTopics(organizer)).map((t) => t.id);
    expect(before).toEqual(["topic-preparation", "topic-priority"]);
    await moveTopic(organizer, "topic-priority", "up");
    const after = await listTopics(organizer);
    expect(otherTopics(after).map((t) => t.id)).toEqual(["topic-priority", "topic-preparation"]);
    expect(hasManualOrder(after)).toBe(true);
    // Na kraji se nic nemění.
    await moveTopic(organizer, "topic-priority", "up");
    expect(otherTopics(await listTopics(organizer)).map((t) => t.id)).toEqual(["topic-priority", "topic-preparation"]);
    await resetTopicOrder(organizer);
    state = await ranks();
    expect(state["topic-priority"]?.manual).toBeNull();
    expect(hasManualOrder(await listTopics(organizer))).toBe(false);
  });

  test("archivace zruší prioritu a sesype pořadí, obnovené téma není garantované", async () => {
    await setTopicArchived(organizer, "topic-questions", true);
    expect((await ranks())["topic-rm"]?.priority).toBe(1);
    await setTopicArchived(organizer, "topic-questions", false);
    expect((await ranks())["topic-questions"]?.priority).toBeNull();
  });

  test("bez garantovaných témat má správce úkol, ostatní ne", async () => {
    const key = async (viewer: typeof organizer) => (await listTasks(viewer)).some((t) => t.key === "garantovana-temata");
    expect(await key(organizer)).toBe(false);
    await setTopicPriority(organizer, "topic-questions", false);
    await setTopicPriority(organizer, "topic-rm", false);
    expect(await key(organizer)).toBe(true);
    expect(await key(lead)).toBe(false);
  });
});

describe("Naplánovat téma: služby", () => {
  beforeEach(resetDemo);

  test("nabídne návrhy firemního vzdělávání FP bez tématu jako první", async () => {
    const options = await topicPlanOptions(organizer, "topic-questions");
    expect(options.candidates.slice(0, 2).map((c) => c.id)).toEqual(["ev-11-13", "ev-11-27"]);
    expect(options.candidates.every((c) => c.audience === "fp" || c.audience === "vsichni")).toBe(true);
    expect(options.scheduled).toBeNull();
    expect(await code(topicPlanOptions(organizer, "neexistuje"))).toBe("not_found");
  });

  test("přiřazení k návrhu uloží jen návrh a téma pak má budoucí termín", async () => {
    const before = (await loadEventRow(await getDb(), "ev-11-27"))!;
    const result = await assignTopicToDraft(organizer, "topic-questions", "ev-11-27", before.revision);
    expect(result).toEqual({ dateKey: "2026-11-27", topicName: "Otevřené otázky na schůzce" });
    const row = (await loadEventRow(await getDb(), "ev-11-27"))!;
    expect([row.status, row.published, row.topicId, row.topicTitle]).toEqual(["draft", null, "topic-questions", "Otevřené otázky na schůzce"]);
    expect(row.startsAt.getTime()).toBe(before.startsAt.getTime());
    expect(row.endsAt.getTime()).toBe(before.endsAt.getTime());
    const options = await topicPlanOptions(organizer, "topic-questions");
    expect(options.scheduled).toMatchObject({ id: "ev-11-27", dateKey: "2026-11-27", draft: true });
    // Starou revizí ani podruhé (návrh už téma má) to nejde.
    expect(await code(assignTopicToDraft(organizer, "topic-priority", "ev-11-27", before.revision))).toBe("conflict");
  });

  test("zveřejněnou akci, jinou skupinu ani archivované téma takto přiřadit nejde", async () => {
    const draft = (await loadEventRow(await getDb(), "ev-11-27"))!;
    expect(await code(assignTopicToDraft(organizer, "topic-questions", "ev-11-24", 1))).toBe("invalid_state");
    expect(await code(assignTopicToDraft(organizer, "topic-rm", "ev-11-27", draft.revision))).toBe("invalid_state");
    expect(await code(assignTopicToDraft(organizer, "topic-questions", "ev-11-17", 1))).toBe("holiday_locked");
    await setTopicArchived(organizer, "topic-questions", true);
    expect(await code(assignTopicToDraft(organizer, "topic-questions", "ev-11-27", draft.revision))).toBe("not_found");
  });

  test("nová akce k tématu: typ, skupina a nejbližší den šablony", async () => {
    expect(await topicFormValues(organizer, "topic-questions", "2026-11-12")).toMatchObject({
      type: "education-fp",
      label: "Firemní vzdělávání FP",
      date: "2026-11-13",
      startTime: "08:30",
      endTime: "10:30",
      topicTitle: "Otevřené otázky na schůzce",
      audience: "fp",
    });
    expect(await topicFormValues(organizer, "topic-priority", "2026-11-12")).toMatchObject({ type: "other", label: "", date: "2026-11-13", audience: "vsichni" });
    expect(await topicFormValues(organizer, "neexistuje", "2026-11-12")).toBeNull();
  });
});
