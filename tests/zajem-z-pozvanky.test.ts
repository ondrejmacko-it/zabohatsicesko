import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { safeReturnPath, topicInterestPath } from "@/server/auth/return-path";
import { desiredData, syncEvent } from "@/server/calendar/sync";
import { getDb } from "@/server/db/client";
import { calendarLinks, simCalendarEvents, simCalendarNotifications } from "@/server/db/schema";
import { snapshotOf } from "@/server/domain/snapshot";
import { DomainError } from "@/server/services/errors";
import { createEvent, loadEventRow, updateEvent, type EventInput } from "@/server/services/events";
import { listTopics, proposeTopic, setInterest, setTopicArchived } from "@/server/services/topics";
import { PAST_FP, organizer, outsider, participant, resetDemo } from "./helpers";

const TOPIC_LINK = "/vzdelavani/temata?tema=";

const input = (topicId: string | null): EventInput => ({
  type: "workshop", label: "Workshop", date: "2026-12-10", endDate: null, startTime: "09:00", endTime: "10:00",
  topicTitle: "Téma z pozvánky", topicId, audience: "fp", leadId: "demo-vedouci", reviewerId: null,
});

const invite = async (eventId: string) => {
  const db = await getDb();
  const [link] = await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, eventId));
  const [external] = await db.select().from(simCalendarEvents).where(eq(simCalendarEvents.id, link!.externalEventId!));
  return external!;
};
const notifications = async () => (await (await getDb()).select().from(simCalendarNotifications)).length;

beforeEach(resetDemo);

describe("zájem o téma z pozvánky", () => {
  test("nová pozvánka budoucí akce s tématem nese odkaz na zájem, bez tématu ne", async () => {
    const topicId = await proposeTopic(organizer, "Téma z pozvánky", "fp");
    const withTopic = await createEvent(organizer, input(topicId), "publish");
    const without = await createEvent(organizer, { ...input(null), date: "2026-12-11" }, "publish");
    await syncEvent(withTopic);
    await syncEvent(without);
    expect((await invite(withTopic)).description).toContain(`${TOPIC_LINK}${topicId}`);
    expect((await invite(without)).description).not.toContain(TOPIC_LINK);
  });

  test("proběhlá ani zrušená akce odkaz na zájem nedostane", async () => {
    const past = (await loadEventRow(await getDb(), PAST_FP))!;
    const snapshot = { ...snapshotOf(past), topicId: "tema-x" };
    expect(desiredData(PAST_FP, snapshot, false).description).not.toContain(TOPIC_LINK);
    const future = { ...snapshot, startsAt: "2026-12-10T08:00:00.000Z", endsAt: "2026-12-10T09:00:00.000Z" };
    expect(desiredData(PAST_FP, future, false).description).toContain(`${TOPIC_LINK}tema-x`);
    expect(desiredData(PAST_FP, { ...future, status: "cancelled" }, false).description).not.toContain(TOPIC_LINK);
  });

  test("kvůli samotnému odkazu se starší pozvánka znovu nerozesílá, při skutečné změně ho dostane", async () => {
    const topicId = await proposeTopic(organizer, "Téma z pozvánky", "fp");
    const id = await createEvent(organizer, input(topicId), "publish");
    await syncEvent(id);
    const db = await getDb();
    // Pozvánka založená před zavedením odkazu: popis bez řádku se zájmem.
    const before = await invite(id);
    const legacy = before.description.split("\n").filter((line) => !line.includes(TOPIC_LINK)).join("\n");
    await db.update(simCalendarEvents).set({ description: legacy }).where(eq(simCalendarEvents.id, before.id));
    const sent = await notifications();

    // Nová synchronizace bez věcné změny: nic se neposílá a popis zůstává.
    await db.update(calendarLinks).set({ syncStatus: "pending" }).where(eq(calendarLinks.eventId, id));
    await syncEvent(id);
    expect((await invite(id)).description).toBe(legacy);
    expect(await notifications()).toBe(sent);

    // Skutečná změna termínu pozvánku stejně mění, odkaz se přidá s ní.
    await updateEvent(organizer, id, (await loadEventRow(db, id))!.revision, { ...input(topicId), startTime: "10:00", endTime: "11:00" }, "publish");
    await syncEvent(id);
    expect((await invite(id)).description).toContain(`${TOPIC_LINK}${topicId}`);
    expect(await notifications()).toBeGreaterThan(sent);
  });

  test("zájem zapíše jen přihlášený člen skupiny tématu, cizí a archivované téma odmítne", async () => {
    const topicId = await proposeTopic(organizer, "Jen pro FP", "fp");
    // Navrhovatel má zájem automaticky. Opakované kliknutí zájem účastníka nezdvojí.
    await setInterest(participant, topicId, true);
    await setInterest(participant, topicId, true);
    expect((await listTopics(participant)).find((t) => t.id === topicId)).toMatchObject({ interestCount: 2, interestedByViewer: true });
    // Skupina RM téma nevidí: odkaz z přeposlané pozvánky jí nic neprozradí ani nezapíše.
    expect((await listTopics(outsider)).some((t) => t.id === topicId)).toBe(false);
    await expect(setInterest(outsider, topicId, true)).rejects.toThrow(DomainError);
    await setTopicArchived(organizer, topicId, true);
    await expect(setInterest(participant, topicId, true)).rejects.toThrow(DomainError);
  });

  test("návrat po přihlášení vede jen dovnitř modulu Vzdělávání", () => {
    expect(topicInterestPath("tema-1")).toBe("/vzdelavani/zapisy?zajem=tema-1#temata");
    expect(topicInterestPath("../x")).toBe("/vzdelavani/zapisy#temata");
    expect(topicInterestPath("a b")).toBe("/vzdelavani/zapisy#temata");
    expect(topicInterestPath(null)).toBe("/vzdelavani/zapisy#temata");
    expect(safeReturnPath("/vzdelavani/zapisy?zajem=tema-1#temata")).toBe("/vzdelavani/zapisy?zajem=tema-1#temata");
    for (const bad of [
      undefined, "", "/", "/sprava", "/vzdelavanix", "//evil.example/vzdelavani", "/vzdelavani//evil.example",
      "https://evil.example/vzdelavani", "/vzdelavani\\evil", "/vzdelavani/@evil", `/vzdelavani/${"a".repeat(300)}`,
    ]) {
      expect(safeReturnPath(bad)).toBeNull();
    }
  });
});
