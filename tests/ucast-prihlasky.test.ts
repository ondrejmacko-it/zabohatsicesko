import { and, eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { now } from "@/server/config";
import { getDb } from "@/server/db/client";
import { auditLog, eventParticipation, events, users } from "@/server/db/schema";
import { PARTICIPATION_LIMIT, isMine, ownParticipationView } from "@/server/domain/participation";
import { listMonth } from "@/server/services/events";
import { ownParticipationDetail, withOwnParticipation } from "@/server/services/participation";
import type { Viewer } from "@/server/policy";
import { PREVIEW_COOKIE, encodePreviewCookie } from "@/server/services/preview-context";
import { PAST_FP, organizer, outsider, participant, resetDemo } from "./helpers";

// PR2: akce formuláře nad changeOwnParticipation, štítky, Moje/Všechny a přepínač PARTICIPATION.

let sessionUser: Viewer = participant;
vi.mock("next/cache", () => ({ refresh: () => undefined }));
// `after` z Next běží jen v požadavku. Tady se úloha po odpovědi zahodí, Kalendář ověřuje tests/kalendar-f04.test.ts.
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: () => undefined }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: async () => ({ ...sessionUser, name: "Test", email: "t@example.invalid", signedInWith: "demo" }) }));
// Cookie náhledu „Zobrazit jako“ (jinak žádná): ověřuje serverovou pojistku `runAction`.
let previewCookie: string | undefined;
vi.mock("next/headers", async (original) => ({
  ...(await original<typeof import("next/headers")>()),
  cookies: async () => ({ get: (name: string) => (name === PREVIEW_COOKIE && previewCookie ? { name, value: previewCookie } : undefined) }),
}));
const { changeParticipationAction } = await import("@/features/vzdelavani/actions");

const NOTE = "soukroma-poznamka-pr2";
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};
const act = (fields: Record<string, string>) => changeParticipationAction(null, form(fields));

async function futurePublished(audience: string): Promise<string> {
  const [row] = await (await getDb())
    .select({ id: events.id })
    .from(events)
    .where(and(sql`${events.published}->>'audience' = ${audience}`, sql`${events.published}->>'status' = 'published'`, sql`(${events.published}->>'startsAt')::timestamptz > ${now().toISOString()}::timestamptz`, sql`${events.type} <> 'holiday'`))
    .limit(1);
  return row!.id;
}
const records = async () => (await getDb()).select().from(eventParticipation);

beforeEach(async () => {
  sessionUser = participant;
  vi.stubEnv("PARTICIPATION", "on");
  await resetDemo();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("akce formuláře: přechody", () => {
  test("přihlásit, znovu přihlásit (bez účinku), odhlásit", async () => {
    const rm = await futurePublished("rm");
    expect(await act({ id: rm, change: "enroll" })).toMatchObject({ ok: true });
    expect(await act({ id: rm, change: "enroll" })).toMatchObject({ ok: true });
    expect(await records()).toHaveLength(1);
    expect(await act({ id: rm, change: "withdraw" })).toMatchObject({ ok: true });
    expect(await records()).toMatchObject([{ kind: "withdrawn", excuseReason: null }]);
    expect((await ownParticipationDetail(participant, null, rm))?.state).toBe("withdrawn");
    expect(await act({ id: rm, change: "enroll" })).toMatchObject({ ok: true });
    expect(await records()).toMatchObject([{ kind: "voluntary_enrolled" }]);
  });

  test("omluva s důvodem a poznámkou, zrušení omluvy; nedovolené přechody", async () => {
    const fp = await futurePublished("fp");
    const rm = await futurePublished("rm");
    expect(await act({ id: fp, change: "enroll" })).toMatchObject({ ok: false });
    expect(await act({ id: rm, change: "excuse", reason: "illness" })).toMatchObject({ ok: false });
    expect(await act({ id: fp, change: "excuse", reason: "vacation", note: `  ${NOTE}  ` })).toMatchObject({ ok: true });
    expect((await records())[0]).toMatchObject({ kind: "excused", excuseReason: "vacation", excuseNote: NOTE });
    const detail = await ownParticipationDetail(participant, null, fp);
    expect(detail).toMatchObject({ state: "excused", label: "Omluven/a", actions: ["revoke_excuse"], excuse: { reason: "vacation", note: NOTE } });
    expect(await act({ id: fp, change: "revoke_excuse" })).toMatchObject({ ok: true });
    expect(await records()).toHaveLength(0);
  });

  test("validace: neznámý důvod, dlouhá poznámka, neznámá změna", async () => {
    const fp = await futurePublished("fp");
    expect(await act({ id: fp, change: "excuse", reason: "nemoc" })).toMatchObject({ ok: false });
    expect(await act({ id: fp, change: "excuse", reason: "other", note: "x".repeat(281) })).toMatchObject({ ok: false });
    expect(await act({ id: fp, change: "delete" })).toMatchObject({ ok: false });
    expect(await records()).toHaveLength(0);
  });

  test("omluva jen před začátkem akce", async () => {
    expect(await act({ id: PAST_FP, change: "excuse", reason: "illness" })).toMatchObject({ ok: false });
  });
});

describe("oprávnění", () => {
  test("cizí účast nejde změnit: identita jen ze session, pole userId se ignoruje", async () => {
    const rm = await futurePublished("rm");
    expect(await act({ id: rm, change: "enroll", userId: outsider.id })).toMatchObject({ ok: true });
    expect((await records()).map((r) => r.userId)).toEqual([participant.id]);
  });

  test("neaktivní účet nic nezmění", async () => {
    const rm = await futurePublished("rm");
    await (await getDb()).update(users).set({ status: "disabled" }).where(eq(users.id, participant.id));
    expect(await act({ id: rm, change: "enroll" })).toMatchObject({ ok: false });
    expect(await records()).toHaveLength(0);
  });

  test("náhled konkrétního kolegy 1:1: skutečný stav a stejné akce jako kolega, bez soukromého důvodu", async () => {
    const fp = await futurePublished("fp");
    await act({ id: fp, change: "excuse", reason: "illness", note: NOTE });
    const preview = { viewer: participant, label: "Kolega", personName: "Testovací kolega" };
    const month = await listMonth(participant, "2026-11");
    const cards = await withOwnParticipation(organizer, preview, month);
    const own = await withOwnParticipation(participant, null, month);
    expect(cards.map((c) => c.participation)).toEqual(own.map((c) => c.participation));
    const detail = await ownParticipationDetail(organizer, preview, fp);
    expect(detail).toMatchObject({ state: "excused", excuse: null, calendar: null, actions: ["revoke_excuse"] });
    expect(JSON.stringify(detail)).not.toContain(NOTE);
    const groupPreview = { viewer: { ...participant, id: "nahled-skupiny" }, label: "Skupina" };
    const groupDetail = await ownParticipationDetail(organizer, groupPreview, fp);
    // Skupina nemá individuální přihlášky ani omluvy: stav jen podle rolí.
    expect(groupDetail).toMatchObject({ state: "required", actions: ["excuse"] });
    expect(JSON.stringify(groupDetail)).not.toContain(NOTE);
  });

  test("serverová pojistka: v náhledu „Zobrazit jako“ se účast nezmění ani podvrženým požadavkem", async () => {
    const rm = await futurePublished("rm");
    sessionUser = organizer;
    previewCookie = encodePreviewCookie(organizer.id, `kolega-${participant.id}`);
    try {
      const result = await act({ id: rm, change: "enroll" });
      expect(result).toEqual({ ok: false, error: expect.stringContaining("Náhled je jen ke čtení") });
      expect(await records()).toHaveLength(0);
      // Cookie jiného účtu (správce) náhled kolegovi nezapne: kolega jedná normálně za sebe.
      sessionUser = participant;
      expect(await act({ id: rm, change: "enroll" })).toMatchObject({ ok: true });
    } finally {
      previewCookie = undefined;
    }
  });

  test("limit četnosti", async () => {
    const rm = await futurePublished("rm");
    for (let i = 0; i < PARTICIPATION_LIMIT.count; i++) await act({ id: rm, change: i % 2 ? "withdraw" : "enroll" });
    expect(await act({ id: rm, change: "enroll" })).toMatchObject({ ok: false, error: expect.stringContaining("Příliš mnoho") });
  });
});

describe("soukromí a souběh", () => {
  test("poznámka není v auditu, logu ani v účasti jiných", async () => {
    const errors = vi.spyOn(console, "error");
    const logs = vi.spyOn(console, "log");
    const fp = await futurePublished("fp");
    await act({ id: fp, change: "excuse", reason: "illness", note: NOTE });
    const audit = JSON.stringify(await (await getDb()).select().from(auditLog));
    expect(audit).not.toContain(NOTE);
    expect(audit).not.toContain("illness");
    expect(JSON.stringify([errors.mock.calls, logs.mock.calls])).not.toContain(NOTE);
    expect(await ownParticipationDetail(outsider, null, fp)).toMatchObject({ excuse: null });
    const theirs = await withOwnParticipation(outsider, null, await listMonth(outsider, "2026-11"));
    expect(JSON.stringify(theirs)).not.toContain(NOTE);
    expect(JSON.stringify(theirs)).not.toContain("excused");
  });

  test("souběh dvou omluv = jeden záznam", async () => {
    const fp = await futurePublished("fp");
    const results = await Promise.all([act({ id: fp, change: "excuse", reason: "illness" }), act({ id: fp, change: "excuse", reason: "other" })]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await records()).toHaveLength(1);
  });
});

describe("štítky a filtr Moje", () => {
  test("pohled účasti a filtr", () => {
    const p = (state: "required" | "optional" | "voluntary_enrolled" | "excused" | "withdrawn", open = true) => ({ state, required: false, calendarGuest: false, open });
    expect(ownParticipationView(p("required"), { readOnly: false })).toEqual({ state: "required", required: false, label: "Povinné pro tebe", actions: ["excuse"] });
    expect(ownParticipationView(p("optional"), { readOnly: false })?.label).toBe("Můžeš se přihlásit");
    expect(ownParticipationView(p("voluntary_enrolled"), { readOnly: false })).toMatchObject({ label: "Přihlášeno", actions: ["withdraw"] });
    expect(ownParticipationView(p("required", false), { readOnly: false })?.actions).toEqual([]);
    expect(ownParticipationView(p("withdrawn"), { readOnly: false })).toMatchObject({ label: "Odhlášeno", actions: ["enroll"] });
    expect(isMine(ownParticipationView(p("withdrawn"), { readOnly: false }), false)).toBe(false);
    expect(isMine(ownParticipationView(p("optional"), { readOnly: false }), false)).toBe(false);
    expect(isMine(ownParticipationView(p("optional"), { readOnly: false }), true)).toBe(true);
    expect(isMine(ownParticipationView(p("excused"), { readOnly: false }), false)).toBe(true);
  });
});

describe("vypnutý přepínač (výchozí stav)", () => {
  test("vypnutý zápis účasti: role se zobrazí jen ke čtení a tabulka se nečte", async () => {
    vi.stubEnv("PARTICIPATION", "");
    const rm = await futurePublished("rm");
    expect(await act({ id: rm, change: "enroll" })).toMatchObject({ ok: false });
    expect(await records()).toHaveLength(0);
    const cards = await listMonth(participant, "2026-11");
    const readOnly = await withOwnParticipation(participant, null, cards);
    expect(readOnly).toHaveLength(cards.length);
    expect(readOnly.filter((card) => card.participation).every((card) => card.participation?.actions.length === 0)).toBe(true);
    // Rozhodnutí vlastníka 23. 11. (U10): detail ukáže totéž co měsíc, jen ke čtení, bez akcí ke změně účasti.
    expect(await ownParticipationDetail(participant, null, rm)).toMatchObject({ state: "optional", label: "Dobrovolné", actions: [], excuse: null, calendar: null, enrollment: false });
    // Ani bez tabulky nic nespadne: přepínač vypnutý = žádný dotaz na event_participation.
    await (await getDb()).execute(sql`ALTER TABLE event_participation RENAME TO event_participation_off`);
    try {
      expect((await withOwnParticipation(participant, null, cards)).length).toBe(cards.length);
      expect(await ownParticipationDetail(participant, null, rm)).toMatchObject({ state: "optional", label: "Dobrovolné", actions: [], excuse: null, calendar: null, enrollment: false });
    } finally {
      await (await getDb()).execute(sql`ALTER TABLE event_participation_off RENAME TO event_participation`);
    }
  });
});
