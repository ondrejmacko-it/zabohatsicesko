import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { formatDayMonth, toDateKey } from "@/lib/time";
import type { EventType, Group } from "@/lib/types";
import { needsCalendarConnection } from "@/server/calendar/google-auth";
import { config, now } from "@/server/config";
import { getDb } from "@/server/db/client";
import { calendarLinks, events, minutes, recordings } from "@/server/db/schema";
import { canHandleRecording, canManageUsers, canReadPublishedMinutes, isOrganizer, type Viewer } from "@/server/policy";
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

/** Nejnovější proběhlé akce bez zápisu. Starší dluhy by přehled zahltily, jsou dohledatelné v harmonogramu. */
const MAX_MINUTES_TASKS = 4;

/** `external`: odkaz vede mimo stránky Wiki (přesměrování na Google), proto běžná navigace prohlížeče. */
export type JourneyTask = { key: string; title: string; detail: string; href: string; action: string; external?: boolean };

/** Co na uživatele čeká: zápisy k dokončení u akcí, které vede nebo kontroluje, a úkoly organizátora. */
export async function listTasks(viewer: Viewer): Promise<JourneyTask[]> {
  const db = await getDb();
  const tasks: JourneyTask[] = [];
  const reference = now();

  const past = await db
    .select()
    .from(events)
    .where(and(eq(events.orgId, config.orgId), sql`(${events.published}->>'endsAt')::timestamptz < ${reference.toISOString()}::timestamptz`))
    .orderBy(desc(events.startsAt));
  const handled = past.filter((row) => row.published?.status === "published" && row.published.type !== "holiday" && canHandleRecording(viewer, row));
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
        tasks.push({ key: `nahravka-${row.id}`, title: "Nahrajte audio z dnešní akce", detail: `${title}. Zápis se z nahrávky připraví sám, vy ho jen zkontrolujete.`, href: `/vzdelavani/akce/${row.id}?odkud=prehled#nahravka`, action: "Nahrát audio" });
        continue;
      }
      tasks.push(
        state === "draft"
          ? { key: `zapis-${row.id}`, title, detail: "Návrh zápisu čeká na kontrolu a zveřejnění.", href: `/vzdelavani/akce/${row.id}?odkud=prehled#nahravka`, action: "Zkontrolovat zápis" }
          : { key: `nahravka-${row.id}`, title, detail: "Proběhla a nemá zápis. Připraví se z nahrávky.", href: `/vzdelavani/akce/${row.id}?odkud=prehled#nahravka`, action: "Nahrát nahrávku" },
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
      tasks.push({ key: `kalendar-${event.id}`, title: event.published?.label ?? "Akce", detail: "Pozvánka v Kalendáři neodpovídá Wiki a čeká na váš zásah.", href: `/vzdelavani/akce/${event.id}?odkud=prehled#kalendar`, action: "Vyřešit pozvánku" });
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
