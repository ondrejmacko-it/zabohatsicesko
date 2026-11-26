import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { events } from "@/server/db/schema";
import { listMissingMinutes, listTasks } from "@/server/services/journey";
import { PAST_FP, admin, lead, participant, resetDemo } from "./helpers";

beforeEach(resetDemo);

// F1: okno K dokončení dělí akce na vlastní úkoly a správcovský přehled stejně jako úkoly Plánu.
describe("K dokončení: moje úkoly", () => {
  it("vedoucímu patří jeho akce, správci ne", async () => {
    expect((await listMissingMinutes(lead)).items.find((i) => i.eventId === PAST_FP)?.mine).toBe(true);
    const all = await listMissingMinutes(admin);
    const item = all.items.find((i) => i.eventId === PAST_FP);
    expect(item).toMatchObject({ mine: false, canHandle: true });
  });

  it("každý zápisový úkol Plánu je v okně mezi mými", async () => {
    for (const viewer of [admin, lead]) {
      const mine = new Set((await listMissingMinutes(viewer)).items.filter((i) => i.mine).map((i) => i.eventId));
      const tasks = (await listTasks(viewer)).filter((t) => /^(zapis|nahravka)-/.test(t.key));
      for (const task of tasks) expect(mine.has(task.key.replace(/^(zapis|nahravka)-/, ""))).toBe(true);
    }
  });

  it("akce bez vedoucího je úkolem správce", async () => {
    const items = (await listMissingMinutes(admin)).items.filter((i) => !i.leadName);
    for (const item of items) expect(item.mine).toBe(true);
  });
});

// F4: Plán ukáže nejvýš 4 zápisové úkoly, zbytek nezmizí, ale vede souhrnným úkolem do okna K dokončení.
describe("Plán: další zápisy k dokončení", () => {
  it("nad limit přidá souhrnný úkol se zbývajícím počtem", async () => {
    const db = await getDb();
    await db.update(events).set({ published: sql`jsonb_set(${events.published}, '{leadId}', to_jsonb(${lead.id}::text))` }).where(sql`${events.published} is not null`);
    // Seed má jen 4 akce bez zápisu, dvě kopie proběhlé akce limit překročí.
    const [row] = await db.select().from(events).where(sql`${events.id} = ${PAST_FP}`);
    await db.insert(events).values([1, 2].map((n) => ({ ...row!, id: `${PAST_FP}-kopie-${n}`, generationKey: null })));
    const mine = (await listMissingMinutes(lead)).items.filter((i) => i.mine).length;
    expect(mine).toBeGreaterThan(4);
    const tasks = await listTasks(lead);
    expect(tasks.filter((t) => /^(zapis|nahravka)-/.test(t.key))).toHaveLength(4);
    expect(tasks.find((t) => t.key === "zapisy-dalsi")).toMatchObject({ title: `Další zápisy k dokončení: ${mine - 4}`, count: mine - 4, href: "/vzdelavani/zapisy?pridat=1" });
  });

  it("pod limitem souhrnný úkol chybí", async () => {
    expect((await listTasks(participant)).some((t) => t.key === "zapisy-dalsi")).toBe(false);
  });
});
