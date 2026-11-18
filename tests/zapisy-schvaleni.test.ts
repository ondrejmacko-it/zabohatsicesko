import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { getDb } from "@/server/db/client";
import { auditLog, events, minutes } from "@/server/db/schema";
import { draftFromText } from "@/server/integrations/minutes-drafter";
import type { Viewer } from "@/server/policy";
import { readPastedText, readTextFile, stripSubtitleTimings, TEXT_SOURCE_MAX_BYTES } from "@/server/recordings/text-source";
import { DomainError } from "@/server/services/errors";
import { loadEventRow } from "@/server/services/events";
import { listPublishedMinutes, listTasks } from "@/server/services/journey";
import { approveMinutes, createMinutesDraft, recordingPanel, updateMinutes, withdrawMinutes } from "@/server/services/recordings";
import { PAST_FP, PUBLISHED_RM, admin, lead, outsider, participant, resetDemo } from "./helpers";

beforeEach(resetDemo);

const code = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "ok";
  } catch (e) {
    return e instanceof DomainError ? e.code : String(e);
  }
};
const syncCode = (fn: () => unknown) => {
  try {
    fn();
    return "ok";
  } catch (e) {
    return e instanceof DomainError ? e.code : String(e);
  }
};
const bytes = (text: string) => new TextEncoder().encode(text);

/** Kontrolor akce: kolega ze skupiny FP (účet účastníka), kterého správce k akci přiřadil. */
const reviewer: Viewer = { id: "demo-ucastnik", role: "member", groups: ["vsichni", "fp"] };

async function setPublished(eventId: string, patch: { reviewerId?: string | null; leadId?: string | null }) {
  const db = await getDb();
  const row = (await loadEventRow(db, eventId))!;
  await db.update(events).set({ published: { ...row.published!, ...patch } }).where(eq(events.id, eventId));
}

const NOTES = [
  "Shrnutí: Rozbor úvodní schůzky s klientem.",
  "## Hlavní body",
  "- Před schůzkou zkontrolovat podklady.",
  "- Připravit tři otevřené otázky.",
  "Rozhodnutí:",
  "- Kontrolní seznam bude povinný.",
  "Další kroky:",
  "- Klára doplní seznam do Wiki do pátku.",
].join("\n");

async function notesDraft(viewer: Viewer = lead) {
  const id = await createMinutesDraft(viewer, PAST_FP, { source: "notes", text: NOTES }, null);
  const [row] = await (await getDb()).select().from(minutes).where(eq(minutes.id, id));
  return row!;
}

const panelOf = async (viewer: Viewer) => recordingPanel(viewer, (await loadEventRow(await getDb(), PAST_FP))!);
const auditActions = async () =>
  (await (await getDb()).select().from(auditLog).where(and(eq(auditLog.entityId, PAST_FP)))).map((a) => a.action);

describe("textový zdroj zápisu", () => {
  test("přípona, velikost, prázdný soubor a neplatné UTF-8", () => {
    expect(syncCode(() => readTextFile("zapis.pdf", bytes("text")))).toBe("text_file_type");
    expect(syncCode(() => readTextFile("zapis", bytes("text")))).toBe("text_file_type");
    expect(syncCode(() => readTextFile("zapis.txt.exe", bytes("text")))).toBe("text_file_type");
    expect(syncCode(() => readTextFile("zapis.txt", new Uint8Array(TEXT_SOURCE_MAX_BYTES + 1).fill(65)))).toBe("text_too_large");
    expect(syncCode(() => readTextFile("zapis.txt", new Uint8Array(0)))).toBe("text_empty");
    expect(syncCode(() => readTextFile("zapis.txt", bytes("  \n\n ")))).toBe("text_empty");
    expect(syncCode(() => readTextFile("zapis.txt", new Uint8Array([0x50, 0xff, 0xfe, 0x41])))).toBe("text_encoding");
    expect(syncCode(() => readTextFile("zapis.md", new Uint8Array([0x41, 0x00, 0x42])))).toBe("text_encoding");
    expect(readTextFile("Zapis.MD", bytes("﻿# Shrnutí\r\nŽluťoučký kůň\r\n"))).toBe("# Shrnutí\nŽluťoučký kůň");
    expect(readTextFile("zapis.txt", new Uint8Array(TEXT_SOURCE_MAX_BYTES).fill(65))).toHaveLength(TEXT_SOURCE_MAX_BYTES);
    expect(syncCode(() => readPastedText("x".repeat(TEXT_SOURCE_MAX_BYTES + 1)))).toBe("text_too_large");
    expect(syncCode(() => readPastedText(" \n "))).toBe("text_empty");
  });

  test("VTT a SRT bez hlavičky, čísel, časových značek a značek mluvčích", () => {
    const vtt = [
      "WEBVTT - porada",
      "",
      "NOTE interní poznámka",
      "nemá se převzít",
      "",
      "uvod",
      "00:00:01.000 --> 00:00:04.000 align:start",
      "<v Jana>Dobrý den, začneme.</v>",
      "",
      "00:04.000 --> 00:06.500",
      "Dohodli jsme se na <b>seznamu</b>.",
      "",
      "00:06.500 --> 00:08.000",
      "Dohodli jsme se na seznamu.",
    ].join("\n");
    expect(stripSubtitleTimings(vtt)).toBe("Jana: Dobrý den, začneme.\nDohodli jsme se na seznamu.");
    expect(readTextFile("porada.vtt", bytes(vtt))).toBe("Jana: Dobrý den, začneme.\nDohodli jsme se na seznamu.");

    const srt = ["1", "00:00:01,000 --> 00:00:03,000", "Klára doplní seznam.", "", "2", "00:00:03,000 --> 00:00:05,000", "42 bodů", "projdeme příště.", ""].join("\r\n");
    expect(readTextFile("porada.srt", bytes(srt))).toBe("Klára doplní seznam.\n42 bodů\nprojdeme příště.");
    expect(syncCode(() => readTextFile("prazdne.srt", bytes("1\n00:00:01,000 --> 00:00:02,000\n\n")))).toBe("text_empty");
  });

  test("lokální návrh rozdělí text do šablony podle nadpisů a klíčových slov", () => {
    const context = { label: "Trénink poradců", topicTitle: null };
    expect(draftFromText(NOTES, context)).toEqual({
      summary: "Rozbor úvodní schůzky s klientem.",
      keyPoints: ["Před schůzkou zkontrolovat podklady.", "Připravit tři otevřené otázky."],
      decisions: ["Kontrolní seznam bude povinný."],
      nextSteps: ["Klára doplní seznam do Wiki do pátku."],
    });
    const loose = draftFromText("Probrali jsme úvodní schůzku. Shodli jsme se na seznamu otázek. Petr pošle podklady do pátku. Klient chce víc času.", context);
    expect(loose).toEqual({
      summary: "Probrali jsme úvodní schůzku.",
      keyPoints: ["Klient chce víc času."],
      decisions: ["Shodli jsme se na seznamu otázek."],
      nextSteps: ["Petr pošle podklady do pátku."],
    });
    const many = draftFromText(Array.from({ length: 30 }, (_, i) => `- bod ${i} ${"x".repeat(600)}`).join("\n"), context);
    expect(many.keyPoints).toHaveLength(20);
    expect(many.keyPoints.every((p) => p.length <= 500)).toBe(true);
  });
});

describe("zápis bez nahrávky", () => {
  test("z vložených poznámek vznikne upravitelný návrh, publikum ho nevidí", async () => {
    const row = await notesDraft();
    expect(row).toMatchObject({ source: "notes", status: "draft", version: 1, recordingId: null, jobId: null, approvedVersion: null });
    expect(row.content.decisions).toEqual(["Kontrolní seznam bude povinný."]);
    expect(await panelOf(lead)).toMatchObject({ access: "handler", state: "review", canApprove: true, hasLead: true, minutes: { id: row.id, source: "notes" } });
    expect(await panelOf(participant)).toMatchObject({ access: "reader", minutes: null });
    expect(await auditActions()).toContain("minutes.create.notes");
  });

  test("ze souboru se kontroluje přípona i obsah, ručně vznikne prázdná šablona", async () => {
    expect(await code(createMinutesDraft(lead, PAST_FP, { source: "file", fileName: "zapis.docx", bytes: bytes("x") }, null))).toBe("text_file_type");
    expect(await code(createMinutesDraft(lead, PAST_FP, { source: "file", fileName: "zapis.txt", bytes: new Uint8Array([0xc3]) }, null))).toBe("text_encoding");
    const id = await createMinutesDraft(lead, PAST_FP, { source: "manual" }, null);
    const panel = await panelOf(lead);
    expect(panel).toMatchObject({ minutes: { id, source: "manual", content: { summary: "", keyPoints: [] } } });
    // Prázdný ruční zápis schválit nejde, po doplnění shrnutí ano.
    expect(await code(approveMinutes(lead, PAST_FP, id, 1))).toBe("minutes_incomplete");
    const saved = await updateMinutes(lead, PAST_FP, id, 1, { summary: "Ruční shrnutí", keyPoints: [], decisions: [], nextSteps: [] });
    await approveMinutes(lead, PAST_FP, id, saved.version);
    expect((await listPublishedMinutes(participant)).find((m) => m.eventId === PAST_FP)?.summary).toBe("Ruční shrnutí");
  });

  test("zápis jen k proběhlé zveřejněné akci a jen pro vedoucího, kontrolora a správce", async () => {
    expect(await code(createMinutesDraft(lead, PUBLISHED_RM, { source: "manual" }, null))).toBe("not_past");
    expect(await code(createMinutesDraft(participant, PAST_FP, { source: "manual" }, null))).toBe("forbidden");
    expect(await code(createMinutesDraft(outsider, PAST_FP, { source: "manual" }, null))).toBe("not_found");
    await setPublished(PAST_FP, { reviewerId: reviewer.id });
    expect(await code(createMinutesDraft(reviewer, PAST_FP, { source: "manual" }, null))).toBe("ok");
  });

  test("souběh dvou založení: druhé neprojde, nahrazení musí znát aktuální zápis", async () => {
    const first = await createMinutesDraft(lead, PAST_FP, { source: "notes", text: NOTES }, null);
    expect(await code(createMinutesDraft(admin, PAST_FP, { source: "manual" }, null))).toBe("conflict");
    // Rozepsaný návrh s obsahem nejde nahradit bez výslovného potvrzení (Z-02, hlídá server).
    expect(await code(createMinutesDraft(admin, PAST_FP, { source: "manual" }, first))).toBe("replace_unconfirmed");
    const second = await createMinutesDraft(admin, PAST_FP, { source: "transcript", text: "Probrali jsme podklady." }, first, true);
    expect(await panelOf(lead)).toMatchObject({ minutes: { id: second, source: "transcript" } });
    // Nahrazený návrh se nemaže, zůstává jako starší verze.
    expect(await (await getDb()).select().from(minutes).where(eq(minutes.id, first))).toHaveLength(1);
    // Prázdný ruční návrh jde nahradit bez potvrzení, nic se neztratí.
    const empty = await createMinutesDraft(admin, PAST_FP, { source: "manual" }, second, true);
    expect(await code(createMinutesDraft(admin, PAST_FP, { source: "notes", text: NOTES }, empty))).toBe("ok");
  });
});

describe("schválení a zveřejnění", () => {
  test("schválit smí jen vedoucí akce, kontrolor a správce jen upravují", async () => {
    await setPublished(PAST_FP, { reviewerId: reviewer.id });
    const row = await notesDraft();
    expect(await panelOf(reviewer)).toMatchObject({ access: "handler", canApprove: false });
    expect(await panelOf(admin)).toMatchObject({ access: "handler", canApprove: false });

    expect(await code(approveMinutes(reviewer, PAST_FP, row.id, 1))).toBe("not_lead");
    expect(await code(approveMinutes(admin, PAST_FP, row.id, 1))).toBe("not_lead");
    expect(await code(approveMinutes(outsider, PAST_FP, row.id, 1))).toBe("not_found");
    expect(await code(updateMinutes(outsider, PAST_FP, row.id, 1, row.content))).toBe("not_found");

    // Kontrolor i správce návrh upraví, každá změna je nová verze.
    const byReviewer = await updateMinutes(reviewer, PAST_FP, row.id, 1, { ...row.content, summary: "Upravil kontrolor" });
    const byAdmin = await updateMinutes(admin, PAST_FP, row.id, byReviewer.version, { ...row.content, summary: "Upravil správce" });
    expect(byAdmin).toMatchObject({ version: 3, newDraft: false });
    expect(await listPublishedMinutes(participant)).not.toContainEqual(expect.objectContaining({ eventId: PAST_FP }));

    await approveMinutes(lead, PAST_FP, row.id, 3);
    const [published] = await (await getDb()).select().from(minutes).where(eq(minutes.id, row.id));
    expect(published).toMatchObject({ status: "published", version: 3, approvedVersion: 3, approvedBy: lead.id });
    expect((await listPublishedMinutes(participant)).find((m) => m.eventId === PAST_FP)?.summary).toBe("Upravil správce");
    expect(await auditActions()).toEqual(expect.arrayContaining(["minutes.edit", "minutes.approve"]));
  });

  test("participant, který není kontrolor, zápis neupraví", async () => {
    const row = await notesDraft();
    expect(await code(updateMinutes(participant, PAST_FP, row.id, 1, row.content))).toBe("forbidden");
    expect(await code(approveMinutes(participant, PAST_FP, row.id, 1))).toBe("forbidden");
  });

  test("schválení starší verze se odmítne", async () => {
    const row = await notesDraft();
    await updateMinutes(admin, PAST_FP, row.id, 1, { ...row.content, summary: "Mezitím upraveno" });
    expect(await code(approveMinutes(lead, PAST_FP, row.id, 1))).toBe("conflict");
    expect(await code(approveMinutes(lead, PAST_FP, row.id, 3))).toBe("conflict");
    // Jiný než aktuální zápis akce (např. nahrazený) schválit nejde.
    expect(await code(approveMinutes(lead, PAST_FP, "jiny-zapis", 2))).toBe("conflict");
    await approveMinutes(lead, PAST_FP, row.id, 2);
    expect(await code(approveMinutes(lead, PAST_FP, row.id, 2))).toBe("invalid_state");
  });

  test("úprava schváleného zápisu založí nový návrh, publikum dál vidí schválenou verzi (Z-01)", async () => {
    const row = await notesDraft();
    await approveMinutes(lead, PAST_FP, row.id, 1);
    expect(await updateMinutes(admin, PAST_FP, row.id, 1, row.content)).toEqual({ id: row.id, version: 1, newDraft: false });
    expect(await panelOf(participant)).toMatchObject({ access: "reader", state: "available" });

    const saved = await updateMinutes(admin, PAST_FP, row.id, 1, { ...row.content, summary: "Oprava po schválení" });
    expect(saved).toMatchObject({ version: 2, newDraft: true });
    expect(saved.id).not.toBe(row.id);
    const [old] = await (await getDb()).select().from(minutes).where(eq(minutes.id, row.id));
    expect(old).toMatchObject({ status: "published", version: 1, approvedVersion: 1 });
    // Čtenář dál vidí schválenou verzi, ne rozpracovanou opravu.
    expect(await panelOf(participant)).toMatchObject({ access: "reader", state: "available", minutes: { summary: row.content.summary } });
    expect(await panelOf(lead)).toMatchObject({ state: "review", publicMinutes: true, minutes: { id: saved.id, version: 2, approvedVersion: 1, status: "draft" } });
    expect(await auditActions()).toEqual(expect.arrayContaining(["minutes.approve", "minutes.edit_published"]));
    // Souběh: druhá úprava stejné schválené verze neprojde.
    expect(await code(updateMinutes(lead, PAST_FP, row.id, 1, { ...row.content, summary: "Jiná oprava" }))).toBe("conflict");
    // Teprve schválení vedoucím novou verzi zveřejní a starou stáhne.
    await approveMinutes(lead, PAST_FP, saved.id, 2);
    expect((await listPublishedMinutes(participant)).find((m) => m.eventId === PAST_FP)?.summary).toBe("Oprava po schválení");
    const [replaced] = await (await getDb()).select().from(minutes).where(eq(minutes.id, row.id));
    expect(replaced?.status).toBe("draft");
  });

  test("bez vedoucího zápis schválit nejde", async () => {
    const row = await notesDraft(admin);
    await setPublished(PAST_FP, { leadId: null });
    expect(await panelOf(admin)).toMatchObject({ access: "handler", hasLead: false, canApprove: false });
    expect(await code(approveMinutes(admin, PAST_FP, row.id, 1))).toBe("no_lead");
    // Bývalý vedoucí už k akci přístup nemá (není vedoucí ani kontrolor).
    expect(await code(approveMinutes(lead, PAST_FP, row.id, 1))).toBe("forbidden");
  });

  test("schválení nového zdroje stáhne dříve zveřejněný zápis, vrácení do návrhu dál funguje", async () => {
    const first = await notesDraft();
    await approveMinutes(lead, PAST_FP, first.id, 1);
    const second = await createMinutesDraft(lead, PAST_FP, { source: "file", fileName: "zapis.srt", bytes: bytes("1\n00:00:01,000 --> 00:00:02,000\nNový přepis porady.\n") }, first.id);
    // Do schválení náhrady čte publikum původní zápis.
    expect((await listPublishedMinutes(participant)).find((m) => m.eventId === PAST_FP)?.summary).toBe("Rozbor úvodní schůzky s klientem.");
    await approveMinutes(lead, PAST_FP, second, 1);
    const published = await (await getDb()).select().from(minutes).where(and(eq(minutes.eventId, PAST_FP), eq(minutes.status, "published")));
    expect(published.map((m) => m.id)).toEqual([second]);
    await withdrawMinutes(admin, PAST_FP);
    expect(await listPublishedMinutes(participant)).not.toContainEqual(expect.objectContaining({ eventId: PAST_FP }));
  });
});

describe("úkol Dokončit zápis", () => {
  test("vedoucí má jeden úkol k akci bez zápisu i s neschváleným návrhem, kontrolor kontrolu", async () => {
    const forEvent = async (viewer: Viewer) => (await listTasks(viewer)).filter((t) => t.href.includes(PAST_FP));
    expect((await forEvent(lead)).map((t) => t.action)).toEqual(["Dokončit zápis"]);
    const row = await notesDraft();
    expect((await forEvent(lead)).map((t) => [t.key, t.action])).toEqual([[`zapis-${PAST_FP}`, "Dokončit zápis"]]);
    await setPublished(PAST_FP, { reviewerId: reviewer.id });
    expect((await forEvent(reviewer)).map((t) => t.action)).toEqual(["Zkontrolovat zápis"]);
    await approveMinutes(lead, PAST_FP, row.id, 1);
    expect(await forEvent(lead)).toEqual([]);
    await updateMinutes(admin, PAST_FP, row.id, 1, { ...row.content, summary: "Po schválení" });
    expect((await forEvent(lead)).map((t) => t.action)).toEqual(["Dokončit zápis"]);
  });
});

describe("migrace 0014", () => {
  test("stávající zápisy z nahrávky zůstanou zveřejněné a označí se jako schválené ve své verzi", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const { migrations } = await import("@/server/db/migrations");
    const pg = new PGlite();
    const run = async (text: string) => {
      for (const statement of text.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await pg.exec(statement);
    };
    const index = migrations.findIndex((m) => m.id.startsWith("0014_"));
    for (const migration of migrations.slice(0, index)) await run(migration.sql);
    // Řádky ve tvaru před migrací. Vazby na akce, nahrávky a uživatele test nepotřebuje (kontrola cizích klíčů vypnutá).
    await pg.exec("SET session_replication_role = replica");
    await pg.exec(`INSERT INTO minutes (id, org_id, event_id, recording_id, job_id, transcript, content, detected_template, template_mismatch, status, version, published_by, published_at)
      VALUES ('m-pub', 'org', 'e1', 'r1', 'j1', 't', '{}', 'course', false, 'published', 3, 'u1', '2026-11-07T09:00:00Z'),
             ('m-draft', 'org', 'e2', 'r2', 'j2', 't', '{}', 'course', false, 'draft', 2, NULL, NULL)`);
    await run(migrations[index]!.sql);
    const { rows } = await pg.query<Record<string, unknown>>("SELECT id, status, source, version, approved_version, approved_by, approved_at FROM minutes ORDER BY id");
    expect(rows).toEqual([
      { id: "m-draft", status: "draft", source: "recording", version: 2, approved_version: null, approved_by: null, approved_at: null },
      { id: "m-pub", status: "published", source: "recording", version: 3, approved_version: 3, approved_by: "u1", approved_at: new Date("2026-11-07T09:00:00Z") },
    ]);
    // Zápis bez nahrávky jde uložit jen s jiným zdrojem než nahrávka (CHECK platí i bez kontroly vazeb).
    await pg.exec(`INSERT INTO minutes (id, org_id, event_id, content, detected_template, template_mismatch, status, source) VALUES ('m-text', 'org', 'e3', '{}', 'unknown', false, 'draft', 'notes')`);
    await expect(pg.exec(`INSERT INTO minutes (id, org_id, event_id, content, detected_template, template_mismatch, status) VALUES ('m-bad', 'org', 'e3', '{}', 'unknown', false, 'draft')`)).rejects.toThrow();
    await pg.close();
  });
});
