"use server";

import { after } from "next/server";
import { z } from "zod";
import { EVENT_TYPES, GROUPS } from "@/lib/types";
import { isValidDateKey, isValidMonthKey, isValidTime } from "@/lib/time";
import { audit } from "@/server/audit";
import { disconnect as disconnectCalendar } from "@/server/calendar/google-auth";
import { simulateManualEdit } from "@/server/calendar/simulated";
import { pairWithExisting, requestNewInvite, requestRetry, syncEvent, syncPublished } from "@/server/calendar/sync";
import { calendarMode } from "@/server/config";
import { getDb } from "@/server/db/client";
import { isOrganizer } from "@/server/policy";
import { resetDatabase } from "@/server/seed";
import { DomainError } from "@/server/services/errors";
import { runAction, type ActionResult } from "@/features/shared/run-action";
import {
  cancelEvent,
  createEvent,
  deleteDraft,
  discardDraftChanges,
  generateMonth,
  publishDrafts,
  updateEvent,
  updateTemplate,
  type EventInput,
} from "@/server/services/events";
import { ImpactNotConfirmed, assertImpactConfirmed, cancelImpact, changeImpact, type CancelImpact, type ChangeImpact } from "@/server/services/impact";
import {
  processTranscriptionJob,
  publishMinutes,
  retryTranscription,
  updateMinutes,
  uploadRecording,
  withdrawMinutes,
} from "@/server/services/recordings";
import { proposeTopic, setInterest, setTopicArchived, topicIdByName, updateTopic } from "@/server/services/topics";
import { SIMULATION_SWITCHES, writeSwitch } from "@/server/settings";

// Každá akce znovu ověří session a oprávnění na serveru a validuje vstup.
// Next.js u server actions navíc kontroluje Origin proti Host (ochrana proti CSRF).

export type { ActionResult } from "@/features/shared/run-action";

const run = runAction;

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));
const optionalId = z
  .string()
  .max(64)
  .transform((v) => (v === "" ? null : v));

const eventSchema = z
  .object({
    type: z.enum(EVENT_TYPES),
    label: z.string().trim().min(2).max(80),
    date: z.string().refine(isValidDateKey),
    multiDay: z.literal("on").optional(),
    endDate: z.string().optional(),
    startTime: z.string().refine(isValidTime),
    endTime: z.string().refine(isValidTime),
    topicTitle: text(120),
    audience: z.enum(GROUPS),
    leadId: optionalId,
    reviewerId: optionalId,
    intent: z.enum(["draft", "publish"]),
    allowIncomplete: z.literal("on").optional(),
    confirmToken: z.string().max(64).optional(),
  })
  .refine((v) => !v.multiDay || (v.endDate !== undefined && isValidDateKey(v.endDate) && v.endDate >= v.date));

const formObject = (formData: FormData) => Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));

async function parseEvent(formData: FormData) {
  const data = eventSchema.parse(formObject(formData));
  if (data.intent === "publish" && (!data.topicTitle || !data.leadId) && data.type !== "holiday" && !data.allowIncomplete) {
    throw new IncompleteError(
      [!data.topicTitle && "téma", !data.leadId && "vedoucí"].filter(Boolean).join(" a "),
    );
  }
  const input: EventInput = {
    type: data.type,
    label: data.label,
    date: data.date,
    endDate: data.multiDay ? (data.endDate ?? null) : null,
    startTime: data.startTime,
    endTime: data.endTime,
    topicTitle: data.topicTitle,
    topicId: await topicIdByName(await getDb(), data.topicTitle),
    audience: data.audience,
    leadId: data.leadId,
    reviewerId: data.reviewerId,
  };
  return { input, intent: data.intent, confirmToken: data.confirmToken ?? null };
}

class IncompleteError extends Error {}

const incompleteMessage = (missing: string) =>
  `Nezveřejněno, chybí ${missing}. Doplňte údaj, nebo dole zaškrtněte zveřejnění bez něj. Vyplněné hodnoty zůstaly beze změny.`;

/** Dopad změny zveřejněné akce na pozvané. Dialog ho ukáže před potvrzením. */
export async function previewImpactAction(formData: FormData): Promise<ActionResult & { impact?: ChangeImpact | null }> {
  return run(async (user) => {
    let parsed;
    try {
      parsed = await parseEvent(formData);
    } catch (error) {
      if (error instanceof IncompleteError) return { ok: false, error: incompleteMessage(error.message) };
      throw error;
    }
    const id = z.string().max(80).parse(formData.get("id"));
    return { ok: true, impact: await changeImpact(user, id, parsed.input) };
  });
}

export async function saveEventAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    let parsed;
    try {
      parsed = await parseEvent(formData);
    } catch (error) {
      if (error instanceof IncompleteError) return { ok: false, error: incompleteMessage(error.message) };
      throw error;
    }
    const { input, intent, confirmToken } = parsed;
    const id = z.string().max(80).optional().parse(formData.get("id") ?? undefined);
    if (!id) {
      const created = await createEvent(user, input, intent);
      if (intent === "publish") after(() => syncEvent(created));
      return { ok: true, id: created, message: intent === "publish" ? "Akce je zveřejněná." : "Návrh je uložený." };
    }
    const revision = z.coerce.number().int().positive().parse(formData.get("revision"));
    if (intent === "publish") {
      try {
        await assertImpactConfirmed(id, input, confirmToken);
      } catch (error) {
        if (!(error instanceof ImpactNotConfirmed)) throw error;
        return { ok: false, error: "Změna zasáhne pozvané. Zkontrolujte a potvrďte její dopad, potom ji zveřejněte." };
      }
    }
    await updateEvent(user, id, revision, input, intent);
    // Akce bez vazby (import, seed) ji dostane až tady, proto celá fronta a ne jen jedna akce.
    if (intent === "publish") after(() => syncPublished());
    return { ok: true, id, message: intent === "publish" ? "Změna je zveřejněná." : "Návrh změny je uložený." };
  });
}

export async function cancelEventAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const data = z
      .object({ id: z.string().max(80), revision: z.coerce.number().int().positive(), reason: z.string().trim().min(3).max(300) })
      .parse(formObject(formData));
    await cancelEvent(user, data.id, data.revision, data.reason);
    after(() => syncEvent(data.id));
    return { ok: true, message: "Akce je zrušená." };
  });
}

/** Koho se zrušení dotkne. Dialog zrušení to ukáže ještě před potvrzením. */
export async function previewCancelAction(id: string): Promise<ActionResult & { impact?: CancelImpact }> {
  return run(async (user) => ({ ok: true, impact: await cancelImpact(user, z.string().max(80).parse(id)) }));
}

export async function deleteDraftAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const data = z.object({ id: z.string().max(80), revision: z.coerce.number().int().positive() }).parse(formObject(formData));
    await deleteDraft(user, data.id, data.revision);
    return { ok: true, message: "Návrh je smazaný." };
  });
}

export async function discardChangesAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const data = z.object({ id: z.string().max(80), revision: z.coerce.number().int().positive() }).parse(formObject(formData));
    await discardDraftChanges(user, data.id, data.revision);
    return { ok: true, message: "Návrh změny je zahozený, platí zveřejněná verze." };
  });
}

export async function generateMonthAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const month = z.string().refine(isValidMonthKey).parse(formData.get("month"));
    const { created, withTopic } = await generateMonth(user, month);
    if (!created) return { ok: true, message: "Měsíc už má všechna místa ze šablony. Nic se nezměnilo." };
    const places = `${created} ${created === 1 ? "místo" : created < 5 ? "místa" : "míst"}`;
    const topicNote = withTopic
      ? ` U ${withTopic} ${withTopic === 1 ? "termínu" : "termínů"} je předvyplněné doporučené téma podle zájmu, před zveřejněním ho můžete změnit.`
      : "";
    return { ok: true, message: `Doplněno ${places} ze šablony. Stávající akce zůstaly beze změny.${topicNote}` };
  });
}

/** Zveřejní vybrané návrhy měsíce najednou. Pole formuláře: `pick` (ID), `rev-<id>`, `topic-<id>`, `lead-<id>`. */
export async function publishMonthAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const month = z.string().refine(isValidMonthKey).parse(formData.get("month"));
    const ids = z.array(z.string().min(1).max(80)).min(1).max(100).safeParse(formData.getAll("pick"));
    if (!ids.success) return { ok: false, error: "Vyberte aspoň jeden návrh." };
    const items = ids.data.map((id) => ({
      id,
      revision: z.coerce.number().int().positive().parse(formData.get(`rev-${id}`)),
      topicTitle: text(120).parse(formData.get(`topic-${id}`) ?? ""),
      leadId: optionalId.parse(formData.get(`lead-${id}`) ?? ""),
    }));
    const { published, skipped } = await publishDrafts(user, month, items);
    if (published.length) after(() => syncPublished());
    const skippedNote = skipped
      ? ` ${skipped} ${skipped === 1 ? "návrh mezitím někdo změnil a zůstal" : "návrhy mezitím někdo změnil a zůstaly"} beze změny, zkontrolujte je.`
      : "";
    if (!published.length) return { ok: false, error: `Nic se nezveřejnilo.${skippedNote}` };
    const count = `${published.length} ${published.length === 1 ? "akce" : published.length < 5 ? "akce" : "akcí"}`;
    return { ok: true, message: `Zveřejněno: ${count}. Pozvánky do Kalendáře se odesílají.${skippedNote}` };
  });
}

const templateSchema = z.array(
  z.object({
    isoWeekday: z.number().int().min(1).max(7),
    startTime: z.string().refine(isValidTime),
    endTime: z.string().refine(isValidTime),
    types: z.array(z.enum(EVENT_TYPES)).min(1).max(4),
    active: z.boolean(),
  }),
);

export async function updateTemplateAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const weekdays = formData.getAll("weekday").map(Number);
    const slots = templateSchema.parse(
      weekdays.map((day) => ({
        isoWeekday: day,
        startTime: formData.get(`start-${day}`),
        endTime: formData.get(`end-${day}`),
        types: formData.getAll(`types-${day}`),
        active: formData.get(`active-${day}`) === "on",
      })),
    );
    await updateTemplate(user, slots);
    return { ok: true, message: "Šablona je uložená. Projeví se při dalším generování." };
  });
}

// ——— Kalendář ———

const eventIdSchema = z.object({ id: z.string().max(80) });

export async function retrySyncAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const { id } = eventIdSchema.parse(formObject(formData));
    const force = formData.get("force") === "on";
    await requestRetry(user, id);
    if (force) await audit(await getDb(), user.id, "calendar.overwrite_external", "event", id);
    after(() => syncEvent(id, { force }));
    return { ok: true, message: force ? "Pozvánka se přepíše hodnotami z Wiki." : "Synchronizace běží znovu." };
  });
}

export async function createInviteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const { id } = eventIdSchema.parse(formObject(formData));
    await requestNewInvite(user, id);
    after(() => syncEvent(id));
    return { ok: true, message: "Pozvánka se vytváří." };
  });
}

export async function pairInviteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const data = z.object({ id: z.string().max(80), externalId: z.string().max(80) }).parse(formObject(formData));
    await pairWithExisting(user, data.id, data.externalId);
    after(() => syncEvent(data.id));
    return { ok: true, message: "Akce je spárovaná s existující pozvánkou." };
  });
}

// ——— Nahrávky a zápisy ———

export async function uploadRecordingAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const { id } = eventIdSchema.parse({ id: formData.get("id") });
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Vyberte soubor s nahrávkou." };
    const jobId = await uploadRecording(user, id, file);
    after(() => processTranscriptionJob(jobId));
    return { ok: true, message: "Nahrávka je uložená a zpracovává se." };
  });
}

export async function retryTranscriptionAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const { id } = eventIdSchema.parse(formObject(formData));
    const jobId = await retryTranscription(user, id);
    after(() => processTranscriptionJob(jobId));
    return { ok: true, message: "Zpracování běží znovu." };
  });
}

const lines = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export async function saveMinutesAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const data = z
      .object({
        id: z.string().max(80),
        minutesId: z.string().max(80),
        version: z.coerce.number().int().positive(),
        intent: z.enum(["save", "publish"]),
      })
      .parse(formObject(formData));
    await updateMinutes(user, data.id, data.minutesId, data.version, {
      summary: String(formData.get("summary") ?? "").trim(),
      keyPoints: lines(formData.get("keyPoints")),
      decisions: lines(formData.get("decisions")),
      nextSteps: lines(formData.get("nextSteps")),
    });
    if (data.intent === "publish") {
      await publishMinutes(user, data.id, data.minutesId, data.version + 1);
      after(() => syncEvent(data.id));
    }
    return { ok: true, message: data.intent === "publish" ? "Zápis je zveřejněný pro publikum akce." : "Úpravy zápisu jsou uložené." };
  });
}

export async function withdrawMinutesAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const { id } = eventIdSchema.parse(formObject(formData));
    await withdrawMinutes(user, id);
    after(() => syncEvent(id));
    return { ok: true, message: "Zápis je stažený. Kolegové ho nevidí, dokud ho znovu nezveřejníte." };
  });
}

// ——— Témata ———

export async function toggleInterestAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const data = z.object({ topicId: z.string().max(80), interested: z.enum(["true", "false"]) }).parse(formObject(formData));
    await setInterest(user, data.topicId, data.interested === "true");
    return { ok: true };
  });
}

export async function proposeTopicAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const data = z
      .object({ name: z.string().trim().min(3).max(120), audience: z.enum(GROUPS) })
      .parse(formObject(formData));
    await proposeTopic(user, data.name, data.audience);
    return { ok: true, message: "Téma je přidané a máte u něj označený zájem." };
  });
}

export async function updateTopicAction(formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const data = z
      .object({ topicId: z.string().max(80), name: z.string().trim().min(3).max(120), audience: z.enum(GROUPS) })
      .parse(formObject(formData));
    await updateTopic(user, data.topicId, data.name, data.audience);
    return { ok: true, message: "Téma je upravené." };
  });
}

export async function archiveTopicAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    const data = z.object({ topicId: z.string().max(80), archived: z.enum(["true", "false"]) }).parse(formObject(formData));
    await setTopicArchived(user, data.topicId, data.archived === "true");
    return { ok: true };
  });
}

// ——— Ukázkové přepínače (jen organizátor) ———

export async function setSimulationAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    if (!isOrganizer(user)) throw new DomainError("forbidden");
    const data = z.object({ key: z.enum(SIMULATION_SWITCHES), value: z.enum(["true", "false"]) }).parse(formObject(formData));
    const db = await getDb();
    await writeSwitch(db, data.key, data.value === "true");
    await audit(db, user.id, `simulation.${data.key}.${data.value}`, "settings", data.key);
    return { ok: true };
  });
}

export async function simulateManualEditAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async (user) => {
    if (!isOrganizer(user)) throw new DomainError("forbidden");
    // Nástroj ukázky existuje jen nad simulací, skutečný kalendář se takto nemění.
    if (calendarMode() !== "simulation") throw new DomainError("invalid_state");
    const data = z.object({ externalId: z.string().max(80) }).parse(formObject(formData));
    await simulateManualEdit(await getDb(), data.externalId);
    return { ok: true, message: "V simulovaném Kalendáři se změnil název pozvánky." };
  });
}

/** Odpojí Google Kalendář: zneplatní token u Googlu a smaže uložený šifrovaný záznam. */
export async function disconnectCalendarAction(): Promise<ActionResult> {
  return run(async (user) => {
    if (!isOrganizer(user)) throw new DomainError("forbidden");
    const db = await getDb();
    await disconnectCalendar(db);
    await audit(db, user.id, "calendar.disconnected", "settings", "google-calendar");
    return { ok: true, message: "Google Kalendář je odpojený." };
  });
}

export async function resetDemoAction(): Promise<ActionResult> {
  return run(async (user) => {
    if (!isOrganizer(user)) throw new DomainError("forbidden");
    const db = await getDb();
    await db.transaction(async (tx) => {
      await resetDatabase(tx);
      await audit(tx, user.id, "demo.reset", "settings", "all");
    });
    // Zveřejněné ukázkové akce dostanou pozvánky hned, ne až při další návštěvě Plánu.
    after(() => syncPublished());
    return { ok: true, message: "Ukázková data jsou obnovená do výchozího stavu." };
  });
}
