import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { eventTitle } from "@/lib/labels";
import { minutesStarted } from "@/lib/minutes";
import { formatDayMonth, toDateKey } from "@/lib/time";
import type { EventType, Group } from "@/lib/types";
import { needsCalendarConnection } from "@/server/calendar/google-auth";
import { config, now, recordingUploadEnabled } from "@/server/config";
import { getDb } from "@/server/db/client";
import { calendarLinks, events, minutes, recordings, topics, transcriptionJobs, users } from "@/server/db/schema";
import { canHandleRecording, canManageUsers, canReadPublishedMinutes, isOrganizer, minutesTaskRole, type Viewer } from "@/server/policy";
import { pendingRequestCount } from "@/server/services/users";

// Čtecí pohledy pro stránky Plán a Zápisy. Přístup rozhoduje policy.ts u každého řádku.

export type MinutesItem = {
  eventId: string;
  title: string;
  type: EventType;
  audience: Group;
  startsAt: string;
  publishedAt: string | null;
  summary: string;
};

export type MinutesFilter = { query?: string; type?: string; audience?: string };

/** Porovnání bez ohledu na velikost písmen a diakritiku („skoleni“ najde „Školení“). */
const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Zveřejněné zápisy, které uživatel smí číst (publikum akce, vedoucí, kontrolor), nejnovější první. */
export async function listPublishedMinutes(viewer: Viewer, filter: MinutesFilter = {}): Promise<MinutesItem[]> {
  const db = await getDb();
  const rows = await db
    .select({ event: events, content: minutes.content, publishedAt: minutes.publishedAt })
    .from(minutes)
    .innerJoin(events, eq(events.id, minutes.eventId))
    .where(and(eq(events.orgId, config.orgId), eq(minutes.status, "published")))
    .orderBy(desc(events.startsAt), desc(minutes.publishedAt));
  // Po výměně nahrávky zůstává starší zveřejněný zápis, dokud vedoucí neschválí nový. U akce platí nejnovější.
  const seen = new Set<string>();
  const needle = fold(filter.query?.trim() ?? "");
  return rows
    .filter(({ event }) => canReadPublishedMinutes(viewer, event) && !seen.has(event.id) && Boolean(seen.add(event.id)))
    .map(({ event, content, publishedAt }) => {
      const snapshot = event.published!;
      const title = eventTitle(snapshot.label, snapshot.topicTitle);
      const haystack = fold([title, content.summary, ...content.keyPoints, ...content.decisions, ...content.nextSteps].join("\n"));
      return {
        item: {
          eventId: event.id,
          title,
          type: snapshot.type,
          audience: snapshot.audience,
          startsAt: snapshot.startsAt,
          publishedAt: publishedAt?.toISOString() ?? null,
          summary: content.summary,
        },
        haystack,
      };
    })
    .filter(({ item, haystack }) => (!needle || haystack.includes(needle)) && (!filter.type || item.type === filter.type) && (!filter.audience || item.audience === filter.audience))
    .map(({ item }) => item);
}

export type MissingMinutesItem = {
  eventId: string;
  title: string;
  type: EventType;
  startsAt: string;
  leadName: string | null;
  /** Rozpracovaný stav aktuální nahrávky, stejný jako v úkolech Plánu a v detailu akce. */
  state: Exclude<RecordingProgress, "published">;
  /** Uživatel smí nahrát záznam a zápis zveřejnit (vedoucí, kontrolor, správce). */
  canHandle: boolean;
};

/**
 * Stav aktuální (nevyměněné) nahrávky akce. `failed` = služba přepisu selhala, pomůže nový pokus.
 * `unsupported` = soubor nejde přepsat, pomůže jen jiná nahrávka. `started` = prázdná šablona ručního zápisu,
 * `draft` = návrh s obsahem čeká na schválení. Bez záznamu v mapě akce nahrávku nemá.
 */
export type RecordingProgress = "none" | "processing" | "failed" | "unsupported" | "started" | "draft" | "published";

export function progressOf(minutesStatus: string | null, jobStatus: string | null, errorCode: string | null, started = true): RecordingProgress {
  if (minutesStatus) return minutesStatus === "published" ? "published" : started ? "draft" : "started";
  if (jobStatus === "failed") return errorCode === "unsupported_fixture" ? "unsupported" : "failed";
  return "processing";
}

/**
 * Stav zápisu podle akce. Aktuální zápis (nejnovější, který nepatří k vyměněné nahrávce, i bez nahrávky)
 * má přednost, bez něj rozhoduje úloha přepisu aktuální nahrávky.
 */
async function recordingProgressByEvent(db: Awaited<ReturnType<typeof getDb>>): Promise<Map<string, RecordingProgress>> {
  const [recordingRows, minutesRows] = await Promise.all([
    db
      .select({ eventId: recordings.eventId, jobStatus: transcriptionJobs.status, errorCode: transcriptionJobs.errorCode })
      .from(recordings)
      .leftJoin(transcriptionJobs, eq(transcriptionJobs.recordingId, recordings.id))
      .where(and(eq(recordings.orgId, config.orgId), isNull(recordings.supersededAt))),
    db
      .select({ eventId: minutes.eventId, status: minutes.status, content: minutes.content })
      .from(minutes)
      .leftJoin(recordings, eq(recordings.id, minutes.recordingId))
      .where(and(eq(minutes.orgId, config.orgId), or(isNull(minutes.recordingId), isNull(recordings.supersededAt))))
      .orderBy(desc(minutes.createdAt), desc(minutes.id)),
  ]);
  const progress = new Map(recordingRows.map((r) => [r.eventId, progressOf(null, r.jobStatus, r.errorCode)]));
  const seen = new Set<string>();
  for (const row of minutesRows) {
    if (seen.has(row.eventId)) continue;
    seen.add(row.eventId);
    progress.set(row.eventId, progressOf(row.status, null, null, minutesStarted(row.content)));
  }
  return progress;
}

/**
 * Proběhlé zveřejněné akce bez zveřejněného zápisu, nejnovější první. Vedoucí a kontrolor vidí ty své,
 * správce všechny a u všech smí nahrát záznam i zápis zveřejnit.
 * `handlesAny`: uživatel u nějaké proběhlé akce zápis řeší, i kdyby už měl vše hotovo.
 */
export async function listMissingMinutes(viewer: Viewer): Promise<{ items: MissingMinutesItem[]; handlesAny: boolean }> {
  const db = await getDb();
  const reference = now();
  const past = await db
    .select()
    .from(events)
    .where(and(eq(events.orgId, config.orgId), sql`(${events.published}->>'endsAt')::timestamptz < ${reference.toISOString()}::timestamptz`))
    .orderBy(desc(events.startsAt));
  const organizer = isOrganizer(viewer);
  const held = past.filter((row) => row.published?.status === "published" && row.published.type !== "holiday");
  const handled = new Set(held.filter((row) => canHandleRecording(viewer, row)).map((row) => row.id));
  const visible = held.filter((row) => organizer || handled.has(row.id));
  if (!visible.length) return { items: [], handlesAny: handled.size > 0 };
  const [byEvent, people] = await Promise.all([
    recordingProgressByEvent(db),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.orgId, config.orgId)),
  ]);
  const names = new Map(people.map((u) => [u.id, u.name]));
  const items = visible
    .filter((row) => byEvent.get(row.id) !== "published")
    .map((row) => {
      const snapshot = row.published!;
      const state = byEvent.get(row.id) ?? "none";
      return {
        eventId: row.id,
        title: eventTitle(snapshot.label, snapshot.topicTitle),
        type: snapshot.type,
        startsAt: snapshot.startsAt,
        leadName: snapshot.leadId ? (names.get(snapshot.leadId) ?? null) : null,
        state: state as MissingMinutesItem["state"],
        canHandle: handled.has(row.id),
      };
    });
  return { items, handlesAny: handled.size > 0 };
}

/** Nejnovější proběhlé akce bez zápisu. Starší dluhy by přehled zahltily, jsou dohledatelné v harmonogramu. */
const MAX_MINUTES_TASKS = 4;

/** Úkol podle stavu nahrávky. Text i tlačítko odpovídají tomu, co ukazuje detail akce. */
const MINUTES_TASKS: Record<Exclude<RecordingProgress, "published">, { detail: string; action: string }> = {
  none: { detail: "Proběhla a nemá zápis. Vlož přepis nebo poznámky, nebo nahraj soubor.", action: "Dokončit zápis" },
  processing: { detail: "Nahrávka se přepisuje. Návrh zápisu bude za chvíli ke kontrole.", action: "Zobrazit stav" },
  failed: { detail: "Přepis nahrávky se nepovedl. Zkus ho znovu.", action: "Zkusit přepis znovu" },
  unsupported: { detail: "Ukázkový přepis tento soubor nepřepíše, umí jen ukázkovou nahrávku.", action: "Vybrat jinou nahrávku" },
  started: { detail: "Zápis je založený, ale zatím prázdný. Doplň ho a ulož.", action: "Dokončit zápis" },
  draft: { detail: "Návrh zápisu čeká na kontrolu. Zveřejní ho vedoucí akce.", action: "Zkontrolovat zápis" },
};

/** S ukázkou nahrávky (F14) úkol nahrávku zmíní, bez ní ne. */
const NONE_WITH_RECORDING = { detail: "Proběhla a nemá zápis. Připrav ho z nahrávky, přepisu nebo poznámek.", action: "Dokončit zápis" };

/** Vedoucí akce zápis schvaluje, proto má vlastní úkol „Dokončit zápis“ místo kontroly. */
const LEAD_DRAFT_TASK = { detail: "Návrh zápisu čeká na tvoje schválení. Zveřejní se až po schválení.", action: "Dokončit zápis" };

/** Správce u akce bez vedoucího: návrh nemá kdo schválit (F13). */
const NO_LEAD_DRAFT_TASK = { detail: "Návrh zápisu je hotový, ale akce nemá vedoucího, který ho schválí. Doplň vedoucího.", action: "Doplnit vedoucího" };

/** `external`: odkaz vede mimo stránky Wiki (přesměrování na Google), proto běžná navigace prohlížeče. */
/** `eventType`: úkol patří ke konkrétní akci, filtr Typ akce na Plánu ho podle něj schová nebo nechá. */
export type JourneyTask = { key: string; title: string; detail: string; href: string; action: string; external?: boolean; eventType?: EventType };

/**
 * Co na uživatele čeká: zápisy k dokončení u akcí, které vede (správce u akcí bez vedoucího), kontrola návrhů
 * u akcí, které kontroluje, a úkoly správce.
 * Správce smí zápis řešit u každé akce, mezi úkoly ale dostává jen ty své. Ostatní má v „Přidat zápis“.
 */
export async function listTasks(viewer: Viewer): Promise<JourneyTask[]> {
  const db = await getDb();
  const tasks: JourneyTask[] = [];
  const reference = now();

  const past = await db
    .select()
    .from(events)
    .where(and(eq(events.orgId, config.orgId), sql`(${events.published}->>'endsAt')::timestamptz < ${reference.toISOString()}::timestamptz`))
    .orderBy(desc(events.startsAt));
  // F13: úkol k zápisu má vedoucí (u akce bez vedoucího správce), kontrolor jen kontrolu hotového návrhu.
  const handled = past.flatMap((row) => {
    const snapshot = row.published;
    if (snapshot?.status !== "published" || snapshot.type === "holiday") return [];
    const role = minutesTaskRole(viewer, snapshot);
    return role ? [{ row, snapshot, role }] : [];
  });
  if (handled.length) {
    const byEvent = await recordingProgressByEvent(db);
    const canUpload = recordingUploadEnabled();
    for (const { row, snapshot, role } of handled) {
      const state = byEvent.get(row.id) ?? "none";
      if (state === "published") continue;
      if (role === "review" && state !== "draft") continue;
      // Datum v názvu: stejně pojmenované akce se opakují každý týden.
      const title = `${eventTitle(snapshot.label, snapshot.topicTitle)} · ${formatDayMonth(toDateKey(new Date(snapshot.startsAt)))}`;
      if (tasks.length >= MAX_MINUTES_TASKS) break;
      const today = toDateKey(new Date(snapshot.endsAt)) === toDateKey(reference);
      const href = `/vzdelavani/akce/${row.id}?odkud=prehled#nahravka`;
      const base = { href, eventType: snapshot.type };
      if (today && state === "none" && canUpload) {
        tasks.push({ ...base, key: `nahravka-${row.id}`, title: "Nahraj nahrávku z dnešní akce", detail: `${title}. Zápis se z nahrávky připraví sám, ty ho jen zkontroluješ.`, action: "Nahrát nahrávku" });
        continue;
      }
      const task =
        state === "draft"
          ? snapshot.leadId === viewer.id
            ? LEAD_DRAFT_TASK
            : snapshot.leadId === null
              ? NO_LEAD_DRAFT_TASK
              : MINUTES_TASKS.draft
          : state === "none" && canUpload
            ? NONE_WITH_RECORDING
            : MINUTES_TASKS[state];
      tasks.push({ ...base, ...task, key: `${state === "draft" || state === "started" ? "zapis" : "nahravka"}-${row.id}`, title });
    }
  }

  if (await needsCalendarConnection(db, isOrganizer(viewer))) {
    tasks.unshift({ key: "kalendar-propojeni", title: "Propoj Kalendář Google", detail: "Bez propojení se pozvánky neposílají. Stačí jednou potvrdit souhlas u Googlu.", href: "/api/google/kalendar/pripojit?auto=1", action: "Propojit Kalendář", external: true });
  }
  if (isOrganizer(viewer)) {
    const stuck = await db
      .select({ event: events })
      .from(calendarLinks)
      .innerJoin(events, eq(events.id, calendarLinks.eventId))
      .where(and(eq(events.orgId, config.orgId), eq(calendarLinks.syncStatus, "attention")));
    for (const { event } of stuck) {
      tasks.push({ key: `kalendar-${event.id}`, title: event.published?.label ?? "Akce", detail: "Pozvánka v Kalendáři neodpovídá Wiki a čeká na tvůj zásah.", href: `/vzdelavani/akce/${event.id}?odkud=prehled#kalendar`, action: "Vyřešit pozvánku", eventType: event.published?.type });
    }
    // Bez garantovaných témat doporučení i doplnění měsíce vychází jen ze zájmu. Úkol zmizí po nastavení prvního.
    const [topicState] = await db
      .select({ active: sql<number>`count(*)::int`, guaranteed: sql<number>`count(${topics.priorityRank})::int` })
      .from(topics)
      .where(and(eq(topics.orgId, config.orgId), isNull(topics.archivedAt)));
    if (topicState && Number(topicState.active) > 0 && Number(topicState.guaranteed) === 0) {
      tasks.push({ key: "garantovana-temata", title: "Nastav garantovaná témata", detail: "Vyber témata, která se mají probrat přednostně. Počet garantovaných témat není omezený.", href: "/vzdelavani/temata", action: "Vybrat témata" });
    }
  }
  if (canManageUsers(viewer)) {
    const requests = await pendingRequestCount(db, viewer);
    if (requests > 0) {
      tasks.push({ key: "zadosti", title: `Žádosti o přístup: ${requests}`, detail: "Noví kolegové čekají na přidělení role a skupin.", href: "/sprava#zadosti", action: "Projít žádosti" });
    }
  }
  return tasks;
}
