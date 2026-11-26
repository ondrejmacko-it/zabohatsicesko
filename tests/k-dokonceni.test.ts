import { beforeEach, describe, expect, it } from "vitest";
import { listMissingMinutes, listTasks } from "@/server/services/journey";
import { PAST_FP, admin, lead, resetDemo } from "./helpers";

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
