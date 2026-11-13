import { beforeEach, describe, expect, test } from "vitest";
import { czechHolidays } from "@/server/domain/generation";
import { decodeSession, encodeSession } from "@/server/auth/session";
import { listTopics, proposeTopic, setInterest } from "@/server/services/topics";
import { fromPragueLocal, monthWeeks, toDateKey, toTimeKey } from "@/lib/time";
import { lead, organizer, outsider, participant, resetDemo } from "./helpers";

describe("témata a zájem", () => {
  beforeEach(resetDemo);

  test("dva uživatelé zvýší zájem, stejný uživatel jen jednou", async () => {
    await setInterest(lead, "topic-questions", true);
    await setInterest(lead, "topic-questions", true);
    const topic = (await listTopics(participant)).find((t) => t.id === "topic-questions")!;
    expect(topic.interestCount).toBe(3);
    expect(topic.interestedByViewer).toBe(true);
  });

  test("doporučení odpovídá zájmu, historii a publiku", async () => {
    const forParticipant = await listTopics(participant);
    expect(forParticipant.map((t) => t.id)).toEqual(["topic-questions", "topic-priority", "topic-preparation"]);
    expect(forParticipant[0]!.reason).toBe("2 zájemci · zatím neproběhlo");
    expect(forParticipant.at(-1)!.reason).toContain("naplánováno na 26. 11.");
    expect((await listTopics(outsider)).some((t) => t.audience === "fp")).toBe(false);
    await expect(setInterest(outsider, "topic-questions", true)).rejects.toMatchObject({ code: "not_found" });
  });

  test("návrh tématu: jen do vlastní skupiny a bez duplicit", async () => {
    await proposeTopic(participant, "Nové téma", "fp");
    await expect(proposeTopic(participant, "nové TÉMA", "fp")).rejects.toMatchObject({ code: "duplicate" });
    await expect(proposeTopic(participant, "Cizí skupina", "rm")).rejects.toMatchObject({ code: "forbidden" });
    expect((await listTopics(organizer)).some((t) => t.name === "Nové téma" && t.interestCount === 1)).toBe(true);
  });
});

describe("čas a session", () => {
  test("pražský čas včetně letního času", () => {
    expect(fromPragueLocal("2026-11-12", "12:30").toISOString()).toBe("2026-11-12T11:30:00.000Z");
    expect(fromPragueLocal("2026-07-01", "08:30").toISOString()).toBe("2026-07-01T06:30:00.000Z");
    const d = new Date("2026-03-29T01:30:00Z");
    expect([toDateKey(d), toTimeKey(d)]).toEqual(["2026-03-29", "03:30"]);
  });

  test("týdny měsíce a svátky", () => {
    expect(monthWeeks("2026-11")[0]![0]).toBe("2026-10-26");
    expect(monthWeeks("2026-11").at(-1)![0]).toBe("2026-11-30");
    const holidays = czechHolidays(2026);
    expect(holidays.has("2026-04-03") && holidays.has("2026-04-06") && holidays.has("2026-11-17")).toBe(true);
  });

  test("podepsaná session odmítne podvrh a expiraci", () => {
    const token = encodeSession("demo-ucastnik", 1_000);
    expect(decodeSession(token, 1_001)).toBe("demo-ucastnik");
    expect(decodeSession(token, 1_000 + 13 * 3600)).toBeNull();
    const [data] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "demo-organizator", exp: 9e9 })).toString("base64url");
    expect(decodeSession(`${forged}.${token.split(".")[1]}`, 1_001)).toBeNull();
    expect(decodeSession(`${data}.x`, 1_001)).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
  });
});

describe("správa témat a mezery v plánu", () => {
  beforeEach(resetDemo);

  test("úprava a archivace: jen organizátor, bez duplicit, archiv mimo doporučení a vazba akcí zůstává", async () => {
    const { listArchivedTopics, setTopicArchived, topicIdByName, updateTopic } = await import("@/server/services/topics");
    await expect(updateTopic(participant, "topic-questions", "Jinak", "fp")).rejects.toMatchObject({ code: "forbidden" });
    await expect(setTopicArchived(lead, "topic-questions", true)).rejects.toMatchObject({ code: "forbidden" });
    await expect(updateTopic(organizer, "topic-questions", (await listTopics(organizer)).find((t) => t.id === "topic-priority")!.name, "fp")).rejects.toMatchObject({ code: "duplicate" });
    await updateTopic(organizer, "topic-questions", "Otázky jinak", "fp");
    expect((await listTopics(participant)).find((t) => t.id === "topic-questions")!.name).toBe("Otázky jinak");

    const db = await resetDemo();
    const { events } = await import("@/server/db/schema");
    const { isNotNull } = await import("drizzle-orm");
    const linkedBefore = await db.select({ id: events.id, topicId: events.topicId }).from(events).where(isNotNull(events.topicId));
    const linked = linkedBefore[0]!;
    const name = (await listTopics(organizer)).find((t) => t.id === linked.topicId)!.name;
    await setTopicArchived(organizer, linked.topicId!, true);
    expect((await listTopics(organizer)).some((t) => t.id === linked.topicId)).toBe(false);
    expect(await topicIdByName(db, name)).toBeNull();
    expect((await listArchivedTopics(organizer)).map((t) => t.id)).toEqual([linked.topicId]);
    expect(await listArchivedTopics(participant)).toEqual([]);
    await expect(setInterest(participant, linked.topicId!, true)).rejects.toMatchObject({ code: "not_found" });
    const linkedAfter = await db.select({ id: events.id, topicId: events.topicId }).from(events).where(isNotNull(events.topicId));
    expect(linkedAfter).toEqual(linkedBefore);
    await setTopicArchived(organizer, linked.topicId!, false);
    expect((await listTopics(organizer)).some((t) => t.id === linked.topicId)).toBe(true);
  });

  test("K doplnění: jen vybraný měsíc, bez svátků a zrušených", async () => {
    const { planGaps } = await import("@/features/vzdelavani/status");
    const { listMonth } = await import("@/server/services/events");
    const cards = await listMonth(organizer, "2026-11");
    const gaps = planGaps(cards, "2026-11");
    expect(gaps.length).toBeGreaterThan(0);
    for (const { card, reasons } of gaps) {
      expect(card.type).not.toBe("holiday");
      expect(card.planStatus).not.toBe("cancelled");
      expect(card.startsAt.slice(0, 7)).toBe("2026-11");
      expect(reasons.length).toBeGreaterThan(0);
      expect(!card.topicTitle || !card.leadName || card.syncStatus === "attention").toBe(true);
    }
    const complete = cards.filter((c) => c.topicTitle && c.leadName && c.syncStatus !== "attention");
    expect(gaps.some((g) => complete.includes(g.card))).toBe(false);
  });
});
