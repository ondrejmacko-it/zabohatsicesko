import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getDb } from "@/server/db/client";
import { events, minutes, users } from "@/server/db/schema";
import { assertNoTraining, AiDataUseError } from "@/server/integrations/ai-data-use";
import { minutesDrafter } from "@/server/integrations/minutes-drafter";
import { minutesTaskRole, type Viewer } from "@/server/policy";
import { REDACTED_NAME, redactClientData, redactMinutes } from "@/server/recordings/redaction";
import { pastedTextKind } from "@/server/recordings/text-source";
import { transcriptionProvider } from "@/server/recordings/transcription";
import { DomainError } from "@/server/services/errors";
import { loadEventRow } from "@/server/services/events";
import { listTasks } from "@/server/services/journey";
import { createMinutesDraft, processTranscriptionJob, recordingPanel, uploadRecording } from "@/server/services/recordings";
import { PAST_FP, admin, asFile, fixtureWav, lead, organizer, participant, resetDemo } from "./helpers";

beforeEach(resetDemo);
afterEach(() => vi.unstubAllEnvs());

/** Kontrolor akce: kolega ze skupiny FP (účet účastníka), kterého správce k akci přiřadil. */
const reviewer: Viewer = { id: "demo-ucastnik", role: "member", groups: ["vsichni", "fp"] };

async function setPublished(eventId: string, patch: { reviewerId?: string | null; leadId?: string | null }) {
  const db = await getDb();
  const row = (await loadEventRow(db, eventId))!;
  await db.update(events).set({ published: { ...row.published!, ...patch } }).where(eq(events.id, eventId));
}

const code = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "ok";
  } catch (e) {
    return e instanceof DomainError ? e.code : String(e);
  }
};

const panelOf = async (viewer: Viewer) => recordingPanel(viewer, (await loadEventRow(await getDb(), PAST_FP))!);
const tasksFor = async (viewer: Viewer) => (await listTasks(viewer)).filter((t) => t.href.includes(PAST_FP));

describe("F13: kdo zápis schvaluje a kdo má úkol ho napsat", () => {
  test("panel říká, kdo schvaluje: vedoucí sám sebe, ostatní jménem vedoucího", async () => {
    const [leadUser] = await (await getDb()).select({ name: users.name }).from(users).where(eq(users.id, lead.id));
    expect(await panelOf(lead)).toMatchObject({ access: "handler", canApprove: true, approverName: leadUser!.name });
    expect(await panelOf(admin)).toMatchObject({ access: "handler", canApprove: false, approverName: leadUser!.name });
    await setPublished(PAST_FP, { leadId: null });
    expect(await panelOf(admin)).toMatchObject({ access: "handler", canApprove: false, approverName: null, hasLead: false });
  });

  test("úkol napsat zápis má vedoucí, ne účastník ani kontrolor; kontrolor jen kontrolu hotového návrhu", async () => {
    await setPublished(PAST_FP, { reviewerId: reviewer.id });
    expect((await tasksFor(lead)).map((t) => t.action)).toEqual(["Připravit zápis"]);
    expect(await tasksFor(reviewer)).toEqual([]);
    expect(await tasksFor(participant)).toEqual([]);
    // Správce má u akce s vedoucím zápis jen v „Zápisy k dokončení“, úkol ne.
    expect(await tasksFor(admin)).toEqual([]);

    await createMinutesDraft(lead, PAST_FP, { source: "notes", text: "Shrnutí: Rozbor schůzky." }, null);
    expect((await tasksFor(reviewer)).map((t) => t.action)).toEqual(["Zkontrolovat zápis"]);
    expect((await tasksFor(lead)).map((t) => t.detail)).toEqual(["Návrh zápisu čeká na tvoje schválení. Zveřejní se až po schválení."]);
  });

  test("akce bez vedoucího: úkol napsat zápis má správce, u hotového návrhu doplnit vedoucího", async () => {
    await setPublished(PAST_FP, { leadId: null, reviewerId: reviewer.id });
    expect((await tasksFor(admin)).map((t) => t.action)).toEqual(["Připravit zápis"]);
    expect((await tasksFor(organizer)).map((t) => t.action)).toEqual(["Připravit zápis"]);
    expect(await tasksFor(reviewer)).toEqual([]);
    await createMinutesDraft(admin, PAST_FP, { source: "notes", text: "Shrnutí: Rozbor schůzky." }, null);
    expect((await tasksFor(admin)).map((t) => t.action)).toEqual(["Přiřadit vedoucího"]);
  });

  test("pravidlo minutesTaskRole", () => {
    const snapshot = (leadId: string | null, reviewerId: string | null) => ({ leadId, reviewerId }) as Parameters<typeof minutesTaskRole>[1];
    expect(minutesTaskRole(lead, snapshot(lead.id, null))).toBe("write");
    expect(minutesTaskRole(admin, snapshot(lead.id, null))).toBeNull();
    expect(minutesTaskRole(admin, snapshot(null, null))).toBe("write");
    expect(minutesTaskRole(participant, snapshot(null, null))).toBeNull();
    expect(minutesTaskRole(reviewer, snapshot(lead.id, reviewer.id))).toBe("review");
  });
});

describe("F14: méně voleb, nahrávka skrytá, dokud nefunguje", () => {
  test("bez RECORDING_DEMO je nahrávání skryté i odmítnuté serverem", async () => {
    vi.stubEnv("RECORDING_DEMO", "");
    expect(await panelOf(lead)).toMatchObject({ access: "handler", canUpload: false });
    expect(await code(uploadRecording(lead, PAST_FP, asFile(fixtureWav(), "trenink.wav")))).toBe("recording_disabled");
    // Úkol nezmiňuje nahrávku, kterou nejde nahrát.
    expect((await tasksFor(lead)).map((t) => t.detail)).toEqual(["Proběhla a nemá zápis. Vlož přepis nebo poznámky, nebo nahraj soubor."]);
  });

  test("ostrá Wiki nahrávání nezapne ani s RECORDING_DEMO=on", async () => {
    vi.stubEnv("RECORDING_DEMO", "on");
    const { recordingUploadEnabled } = await import("@/server/config");
    expect(recordingUploadEnabled()).toBe(true);
    vi.stubEnv("WIKI_MODE", "production");
    expect(recordingUploadEnabled()).toBe(false);
  });

  test("jedno pole: přepis s mluvčími je přepis, jinak poznámky", () => {
    expect(pastedTextKind("Anna: Dobrý den.\nPetr: Začneme rozborem.\nAnna: Souhlasím.")).toBe("transcript");
    expect(pastedTextKind("Shrnutí: Rozbor.\nHlavní body:\n- bod\nDalší kroky: Petr pošle šablonu.")).toBe("notes");
    expect(pastedTextKind("Jen pár poznámek bez struktury.")).toBe("notes");
  });
});

describe("F15: jména klientů vynechat, AI bez trénování", () => {
  const TEXT = [
    "Shrnutí: Rozbor schůzky s klientkou Janou Novou.",
    "Hlavní body:",
    "- Klientka Jana Nová chce hypotéku, tel. +420 603 123 456, jana.nova@example.com.",
    "- Pan Dvořák poslal číslo účtu 123456789/0800 a rodné číslo 850101/1234.",
    "- Martin Procházka je zájemce o investice.",
    "Další kroky:",
    "- Petr pošle šablonu do pátku.",
  ].join("\n");

  test("vynechá jména a kontakty klientů, kolegy a samotná křestní jména nechá", () => {
    const { text, count } = redactClientData(TEXT, ["Klára Veselá"]);
    for (const secret of ["Novou", "Jana Nová", "Dvořák", "603 123 456", "jana.nova@example.com", "123456789/0800", "850101/1234", "Procházka"]) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain(`klientkou ${REDACTED_NAME}`);
    expect(text).toContain("[telefon]");
    expect(text).toContain("[e-mail]");
    expect(text).toContain("[číslo účtu]");
    expect(text).toContain("[rodné číslo]");
    expect(text).toContain("Petr pošle šablonu");
    expect(count).toBe(8);
    expect(redactClientData("Klára Veselá doplní seznam. Klientka Klára Veselá ne.", ["Klára Veselá"]).text).toBe(
      "Klára Veselá doplní seznam. Klientka Klára Veselá ne.",
    );
    expect(redactMinutes({ summary: "S panem Novákem", keyPoints: ["Jan Novák"], decisions: [], nextSteps: [] })).toEqual({
      summary: `S panem ${REDACTED_NAME}`,
      keyPoints: [REDACTED_NAME],
      decisions: [],
      nextSteps: [],
    });
  });

  test("návrh zápisu ani uložený pracovní text jména klientů neobsahují", async () => {
    const id = await createMinutesDraft(lead, PAST_FP, { source: "notes", text: TEXT }, null);
    const [row] = await (await getDb()).select().from(minutes).where(eq(minutes.id, id));
    const stored = JSON.stringify(row!.content) + row!.transcript;
    for (const secret of ["Nová", "Novou", "Dvořák", "603 123 456", "example.com", "Procházka"]) expect(stored).not.toContain(secret);
    expect(row!.content.nextSteps).toEqual(["Petr pošle šablonu do pátku."]);
  });

  test("ukázková nahrávka projde beze změny (žádné jméno klienta)", async () => {
    const jobId = await uploadRecording(lead, PAST_FP, asFile(fixtureWav(), "trenink.wav"));
    await processTranscriptionJob(jobId);
    expect(await panelOf(lead)).toMatchObject({ state: "review", minutes: { source: "recording" } });
  });

  test("služby návrhu i přepisu mají zákaz trénování, jiná služba se nevybere", () => {
    expect(minutesDrafter().dataUse).toEqual({ training: "never", retention: "none" });
    expect(transcriptionProvider().dataUse).toEqual({ training: "never", retention: "none" });
    const trains = { dataUse: { training: "allowed", retention: "none" } } as unknown as Parameters<typeof assertNoTraining>[1];
    expect(() => assertNoTraining("test", trains)).toThrow(AiDataUseError);
    const missing = {} as unknown as Parameters<typeof assertNoTraining>[1];
    expect(() => assertNoTraining("test", missing)).toThrow(AiDataUseError);
  });
});
