import { and, eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ParticipationState } from "@/lib/types";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBadge } from "@/features/vzdelavani/components/StatusBadge";
import { matchesAttendance, primaryStatus } from "@/features/vzdelavani/status";
import { config, now } from "@/server/config";
import { getDb } from "@/server/db/client";
import { events, users } from "@/server/db/schema";
import { ownParticipationView, type Participation } from "@/server/domain/participation";
import { listMonth } from "@/server/services/events";
import { ownParticipationDetail, withOwnParticipation } from "@/server/services/participation";
import type { Viewer } from "@/server/policy";
import { PAST_FP, lead, organizer, outsider, participant, resetDemo } from "./helpers";

// Audit 23. 11. 2026 (§5 a §6): filtr Moje, viditelnost v rollbacku, štítky bez přihlášek a tón štítků.

beforeEach(resetDemo);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const view = (state: ParticipationState, required = state === "required" || state === "excused") => ({ state, required, label: null, actions: [] });
const card = (patch: Partial<Parameters<typeof matchesAttendance>[0]>) => ({ type: "training-fp" as const, participation: null, leadsOrReviews: false, ...patch });

async function futurePublishedId(audience: string): Promise<string> {
  const [row] = await (await getDb())
    .select({ id: events.id })
    .from(events)
    .where(and(sql`${events.published}->>'audience' = ${audience}`, sql`${events.published}->>'status' = 'published'`, sql`(${events.published}->>'startsAt')::timestamptz > ${now().toISOString()}::timestamptz`, sql`${events.type} <> 'holiday'`))
    .limit(1);
  return row!.id;
}

describe("filtr účasti ucast=", () => {
  test("Moje u správce: právo obsluhovat všechny akce z cizí akce Moje nedělá", async () => {
    const cards = await listMonth(organizer, "2026-11");
    const foreign = cards.filter((c) => c.planStatus === "published" && c.type !== "holiday" && c.handler && !c.leadsOrReviews);
    // Správce smí obsluhovat nahrávku každé zveřejněné akce, ale vede jen některé.
    expect(foreign.length).toBeGreaterThan(0);
    for (const c of foreign) expect(matchesAttendance({ ...c, participation: view("optional") }, "moje")).toBe(false);
    // Vedoucí akce ji v Moje má, i když pro něj není povinná.
    const led = (await listMonth(lead, "2026-11")).find((c) => c.id === PAST_FP);
    expect(led).toMatchObject({ leadsOrReviews: true });
    expect(matchesAttendance({ ...led!, participation: view("optional") }, "moje")).toBe(true);
  });

  test("Moje na Úvodu i v Plánu u správce bez vlastní účasti nezahrnuje všechny akce", async () => {
    // Správce bez pracovních rolí: povinné má jen akce pro Všechny.
    await (await getDb()).update(users).set({ groups: [] }).where(eq(users.id, organizer.id));
    const session: Viewer = { ...organizer, groups: [] };
    const cards = await withOwnParticipation(session, null, await listMonth(session, "2026-11"));
    const published = cards.filter((c) => c.planStatus === "published" && c.type !== "holiday");
    const mine = published.filter((c) => matchesAttendance(c, "moje"));
    expect(mine.length).toBeLessThan(published.length);
    for (const c of mine) expect(c.leadsOrReviews || c.participation?.state === "required").toBe(true);
  });

  test("Povinné, Dobrovolné, Moje a Všechny podle stavu; svátek zůstává", () => {
    const states: ParticipationState[] = ["required", "excused", "optional", "voluntary_enrolled", "withdrawn", "cancelled"];
    const pick = (filter: Parameters<typeof matchesAttendance>[1]) => states.filter((s) => matchesAttendance(card({ participation: view(s) }), filter));
    expect(pick("povinne")).toEqual(["required", "excused"]);
    expect(pick("dobrovolne")).toEqual(["optional", "voluntary_enrolled", "withdrawn"]);
    expect(pick("moje")).toEqual(["required", "excused", "voluntary_enrolled"]);
    expect(pick(undefined)).toEqual(states);
    // U09: zrušená akce, která byla povinná, zůstává v Povinné i Moje; zrušená nepovinná jen ve Všechny.
    const cancelledRequired = card({ participation: view("cancelled", true) });
    expect(["povinne", "moje", undefined].map((f) => matchesAttendance(cancelledRequired, f as never))).toEqual([true, true, true]);
    expect(matchesAttendance(cancelledRequired, "dobrovolne")).toBe(false);
    // Návrh bez zveřejněné verze nemá účast: do filtrů účasti nepatří.
    expect(matchesAttendance(card({ participation: null }), "povinne")).toBe(false);
    expect(matchesAttendance(card({ participation: null }), "dobrovolne")).toBe(false);
    for (const filter of ["povinne", "dobrovolne", "moje"] as const) expect(matchesAttendance(card({ type: "holiday" }), filter)).toBe(true);
  });
});

describe("viditelnost: rollback EVENT_VISIBILITY=audience", () => {
  test("akce pro Všechny je vidět i účtu bez uloženého `vsichni`; cizí skupina ne", async () => {
    vi.stubEnv("EVENT_VISIBILITY", "audience");
    const everyone = await futurePublishedId("vsichni");
    const rm = await futurePublishedId("rm");
    const fpOnly: Viewer = { id: "demo-bez-vsichni", role: "member", groups: ["fp"] };
    const ids = (await listMonth(fpOnly, "2026-11")).concat(await listMonth(fpOnly, "2026-12")).map((c) => c.id);
    expect(ids).toContain(everyone);
    expect(ids).not.toContain(rm);
  });
});

describe("štítky bez zapnutých přihlášek (PARTICIPATION vypnuté, i ostrá Wiki)", () => {
  const optional: Participation = { state: "optional", required: false, calendarGuest: false, open: true };

  test("nepovinná akce neslibuje přihlášení v měsíci ani v detailu", () => {
    expect(ownParticipationView(optional, { readOnly: true, enrollment: false })).toMatchObject({ label: "Dobrovolné", actions: [] });
    expect(ownParticipationView(optional, { readOnly: false })).toMatchObject({ label: "Můžeš se přihlásit", actions: ["enroll"] });
  });

  test("proběhlá nepovinná akce nenabízí přihlášení ani štítkem", () => {
    expect(ownParticipationView({ ...optional, open: false }, { readOnly: false })).toMatchObject({ label: "Dobrovolné", actions: [] });
    expect(ownParticipationView({ ...optional, state: "withdrawn", open: false }, { readOnly: false })).toMatchObject({ label: "Odhlášeno", actions: [] });
  });

  for (const mode of ["demo", "production"] as const) {
    test(`náhled skupiny (${mode}): detail i karta mají stejný štítek „Dobrovolné“`, async () => {
      // Bez PARTICIPATION=on jsou přihlášky vypnuté v ukázce i v ostré Wiki.
      vi.stubEnv("WIKI_MODE", mode);
      vi.stubEnv("PARTICIPATION", "");
      // Ostrá Wiki jede podle skutečných hodin: bez zastavení času na referenčním dni seedu by test
      // časem nenašel budoucí akci RM v listopadu a prosinci 2026. Falešné je jen Date, timery DB běží.
      vi.useFakeTimers({ toFake: ["Date"], now: config.referenceNow });
      const rm = await futurePublishedId("rm");
      const preview = { viewer: { ...participant, id: "nahled-skupiny" }, label: "Skupina FP" };
      const detail = await ownParticipationDetail(organizer, preview, rm);
      expect(detail).toMatchObject({ state: "optional", label: "Dobrovolné", actions: [] });
      const months = [...(await listMonth(participant, "2026-11")), ...(await listMonth(participant, "2026-12"))];
      const cards = await withOwnParticipation(organizer, preview, months);
      expect(cards.find((c) => c.id === rm)?.participation).toMatchObject({ state: "optional", label: "Dobrovolné", actions: [] });
    });
  }
});

describe("U09: zrušená akce v měsíci", () => {
  test("zrušená povinná akce nese povinnost, zrušená nepovinná ne; štítek Zrušeno je text", async () => {
    // Zrušená zveřejněná FP akce (seed 4. 11.): pro FP byla povinná, pro RM ne.
    const fpCancelled = (await listMonth(participant, "2026-11")).find((c) => c.planStatus === "cancelled" && c.audience === "fp")!;
    expect(fpCancelled).toBeDefined();
    const forFp = (await withOwnParticipation(participant, null, [fpCancelled]))[0]!;
    expect(forFp.participation).toMatchObject({ state: "cancelled", required: true, label: null, actions: [] });
    expect(matchesAttendance(forFp, "povinne")).toBe(true);
    expect(matchesAttendance(forFp, "moje")).toBe(true);
    expect(primaryStatus(forFp)?.label).toBe("Zrušeno");
    const forRm = (await withOwnParticipation(outsider, null, [fpCancelled]))[0]!;
    expect(forRm.participation).toMatchObject({ state: "cancelled", required: false });
    expect(matchesAttendance(forRm, "povinne")).toBe(false);
    expect(matchesAttendance(forRm, "moje")).toBe(false);
    expect(matchesAttendance(forRm, undefined)).toBe(true);
  });
});

describe("U10: detail bez zapnutých přihlášek", () => {
  test("ukáže povinnost i dobrovolnost jako měsíc, jen ke čtení a bez akcí", async () => {
    vi.stubEnv("PARTICIPATION", "");
    const fp = await futurePublishedId("fp");
    const rm = await futurePublishedId("rm");
    expect(await ownParticipationDetail(participant, null, fp)).toMatchObject({ state: "required", label: "Povinné pro tebe", actions: [], enrollment: false });
    expect(await ownParticipationDetail(participant, null, rm)).toMatchObject({ state: "optional", label: "Dobrovolné", actions: [], enrollment: false });
    const month = await withOwnParticipation(participant, null, await listMonth(participant, "2026-11"));
    const card = month.find((c) => c.id === fp);
    if (card) expect(card.participation?.label).toBe("Povinné pro tebe");
  });
});

describe("štítek účasti je jeden pro celou Wiki", () => {
  test("každý stav nese vlastní data-ucast (barvu z tokenů) a vždy i text", () => {
    for (const state of ["required", "optional", "voluntary_enrolled", "excused", "withdrawn", "cancelled"] as const) {
      const html = renderToStaticMarkup(createElement(StatusBadge, { ucast: state, label: "Štítek" }));
      expect(html).toBe(`<span class="badge badge-ucast" data-ucast="${state}">Štítek</span>`);
    }
  });
});
