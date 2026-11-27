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
  placeInSections,
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
  placeTopic,
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

  test("nově garantované téma jde na konec, počet není omezený", () => {
    expect(nextFreePriority([])).toBe(1);
    expect(nextFreePriority([{ priorityRank: 1 }, { priorityRank: 2 }, { priorityRank: 3 }])).toBe(4);
    expect(nextFreePriority([{ priorityRank: null }, { priorityRank: 9 }])).toBe(10);
  });

  test("přesun mezi sekcemi: jen jedno místo, ostatní drží vzájemné pořadí", () => {
    const order = { guaranteed: ["g1", "g2"], others: ["o1", "o2", "o3"] };
    expect(placeInSections(order, "o3", "guaranteed", 0)).toEqual({ guaranteed: ["o3", "g1", "g2"], others: ["o1", "o2"] });
    expect(placeInSections(order, "g1", "other", 1)).toEqual({ guaranteed: ["g2"], others: ["o1", "g1", "o2", "o3"] });
    expect(placeInSections(order, "o3", "other", 0)).toEqual({ guaranteed: ["g1", "g2"], others: ["o3", "o1", "o2"] });
    expect(placeInSections(order, "o1", "other", 99)).toEqual({ guaranteed: ["g1", "g2"], others: ["o2", "o3", "o1"] });
    expect(placeInSections({ guaranteed: [], others: ["o1"] }, "o1", "guaranteed", 5)).toEqual({ guaranteed: ["o1"], others: [] });
    expect(placeInSections(order, "g2", "guaranteed", 1)).toBeNull();
    expect(placeInSections(order, "x", "other", 0)).toBeNull();
  });

  test("přetažení jedním krokem z libovolné pozice na libovolnou v seznamech 1, 3, 10 a 25 témat", () => {
    for (const size of [1, 3, 10, 25]) {
      const others = Array.from({ length: size }, (_, i) => `o${i}`);
      const order = { guaranteed: ["g1"], others };
      for (let from = 0; from < size; from++) {
        for (let to = 0; to < size; to++) {
          const next = placeInSections(order, `o${from}`, "other", to);
          if (from === to) {
            expect(next).toBeNull();
            continue;
          }
          expect(next!.others.indexOf(`o${from}`)).toBe(to);
          expect(next!.others.filter((id) => id !== `o${from}`)).toEqual(others.filter((id) => id !== `o${from}`));
          expect(next!.guaranteed).toEqual(["g1"]);
        }
        // Do garantovaných na začátek i konec, ostatní drží vzájemné pořadí.
        expect(placeInSections(order, `o${from}`, "guaranteed", 0)!.guaranteed).toEqual([`o${from}`, "g1"]);
        expect(placeInSections(order, `o${from}`, "guaranteed", 1)!.guaranteed).toEqual(["g1", `o${from}`]);
      }
    }
  });

  test("doporučení: garantované s vysokým pořadím předběhne téma s velkým zájmem", () => {
    const ranked = [topic("zajem", { interestCount: 50 }), topic("garant-7", { interestCount: 0, priorityRank: 7 }), topic("garant-2", { interestCount: 0, priorityRank: 2 })];
    expect(recommendTopics(ranked, "fp").map((t) => t.id)).toEqual(["garant-2", "garant-7", "zajem"]);
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
    expect(candidates[0]!.draft).toBe(true);
    expect(candidates.at(-1)!.draft).toBe(false);
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

  test("libovolný počet garantovaných, zrušení pořadí sesype, opakované nastavení nic nemění", async () => {
    await setTopicPriority(organizer, "topic-priority", true);
    expect((await ranks())["topic-priority"]?.priority).toBe(3);
    expect(await code(setTopicPriority(organizer, "topic-preparation", true))).toBe("ok");
    expect((await ranks())["topic-preparation"]?.priority).toBe(4);
    expect(await code(setTopicPriority(organizer, "topic-priority", true))).toBe("ok");
    await setTopicPriority(organizer, "topic-questions", false);
    const state = await ranks();
    expect([state["topic-rm"]?.priority, state["topic-priority"]?.priority, state["topic-preparation"]?.priority, state["topic-questions"]?.priority]).toEqual([1, 2, 3, null]);
    const db = await getDb();
    const logs = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "topic"), eq(auditLog.entityId, "topic-questions")));
    expect(logs.map((l) => l.action)).toContain("topic.priority_clear");
  });

  test("souběžné nastavení dvou garantovaných dá různá pořadí", async () => {
    const results = await Promise.all([
      code(setTopicPriority(organizer, "topic-priority", true)),
      code(setTopicPriority(organizer, "topic-preparation", true)),
    ]);
    expect(results).toEqual(["ok", "ok"]);
    const state = await ranks();
    expect([state["topic-priority"]?.priority, state["topic-preparation"]?.priority].sort()).toEqual([3, 4]);
  });

  test("přetažení mezi sekcemi: atomicky, bez kopie, s auditem a kontrolou souběhu", async () => {
    const list = async () => {
      const all = await listTopics(organizer);
      return { guaranteed: guaranteedTopics(all).map((t) => t.id), others: otherTopics(all).map((t) => t.id) };
    };
    const before = await list();
    const count = (await listTopics(organizer)).length;
    // Ostatní téma na první garantované místo.
    await placeTopic(organizer, "topic-priority", "guaranteed", 0, before);
    let after = await list();
    expect(after.guaranteed).toEqual(["topic-priority", ...before.guaranteed]);
    expect(after.others).toEqual(before.others.filter((id) => id !== "topic-priority"));
    expect((await listTopics(organizer)).length).toBe(count);
    // Zastaralé pořadí: conflict, nic se nezmění.
    expect(await code(placeTopic(organizer, "topic-rm", "other", 0, before))).toBe("conflict");
    expect(await list()).toEqual(after);
    // Garantované mezi ostatní na druhé místo: priorita zmizí, ostatní dostanou ruční pořadí.
    const snapshot = after;
    await placeTopic(organizer, "topic-questions", "other", 1, snapshot);
    after = await list();
    expect(after.guaranteed).toEqual(snapshot.guaranteed.filter((id) => id !== "topic-questions"));
    expect(after.others[1]).toBe("topic-questions");
    expect(after.others.filter((id) => id !== "topic-questions")).toEqual(snapshot.others);
    const state = await ranks();
    expect(state["topic-questions"]?.priority).toBeNull();
    expect(after.guaranteed.map((id) => state[id]?.priority)).toEqual(after.guaranteed.map((_, i) => i + 1));
    const db = await getDb();
    const logs = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "topic"), eq(auditLog.entityId, "topic-questions")));
    expect(logs.map((l) => l.action)).toContain("topic.priority_clear");
    // Člen týmu pořadí měnit nesmí.
    expect(await code(placeTopic(lead, "topic-rm", "other", 0))).toBe("forbidden");
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
    // Po migraci 0015 platí jen kladné pořadí, horní mez už není.
    await expect(db.update(topics).set({ priorityRank: 0 }).where(eq(topics.id, "topic-priority"))).rejects.toThrow();
    await db.update(topics).set({ priorityRank: 40 }).where(eq(topics.id, "topic-priority"));
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
