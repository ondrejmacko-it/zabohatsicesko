import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { simulateResponses } from "@/server/calendar/simulated";
import { syncPublished } from "@/server/calendar/sync";
import { calendarLinks, simCalendarEvents } from "@/server/db/schema";
import { getEventDetail } from "@/server/services/detail";
import { getEventResponses, groupResponses, listResponses } from "@/server/services/responses";
import { writeSwitch } from "@/server/settings";
import { admin, lead, organizer, outsider, participant, PUBLISHED_RM, resetDemo } from "./helpers";

// Odpovědi na pozvánku (RSVP): vidí je jen správce a vedoucí akce, Wiki je jen čte.

const NOVEMBER = [new Date("2026-11-01T00:00:00+01:00"), new Date("2026-12-01T00:00:00+01:00")] as const;

describe("odpovědi z Kalendáře", () => {
  let db: Awaited<ReturnType<typeof resetDemo>>;
  beforeAll(async () => {
    db = await resetDemo();
  });

  test("seskupí hosty podle odpovědi a neznámou odpověď bere jako bez odpovědi", () => {
    const grouped = groupResponses([
      { email: "b@example.invalid", name: "Běta", responseStatus: "accepted" },
      { email: "a@example.invalid", name: "Áďa", responseStatus: "accepted" },
      { email: "c@example.invalid", name: "", responseStatus: "declined" },
      { email: "d@example.invalid", name: "Dan", responseStatus: "needsAction" },
      { email: "e@example.invalid", name: "Eva", responseStatus: "tentative" },
    ]);
    expect(grouped).toEqual({ total: 5, accepted: ["Áďa", "Běta"], tentative: ["Eva"], declined: ["c@example.invalid"], waiting: ["Dan"] });
  });

  test("správce (obě hodnoty role) a vedoucí akce odpovědi vidí, účastník ani člen mimo skupinu ne", async () => {
    for (const viewer of [admin, organizer, lead]) {
      const responses = await getEventResponses(viewer, PUBLISHED_RM);
      expect(responses).toMatchObject({ total: 1, accepted: ["Účastník RM"] });
    }
    // Člen mimo skupinu je publikem akce a sám přijal, odpovědi ostatních přesto nevidí.
    for (const viewer of [participant, outsider]) expect(await getEventResponses(viewer, PUBLISHED_RM)).toBeNull();
  });

  test("Plán dostane odpovědi jen k akcím, které uživatel smí vidět, a detail je vrací stejně", async () => {
    for (const viewer of [admin, lead]) expect(Object.keys(await listResponses(viewer, ...NOVEMBER))).toEqual([PUBLISHED_RM]);
    for (const viewer of [participant, outsider]) expect(await listResponses(viewer, ...NOVEMBER)).toEqual({});
    expect((await getEventDetail(admin, PUBLISHED_RM))?.responses?.accepted).toEqual(["Účastník RM"]);
    expect((await getEventDetail(lead, PUBLISHED_RM))?.responses?.accepted).toEqual(["Účastník RM"]);
    expect((await getEventDetail(outsider, PUBLISHED_RM))?.responses).toBeNull();
  });

  test("vedoucí vidí odpovědi jen u akcí, které sám vede", async () => {
    await syncPublished();
    const all = await listResponses(admin, ...NOVEMBER);
    expect(Object.keys(all).length).toBeGreaterThan(1);
    const [other] = await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, "ev-11-18")).limit(1);
    expect(other?.externalEventId).toBeTruthy();
    await simulateResponses(db, other!.externalEventId!);
    const after = (await listResponses(admin, ...NOVEMBER))["ev-11-18"]!;
    expect(after.accepted.length).toBe(Math.ceil(after.total / 2));
    const stranger = { ...lead, id: "demo-ucastnik" };
    expect(await getEventResponses(stranger, "ev-11-18")).toBeNull();
  });

  test("zrušená pozvánka a výpadek Kalendáře odpovědi neukážou a stránku neshodí", async () => {
    await db.update(simCalendarEvents).set({ status: "cancelled" }).where(eq(simCalendarEvents.id, "demo-existing-rm-1112"));
    expect(await getEventResponses(admin, PUBLISHED_RM)).toBeNull();
    await db.update(simCalendarEvents).set({ status: "confirmed" }).where(eq(simCalendarEvents.id, "demo-existing-rm-1112"));
    await writeSwitch(db, "calendar.outage", true);
    try {
      expect(await listResponses(admin, ...NOVEMBER)).toEqual({});
      expect(await getEventResponses(lead, PUBLISHED_RM)).toBeNull();
    } finally {
      await writeSwitch(db, "calendar.outage", false);
    }
  });
});
