import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { formatDayMonth, toDateKey } from "@/lib/time";
import type { EventType, Group } from "@/lib/types";
import { needsCalendarConnection } from "@/server/calendar/google-auth";
import { config, now } from "@/server/config";
import { getDb } from "@/server/db/client";
import { calendarLinks, events, minutes, recordings, users } from "@/server/db/schema";
import { canHandleRecording, canManageUsers, canReadPublishedMinutes, isEventHandler, isOrganizer, type Viewer } from "@/server/policy";
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
      const title = snapshot.topicTitle ? `${snapshot.label}: ${snapshot.topicTitle}` : snapshot.label;
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
  /** Rozpracovaný stav: návrh zápisu čeká na kontrolu, nebo se nahrávka teprve zpracovává. */
  state: "none" | "draft" | "processing";
  /** Uživatel smí nahrát záznam a zápis zveřejnit (vedoucí, kontrolor, správce). */
  canHandle: boolean;
};

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
  const [states, people] = await Promise.all([
    db
      .select({ eventId: recordings.eventId, minutesStatus: minutes.status })
      .from(recordings)
      .leftJoin(minutes, eq(minutes.recordingId, recordings.id))
      .where(isNull(recordings.supersededAt)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.orgId, config.orgId)),
  ]);
  const byEvent = new Map(states.map((s) => [s.eventId, s.minutesStatus]));
  const names = new Map(people.map((u) => [u.id, u.name]));
  const items = visible
    .filter((row) => byEvent.get(row.id) !== "published")
    .map((row) => {
      const snapshot = row.published!;
      const status = byEvent.get(row.id);
      return {
        eventId: row.id,
        title: snapshot.topicTitle ? `${snapshot.label}: ${snapshot.topicTitle}` : snapshot.label,
        type: snapshot.type,
        startsAt: snapshot.startsAt,
        leadName: snapshot.leadId ? (names.get(snapshot.leadId) ?? null) : null,
        state: status === "draft" ? ("draft" as const) : byEvent.has(row.id) ? ("processing" as const) : ("none" as const),
        canHandle: handled.has(row.id),
      };
    });
  return { items, handlesAny: handled.size > 0 };
}

/** Nejnovější proběhlé akce bez zápisu. Starší dluhy by přehled zahltily, jsou dohledatelné v harmonogramu. */
const MAX_MINUTES_TASKS = 4;

/** `external`: odkaz vede mimo stránky Wiki (přesměrování na Google), proto běžná navigace prohlížeče. */
/** `eventType`: úkol patří ke konkrétní akci, filtr Typ akce na Plánu ho podle něj schová nebo nechá. */
export type JourneyTask = { key: string; title: string; detail: string; href: string; action: string; external?: boolean; eventType?: EventType };

/**
 * Co na uživatele čeká: zápisy k dokončení u akcí, které vede nebo kontroluje, a úkoly správce.
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
  const handled = past.filter((row) => row.published?.status === "published" && row.published.type !== "holiday" && isEventHandler(viewer, row.published));
  if (handled.length) {
    const states = await db
      .select({ eventId: minutes.eventId, status: minutes.status })
      .from(minutes)
      .innerJoin(recordings, and(eq(recordings.id, minutes.recordingId), isNull(recordings.supersededAt)));
    const byEvent = new Map(states.map((s) => [s.eventId, s.status]));
    for (const row of handled) {
      const state = byEvent.get(row.id);
      if (state === "published") continue;
      const snapshot = row.published!;
      // Datum v názvu: stejně pojmenované akce se opakují každý týden.
      const title = `${snapshot.topicTitle ? `${snapshot.label}: ${snapshot.topicTitle}` : snapshot.label} · ${formatDayMonth(toDateKey(new Date(snapshot.startsAt)))}`;
      if (tasks.length >= MAX_MINUTES_TASKS) break;
      const today = toDateKey(new Date(snapshot.endsAt)) === toDateKey(reference);
      if (today && state !== "draft") {
        tasks.push({ key: `nahravka-${row.id}`, title: "Nahrajte audio z dnešní akce", detail: `${title}. Zápis se z nahrávky připraví sám, vy ho jen zkontrolujete.`, href: `/vzdelavani/akce/${row.id}?odkud=prehled#nahravka`, action: "Nahrát audio", eventType: snapshot.type });
        continue;
      }
      tasks.push(
        state === "draft"
          ? { key: `zapis-${row.id}`, title, detail: "Návrh zápisu čeká na kontrolu a zveřejnění.", href: `/vzdelavani/akce/${row.id}?odkud=prehled#nahravka`, action: "Zkontrolovat zápis", eventType: snapshot.type }
          : { key: `nahravka-${row.id}`, title, detail: "Proběhla a nemá zápis. Připraví se z nahrávky.", href: `/vzdelavani/akce/${row.id}?odkud=prehled#nahravka`, action: "Nahrát nahrávku", eventType: snapshot.type },
      );
    }
  }

  if (await needsCalendarConnection(db, isOrganizer(viewer))) {
    tasks.unshift({ key: "kalendar-propojeni", title: "Propojte Kalendář Google", detail: "Bez propojení se pozvánky neposílají. Stačí jednou potvrdit souhlas u Googlu.", href: "/api/google/kalendar/pripojit?auto=1", action: "Propojit Kalendář", external: true });
  }
  if (isOrganizer(viewer)) {
    const stuck = await db
      .select({ event: events })
      .from(calendarLinks)
      .innerJoin(events, eq(events.id, calendarLinks.eventId))
      .where(and(eq(events.orgId, config.orgId), eq(calendarLinks.syncStatus, "attention")));
    for (const { event } of stuck) {
      tasks.push({ key: `kalendar-${event.id}`, title: event.published?.label ?? "Akce", detail: "Pozvánka v Kalendáři neodpovídá Wiki a čeká na váš zásah.", href: `/vzdelavani/akce/${event.id}?odkud=prehled#kalendar`, action: "Vyřešit pozvánku", eventType: event.published?.type });
    }
  }
  if (canManageUsers(viewer)) {
    const requests = await pendingRequestCount(db, viewer);
    if (requests > 0) {
      tasks.push({ key: "zadosti", title: `Žádosti o přístup: ${requests}`, detail: "Noví kolegové čekají na přidělení role a skupin.", href: "/sprava", action: "Otevřít Správu" });
    }
  }
  return tasks;
}
