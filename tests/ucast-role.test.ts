import { and, eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { EventSnapshot, Group } from "@/lib/types";
import { canPlan, canReadExcuseDetails, canReadPublishedMinutes, visibleEvent } from "@/server/policy";
import { eventVisibility, now } from "@/server/config";
import { auditLog, eventParticipation, events, users } from "@/server/db/schema";
import {
  desiredGuestIds,
  effectiveParticipation,
  isRequiredForUser,
  membershipsOf,
  parseExcuse,
  participationState,
  participationTransition,
  workRolesOf,
  type ParticipationRecord,
} from "@/server/domain/participation";
import { getEventDetail } from "@/server/services/detail";
import { DomainError } from "@/server/services/errors";
import { listMonth, loadEventRow } from "@/server/services/events";
import { changeOwnParticipation, ownParticipationRecords } from "@/server/services/participation";
import { recordingPanel, uploadRecording } from "@/server/services/recordings";
import { PAST_FP, PUBLISHED_RM, asFile, fixtureWav, organizer, outsider, participant, resetDemo } from "./helpers";

const code = (promise: Promise<unknown>) => promise.then(() => "ok", (e: unknown) => (e instanceof DomainError ? e.code : String(e)));

const snap = (audience: Group, patch: Partial<EventSnapshot> = {}): EventSnapshot => ({
  type: "education-fp", label: "Školení", topicTitle: null, topicId: null,
  startsAt: "2030-01-10T09:00:00.000Z", endsAt: "2030-01-10T11:00:00.000Z", allDay: false,
  audience, leadId: null, reviewerId: null, status: "published", cancelReason: null, ...patch,
});
const active = (groups: string[]) => ({ status: "active" as const, groups });
const BEFORE = new Date("2030-01-01T00:00:00Z");
const excused: ParticipationRecord = { kind: "excused", excuseReason: "illness" };
const enrolled: ParticipationRecord = { kind: "voluntary_enrolled", excuseReason: null };
const state = (groups: string[], audience: Group, record: ParticipationRecord | null = null) => participationState(active(groups), snap(audience), record);

describe("pracovní role a povinnost (matice F01/F05)", () => {
  test("FP: FP povinná, RM dobrovolná; RM naopak", () => {
    expect([state(["fp"], "fp"), state(["fp"], "rm")]).toEqual(["required", "optional"]);
    expect([state(["rm"], "rm"), state(["rm"], "fp")]).toEqual(["required", "optional"]);
  });

  test("FP+RM: obě povinné, pozvaný jen jednou", () => {
    expect([state(["fp", "rm"], "fp"), state(["fp", "rm"], "rm")]).toEqual(["required", "required"]);
    const people = [{ id: "a", ...active(["fp", "rm", "fp", "vsichni"]) }, { id: "a", ...active(["fp", "rm"]) }];
    expect(desiredGuestIds(people, snap("fp"), new Map())).toEqual(["a"]);
    expect(membershipsOf(["fp", "rm", "fp", "vsichni", "neznamy"])).toEqual(["fp", "rm"]);
  });

  test("FP + vedoucí týmu: FP povinná, RM ne; vedoucí týmu nedává práva správce", () => {
    const groups = ["fp", "vedouci-tymu"];
    expect(workRolesOf(groups)).toEqual(["fp", "vedouci-tymu"]);
    expect([state(groups, "fp"), state(groups, "rm"), state(groups, "tym-a")]).toEqual(["required", "optional", "optional"]);
    expect(canPlan({ role: "member" })).toBe(false);
    // Starší skupina tym-a není vedoucí týmu ani pracovní role.
    expect(workRolesOf(["tym-a"])).toEqual([]);
    expect(state(["tym-a"], "tym-a")).toBe("required");
  });

  test("Všichni: povinná pro každého aktivního i bez uloženého `vsichni`", () => {
    for (const groups of [[], ["fp"], ["rm"], ["vsichni"]]) expect(isRequiredForUser(groups, "vsichni")).toBe(true);
    expect(participationState({ status: "disabled", groups: ["vsichni"] }, snap("vsichni"), null)).toBeNull();
    expect(participationState({ status: "pending", groups: ["fp"] }, snap("fp"), null)).toBeNull();
  });

  test("technická role do povinnosti nevstupuje: admin bez rolí má RM akci jen dobrovolnou", () => {
    expect(state([], "rm")).toBe("optional");
  });

  test("nezveřejněná akce, svátek a zrušená akce", () => {
    expect(participationState(active(["fp"]), null, enrolled)).toBeNull();
    expect(participationState(active(["fp"]), snap("vsichni", { type: "holiday" }), null)).toBeNull();
    const cancelled = effectiveParticipation(active(["fp"]), snap("fp", { status: "cancelled" }), null, BEFORE);
    expect(cancelled).toMatchObject({ state: "cancelled", calendarGuest: false, open: false });
    expect(participationTransition(cancelled, null, { kind: "excuse", excuse: { reason: "other", note: null } })).toEqual({ ok: false, reason: "closed" });
  });

  test("minulá akce (už začala) je uzavřená pro změny", () => {
    const p = effectiveParticipation(active(["fp"]), snap("fp"), null, new Date("2030-01-10T09:00:00Z"));
    expect(p?.open).toBe(false);
    expect(participationTransition(p, null, { kind: "excuse", excuse: { reason: "vacation", note: null } })).toEqual({ ok: false, reason: "closed" });
  });
});

describe("přechody účasti", () => {
  const fp = (record: ParticipationRecord | null, audience: Group = "fp") => effectiveParticipation(active(["fp"]), snap(audience), record, BEFORE);
  const excuse = { kind: "excuse" as const, excuse: { reason: "illness" as const, note: null } };

  test("dobrovolná přihláška a odhlášení, opakování bez účinku", () => {
    expect(participationTransition(fp(null, "rm"), null, { kind: "enroll" })).toEqual({ ok: true, write: { op: "upsert", kind: "voluntary_enrolled" } });
    expect(participationTransition(fp(enrolled, "rm"), enrolled, { kind: "enroll" })).toEqual({ ok: true, write: { op: "none" } });
    expect(participationTransition(fp(enrolled, "rm"), enrolled, { kind: "withdraw" })).toEqual({ ok: true, write: { op: "upsert", kind: "withdrawn" } });
    expect(participationTransition(fp(null, "rm"), null, { kind: "withdraw" })).toEqual({ ok: true, write: { op: "none" } });
    const withdrawn: ParticipationRecord = { kind: "withdrawn", excuseReason: null };
    expect(fp(withdrawn, "rm")?.state).toBe("withdrawn");
    expect(participationTransition(fp(withdrawn, "rm"), withdrawn, { kind: "enroll" })).toEqual({ ok: true, write: { op: "upsert", kind: "voluntary_enrolled" } });
    expect(participationTransition(fp(withdrawn, "rm"), withdrawn, { kind: "withdraw" })).toEqual({ ok: true, write: { op: "none" } });
  });

  test("omluva z povinné, odvolání obnoví povinnost; z dobrovolné omluva nejde", () => {
    expect(participationTransition(fp(null), null, excuse)).toMatchObject({ ok: true, write: { op: "upsert", kind: "excused" } });
    expect(fp(excused)).toMatchObject({ state: "excused", required: true, calendarGuest: false });
    expect(participationTransition(fp(excused), excused, { kind: "revoke_excuse" })).toEqual({ ok: true, write: { op: "delete" } });
    expect(participationTransition(fp(null, "rm"), null, excuse)).toEqual({ ok: false, reason: "not_allowed" });
    expect(participationTransition(fp(null), null, { kind: "enroll" })).toEqual({ ok: false, reason: "not_allowed" });
    expect(participationTransition(fp(null), null, { kind: "withdraw" })).toEqual({ ok: false, reason: "not_allowed" });
  });

  test("změna rolí či publika: omluva platí jen u povinné, přihláška povinnost nemění", () => {
    expect(state(["rm"], "fp", excused)).toBe("optional");
    expect(state(["fp"], "fp", excused)).toBe("excused");
    expect(state(["fp"], "fp", enrolled)).toBe("required");
    expect(state(["rm"], "fp", enrolled)).toBe("voluntary_enrolled");
    // Stará omluva u nepovinné akce: odhlášení ji nesmaže, odvolání omluvy ano.
    expect(participationTransition(fp(excused, "rm"), excused, { kind: "withdraw" })).toEqual({ ok: true, write: { op: "none" } });
    expect(participationTransition(fp(excused, "rm"), excused, { kind: "revoke_excuse" })).toEqual({ ok: true, write: { op: "delete" } });
    expect(participationTransition(fp(enrolled), enrolled, { kind: "revoke_excuse" })).toEqual({ ok: true, write: { op: "none" } });
  });

  test("pozvaní = povinní − omluvení + dobrovolní", () => {
    const people = [
      { id: "fp1", ...active(["fp"]) }, { id: "fp2", ...active(["fp"]) }, { id: "rm1", ...active(["rm"]) },
      { id: "rm2", ...active(["rm"]) }, { id: "off", status: "disabled" as const, groups: ["fp"] },
    ];
    const records = new Map([["fp2", excused], ["rm1", enrolled]]);
    expect(desiredGuestIds(people, snap("fp"), records)).toEqual(["fp1", "rm1"]);
    expect(desiredGuestIds(people, null, records)).toEqual([]);
  });

  test("validace omluvy", () => {
    expect(parseExcuse({ reason: "illness" })).toEqual({ reason: "illness", note: null });
    expect(parseExcuse({ reason: "other", note: "  u lékaře \u0007 " })).toEqual({ reason: "other", note: "u lékaře" });
    expect(parseExcuse({ reason: "diagnoza" })).toBeNull();
    expect(parseExcuse({ reason: "other", note: "x".repeat(281) })).toBeNull();
    expect(parseExcuse({ reason: "other", note: 5 })).toBeNull();
  });
});

describe("viditelnost zveřejněných akcí (F02, přepínač)", () => {
  beforeEach(resetDemo);
  afterEach(() => vi.unstubAllEnvs());

  test("výchozí stav: přepínač vypnutý, chování beze změny", async () => {
    expect(eventVisibility()).toBe("audience");
    const ids = (await listMonth(participant, "2026-11")).map((c) => c.id);
    expect(ids).toContain(PAST_FP);
    expect(ids).not.toContain(PUBLISHED_RM);
    expect(await getEventDetail(outsider, PAST_FP)).toBeNull();
  });

  test("ostrá Wiki přepínač ignoruje", () => {
    vi.stubEnv("EVENT_VISIBILITY", "all-published");
    vi.stubEnv("WIKI_MODE", "production");
    expect(eventVisibility()).toBe("audience");
    vi.stubEnv("WIKI_MODE", "demo");
    expect(eventVisibility()).toBe("all-published");
    vi.stubEnv("EVENT_VISIBILITY", "all");
    expect(eventVisibility()).toBe("audience");
  });

  test("zapnuto: FP vidí cizí zveřejněnou RM akci, ne návrh ani zápis či nahrávku", async () => {
    vi.stubEnv("EVENT_VISIBILITY", "all-published");
    const cards = await listMonth(participant, "2026-11");
    const ids = cards.map((c) => c.id);
    expect(ids).toContain(PUBLISHED_RM);
    expect(ids).not.toContain("ev-11-13");
    expect(cards.every((c) => c.planStatus !== "draft" && c.revision === null && c.syncStatus === null && c.original === null)).toBe(true);

    const db = await resetDemo().then(() => import("@/server/db/client").then((m) => m.getDb()));
    const draft = (await loadEventRow(db, "ev-11-13"))!;
    expect(draft.published).toBeNull();
    expect(visibleEvent(participant, draft)).toBeNull();

    // Cizí minulá FP akce se zveřejněným zápisem: akce ano, zápis ani nahrávka ne.
    const past = (await loadEventRow(db, PAST_FP))!;
    expect(visibleEvent(outsider, past)).not.toBeNull();
    expect(canReadPublishedMinutes(outsider, past)).toBe(false);
    expect((await recordingPanel(outsider, past)).access).toBe("none");
    const detail = await getEventDetail(outsider, PAST_FP);
    expect(detail).toMatchObject({ form: null, publishedForm: null, sync: null, canCancel: false, canDelete: false, recording: { access: "none" } });
    expect(detail?.card.minutesPublished).toBe(false);
    expect(await code(uploadRecording(outsider, PAST_FP, asFile(fixtureWav(), "a.wav")))).toBe("forbidden");
  });

  test("zapnuto: správce dál vidí pracovní verzi, náhled se řídí stejnými pravidly", async () => {
    vi.stubEnv("EVENT_VISIBILITY", "all-published");
    const all = (await listMonth(organizer, "2026-11")).map((c) => c.id);
    expect(all).toContain("ev-11-13");
  });
});

describe("individuální účast v databázi", () => {
  beforeEach(resetDemo);

  async function futurePublished(audience: Group): Promise<string> {
    const db = await import("@/server/db/client").then((m) => m.getDb());
    const [row] = await db
      .select({ id: events.id })
      .from(events)
      .where(and(sql`${events.published}->>'audience' = ${audience}`, sql`${events.published}->>'status' = 'published'`, sql`(${events.published}->>'startsAt')::timestamptz > ${now().toISOString()}::timestamptz`, sql`${events.type} <> 'holiday'`))
      .limit(1);
    if (!row) throw new Error(`v seedu chybí budoucí zveřejněná akce ${audience}`);
    return row.id;
  }
  const db = () => import("@/server/db/client").then((m) => m.getDb());

  test("dobrovolná přihláška k RM akci a odhlášení, s auditem bez obsahu", async () => {
    const id = await futurePublished("rm");
    expect((await changeOwnParticipation(participant, id, { kind: "enroll" })).state).toBe("voluntary_enrolled");
    expect((await changeOwnParticipation(participant, id, { kind: "enroll" })).state).toBe("voluntary_enrolled");
    const rows = await (await db()).select().from(eventParticipation);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: participant.id, kind: "voluntary_enrolled", revision: 1 });
    expect((await changeOwnParticipation(participant, id, { kind: "withdraw" })).state).toBe("withdrawn");
    expect(await (await db()).select().from(eventParticipation)).toMatchObject([{ kind: "withdrawn", excuseReason: null }]);
    const actions = (await (await db()).select().from(auditLog).where(eq(auditLog.entityId, id))).map((a) => a.action);
    expect(actions).toEqual(["participation.enroll", "participation.withdraw"]);
  });

  test("omluva z povinné akce platí hned, poznámka nejde do auditu, odvolání ji smaže", async () => {
    const id = await futurePublished("fp");
    const note = "soukroma-poznamka-xyz";
    const p = await changeOwnParticipation(participant, id, { kind: "excuse", excuse: { reason: "illness", note } });
    expect(p).toMatchObject({ state: "excused", calendarGuest: false });
    expect((await ownParticipationRecords(await db(), participant, [id])).get(id)).toEqual({ kind: "excused", excuseReason: "illness" });
    expect((await ownParticipationRecords(await db(), outsider, [id])).size).toBe(0);
    const audits = await (await db()).select().from(auditLog);
    expect(JSON.stringify(audits)).not.toContain(note);
    expect(JSON.stringify(audits)).not.toContain("illness");
    expect((await changeOwnParticipation(participant, id, { kind: "revoke_excuse" })).state).toBe("required");
    expect(await (await db()).select().from(eventParticipation)).toHaveLength(0);
  });

  test("souběh: dvě stejné přihlášky = jeden záznam", async () => {
    const id = await futurePublished("rm");
    const results = await Promise.all([changeOwnParticipation(participant, id, { kind: "enroll" }), changeOwnParticipation(participant, id, { kind: "enroll" })]);
    expect(results.map((r) => r.state)).toEqual(["voluntary_enrolled", "voluntary_enrolled"]);
    expect(await (await db()).select().from(eventParticipation)).toHaveLength(1);
  });

  test("nedovolené: návrh, cizí ID, omluva z nepovinné, minulá akce, neaktivní účet, cizí organizace", async () => {
    const rm = await futurePublished("rm");
    expect(await code(changeOwnParticipation(participant, "ev-11-13", { kind: "enroll" }))).toBe("not_found");
    expect(await code(changeOwnParticipation(participant, "neexistuje", { kind: "enroll" }))).toBe("not_found");
    expect(await code(changeOwnParticipation(participant, rm, { kind: "excuse", excuse: { reason: "other", note: null } }))).toBe("invalid_state");
    expect(await code(changeOwnParticipation(participant, PAST_FP, { kind: "excuse", excuse: { reason: "other", note: null } }))).toBe("invalid_state");
    await (await db()).update(users).set({ status: "disabled" }).where(eq(users.id, participant.id));
    expect(await code(changeOwnParticipation(participant, rm, { kind: "enroll" }))).toBe("forbidden");
    expect(await code(changeOwnParticipation({ ...participant, id: "cizi-org-uzivatel" }, rm, { kind: "enroll" }))).toBe("forbidden");
    expect(await (await db()).select().from(eventParticipation)).toHaveLength(0);
  });

  test("omezení DB: unikátnost, důvod jen u omluvy, limit poznámky, izolace organizace", async () => {
    const id = await futurePublished("fp");
    const d = await db();
    const ins = (values: Record<string, unknown>) =>
      d.execute(sql`INSERT INTO event_participation (org_id, event_id, user_id, kind, excuse_reason, excuse_note) VALUES (${values.org ?? "zbc-demo"}, ${values.event ?? id}, ${values.user ?? participant.id}, ${values.kind}, ${values.reason ?? null}, ${values.note ?? null})`).then(() => "ok", () => "error");
    const [me] = await d.select({ orgId: users.orgId }).from(users).where(eq(users.id, participant.id));
    const orgId = me!.orgId;
    expect(await ins({ org: orgId, kind: "excused" })).toBe("error");
    expect(await ins({ org: orgId, kind: "voluntary_enrolled", reason: "illness" })).toBe("error");
    expect(await ins({ org: orgId, kind: "voluntary_enrolled", note: "x" })).toBe("error");
    expect(await ins({ org: orgId, kind: "excused", reason: "illness", note: "x".repeat(281) })).toBe("error");
    expect(await ins({ org: orgId, kind: "excused", reason: "diagnoza" })).toBe("error");
    expect(await ins({ org: "jina-organizace", kind: "voluntary_enrolled" })).toBe("error");
    expect(await ins({ org: orgId, kind: "excused", reason: "vacation" })).toBe("ok");
    expect(await ins({ org: orgId, kind: "voluntary_enrolled" })).toBe("error");
    // Smazání účtu záznam smaže (minimalizace dat).
    await d.insert(users).values({ id: "docasny", orgId, name: "Dočasný", email: "docasny@example.invalid", role: "member", groups: ["fp"] });
    expect(await ins({ org: orgId, user: "docasny", kind: "excused", reason: "other" })).toBe("ok");
    await d.execute(sql`DELETE FROM users WHERE id = 'docasny'`);
    expect((await d.select().from(eventParticipation)).map((r) => r.userId)).toEqual([participant.id]);
  });

  test("důvod omluvy čte jen sám omluvený, správce ne", () => {
    expect(canReadExcuseDetails(participant, participant.id)).toBe(true);
    expect(canReadExcuseDetails(organizer, participant.id)).toBe(false);
  });

  // Oprava B (finální integrační kolo): manažerská struktura ve Wiki zatím není (O03). Dokud ji firma nedodá,
  // nesmí důvod omluvy odemknout technická role ani pracovní role „vedoucí týmu“.
  test("hlavní správce, vedoucí týmu ani kolega ze stejné skupiny důvod omluvy nevidí", () => {
    const admin = { id: "demo-spravce", role: "admin" as const, groups: ["vsichni", "fp", "rm", "tym-a"] };
    const teamLead = { id: "vedouci-tymu-1", role: "member" as const, groups: ["vsichni", "fp", "vedouci-tymu"] };
    const colleague = { id: "kolega-fp", role: "member" as const, groups: ["vsichni", "fp"] };
    for (const viewer of [admin, teamLead, colleague]) expect(canReadExcuseDetails(viewer, participant.id)).toBe(false);
  });
});
