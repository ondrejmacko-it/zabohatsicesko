import { beforeEach, describe, expect, test } from "vitest";
import { getDb } from "@/server/db/client";
import { createEvent, listMonth, listMonthDrafts, listPeople, loadTemplate, nextEventsFor, type EventInput } from "@/server/services/events";
import { loadCalendarStatus } from "@/server/services/calendar-status";
import { listTasks } from "@/server/services/journey";
import { listPreviewOptions } from "@/server/services/preview";
import { listTopics } from "@/server/services/topics";
import { organizer, participant, resetDemo } from "./helpers";

beforeEach(resetDemo);

type Client = { query: (...args: unknown[]) => unknown; exec: (...args: unknown[]) => unknown };

/** Kolik dotazů do databáze proběhne během `task`. Počítá volání ovladače PGlite. */
async function countQueries(task: () => Promise<unknown>): Promise<number> {
  const client = ((await getDb()) as unknown as { $client: Client }).$client;
  const { query, exec } = client;
  let count = 0;
  client.query = (...args) => (count++, query.apply(client, args));
  client.exec = (...args) => (count++, exec.apply(client, args));
  try {
    await task();
  } finally {
    client.query = query;
    client.exec = exec;
  }
  return count;
}

/** Data, která Plán načítá (bez session), stejnou sadou volání jako stránka. */
const planData = (viewer: typeof organizer, managing: boolean) =>
  Promise.all([
    listMonth(viewer, "2026-11"),
    loadTemplate(),
    listTasks(viewer),
    managing ? listPeople(viewer) : [],
    managing ? listTopics(viewer) : [],
    managing ? listPreviewOptions(viewer) : null,
    managing ? loadCalendarStatus(viewer) : null,
    managing ? listMonthDrafts(viewer, "2026-11") : null,
  ]);

const extra = (date: string): EventInput => ({
  type: "workshop", label: "Workshop", date, endDate: null, startTime: "14:00", endTime: "16:00",
  topicTitle: null, topicId: null, audience: "vsichni", leadId: null, reviewerId: null,
});

// Rozpočet hlídá, aby počet dotazů nerostl s počtem akcí (N+1). Při změně stránky ho uprav vědomě.
describe("počet dotazů na Plánu a Úvodu", () => {
  test("Plán správce a účastníka a Úvod se vejdou do rozpočtu", async () => {
    // 17: úkol správce „Nastav garantovaná témata“ je jeden konstantní dotaz navíc (F2).
    expect(await countQueries(() => planData(organizer, true))).toBeLessThanOrEqual(17);
    expect(await countQueries(() => planData(participant, false))).toBeLessThanOrEqual(8);
    expect(await countQueries(() => nextEventsFor(participant, 3))).toBeLessThanOrEqual(5);
  });

  test("počet dotazů nezávisí na počtu akcí v měsíci", async () => {
    const before = await countQueries(() => planData(organizer, true));
    for (const day of ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"]) await createEvent(organizer, extra(day), "draft");
    expect(await countQueries(() => planData(organizer, true))).toBe(before);
  });
});
