import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { syncPublished } from "@/server/calendar/sync";
import { getDb } from "@/server/db/client";
import { calendarLinks, eventRevisions } from "@/server/db/schema";
import { suggestionPending, topicFitsAudience } from "@/server/domain/topics";
import { generateMonth, listMonth, listMonthDrafts, loadEventRow, publishDrafts, type MonthDraft } from "@/server/services/events";
import { listTopics } from "@/server/services/topics";
import { organizer, participant, resetDemo } from "./helpers";

const MONTH = "2026-12";

describe("rozpracované doporučení tématu podle historie revizí", () => {
  const gen = (topicId: string | null) => ({ action: "generate", topicId });

  test("čeká jen téma z generování, které se od té doby nezměnilo a nebylo přijato", () => {
    expect(suggestionPending("t1", [gen("t1")])).toBe(true);
    expect(suggestionPending("t1", [gen("t1"), { action: "save", topicId: "t1" }])).toBe(true); // jiná úprava řádku
    expect(suggestionPending("t1", [gen("t1"), { action: "topic_accept", topicId: "t1" }])).toBe(false);
    expect(suggestionPending(null, [gen("t1"), { action: "topic_reject", topicId: null }])).toBe(false);
    expect(suggestionPending("t1", [{ action: "create", topicId: "t1" }])).toBe(false); // ručně založená akce
    expect(suggestionPending(null, [gen(null)])).toBe(false);
  });

  test("téma vrácené ručně po změně už je rozhodnutí správce, ne doporučení", () => {
    expect(suggestionPending("t1", [gen("t1"), { action: "save", topicId: "t2" }, { action: "save", topicId: "t1" }])).toBe(false);
  });
});

describe("doporučená témata v okně Připravit měsíc", () => {
  beforeEach(resetDemo);

  const suggestedDrafts = async () => (await listMonthDrafts(organizer, MONTH)).drafts.filter((d) => d.suggestion);
  const save = (d: MonthDraft, change: Partial<Parameters<typeof publishDrafts>[2][number]> = {}) =>
    publishDrafts(organizer, MONTH, [{ id: d.id, revision: d.revision, topicTitle: d.topicTitle, leadId: d.leadId, ...change }], 0, { publish: false });
  const actions = async (id: string) =>
    (await (await getDb()).select().from(eventRevisions).where(eq(eventRevisions.eventId, id))).map((r) => r.action);

  test("doporučí skutečná témata z DB pro správnou skupinu, bez duplicit, s vysvětlením", async () => {
    const { withTopic } = await generateMonth(organizer, MONTH);
    const suggested = await suggestedDrafts();
    expect(suggested.length).toBe(withTopic);
    expect(suggested.length).toBeGreaterThan(0);
    const topics = new Map((await listTopics(organizer)).map((t) => [t.name, t]));
    for (const d of suggested) {
      const topic = topics.get(d.topicTitle!);
      expect(topic, d.topicTitle!).toBeDefined();
      expect(["education-fp", "education-rm"]).toContain(d.type);
      expect(topicFitsAudience(topic!.audience, d.audience)).toBe(true);
      expect(topic!.interestCount).toBeGreaterThan(0);
      expect(d.suggestion).toBe(topic!.reason);
    }
    expect(new Set(suggested.map((d) => d.topicTitle)).size).toBe(suggested.length);
  });

  test("Přijmout: téma zůstane, doporučení zmizí, akce zůstane nezveřejněná a mimo Kalendář", async () => {
    await generateMonth(organizer, MONTH);
    const [d] = await suggestedDrafts();
    expect(await save(d!, { topicDecision: "accept" })).toEqual({ published: [d!.id], skipped: 0 });
    const row = (await loadEventRow(await getDb(), d!.id))!;
    expect(row).toMatchObject({ status: "draft", topicTitle: d!.topicTitle, published: null, revision: d!.revision + 1 });
    expect(await actions(d!.id)).toContain("topic_accept");
    const after = (await listMonthDrafts(organizer, MONTH)).drafts.find((x) => x.id === d!.id)!;
    expect(after.suggestion).toBeNull();
    expect(after.topicTitle).toBe(d!.topicTitle);
    await syncPublished();
    const links = await (await getDb()).select().from(calendarLinks).where(eq(calendarLinks.eventId, d!.id));
    expect(links).toEqual([]);
    expect((await listMonth(participant, MONTH)).some((c) => c.id === d!.id)).toBe(false);
  });

  test("Odmítnout: téma je prázdné a opakované generování ho nevrátí ani nezdvojí termín", async () => {
    await generateMonth(organizer, MONTH);
    const [d] = await suggestedDrafts();
    const before = (await listMonthDrafts(organizer, MONTH)).drafts.length;
    await save(d!, { topicDecision: "reject" });
    expect((await loadEventRow(await getDb(), d!.id))!).toMatchObject({ topicTitle: null, topicId: null, status: "draft" });
    expect(await actions(d!.id)).toContain("topic_reject");
    const again = await generateMonth(organizer, MONTH);
    expect(again.created).toBe(0);
    const drafts = (await listMonthDrafts(organizer, MONTH)).drafts;
    expect(drafts.length).toBe(before);
    const after = drafts.find((x) => x.id === d!.id)!;
    expect(after).toMatchObject({ topicTitle: null, suggestion: null });
  });

  test("Změnit: vlastní téma je rozhodnutí správce a generování ho nepřepíše", async () => {
    await generateMonth(organizer, MONTH);
    const [d, other] = await suggestedDrafts();
    await save(d!, { topicTitle: "Vlastní téma správce" });
    await generateMonth(organizer, MONTH);
    const after = (await listMonthDrafts(organizer, MONTH)).drafts.find((x) => x.id === d!.id)!;
    expect(after).toMatchObject({ topicTitle: "Vlastní téma správce", suggestion: null });
    // Jiná úprava řádku (vedoucí) o doporučení nerozhoduje, to dál čeká.
    await save(other!, { leadId: "demo-vedouci" });
    expect((await listMonthDrafts(organizer, MONTH)).drafts.find((x) => x.id === other!.id)!.suggestion).not.toBeNull();
  });

  test("rozhodnutí k přepsanému nebo už vyřízenému doporučení se nezapíše jako přijetí", async () => {
    await generateMonth(organizer, MONTH);
    const [d] = await suggestedDrafts();
    await save(d!, { topicTitle: "Jiné téma", topicDecision: "accept" });
    expect(await actions(d!.id)).not.toContain("topic_accept");
    const changed = (await listMonthDrafts(organizer, MONTH)).drafts.find((x) => x.id === d!.id)!;
    expect(await save(changed, { topicDecision: "reject" })).toEqual({ published: [], skipped: 0 });
    expect((await loadEventRow(await getDb(), d!.id))!.topicTitle).toBe("Jiné téma");
  });

  test("zveřejnění po přijetí zachová téma a zveřejní jen vybraný termín", async () => {
    await generateMonth(organizer, MONTH);
    const [d] = await suggestedDrafts();
    await save(d!, { topicDecision: "accept" });
    const accepted = (await listMonthDrafts(organizer, MONTH)).drafts.find((x) => x.id === d!.id)!;
    const result = await publishDrafts(organizer, MONTH, [{ id: accepted.id, revision: accepted.revision, topicTitle: accepted.topicTitle, leadId: "demo-vedouci" }]);
    expect(result.published).toEqual([d!.id]);
    expect((await loadEventRow(await getDb(), d!.id))!).toMatchObject({ status: "published", topicTitle: d!.topicTitle });
    expect((await listMonthDrafts(organizer, MONTH)).drafts.every((x) => x.id !== d!.id)).toBe(true);
  });
});
