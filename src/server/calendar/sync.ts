import { and, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { addDays, fromPragueLocal, toDateKey } from "@/lib/time";
import type { EventSnapshot } from "@/lib/types";
import { audit, logError } from "@/server/audit";
import { attendeeSource, calendarMode, config, googleCalendarConfig, now, personalDelivery } from "@/server/config";
import { getDb, type Db } from "@/server/db/client";
import { calendarLinks, events, minutes, recordings, type ManagedFields } from "@/server/db/schema";
import { calendarSummary } from "@/server/domain/snapshot";
import { loadEventRow } from "@/server/services/events";
import { DomainError } from "@/server/services/errors";
import { isOrganizer, type Viewer } from "@/server/policy";
import { audienceAttendees, planGuests, samePlan } from "./attendees";
import { GoogleCalendar } from "./google";
import { connectionStatus, storedAccessToken } from "./google-auth";
import { markLinksDelivered, syncPersonalCalendars } from "./personal";
import { CalendarError, type CalendarProvider, type ExternalEvent, type ManagedEventData } from "./provider";
import { SimulatedCalendar } from "./simulated";
import { targetCalendarId } from "./target";

const MAX_ATTEMPTS = 3;
const LEASE_SEC = 60;

export type ErrorKind = "config" | "access" | "transient" | "data";

/**
 * Druh chyby vazby pro frontu a Správu:
 * – `transient`: výpadek nebo limit Googlu, fronta zkouší znovu s rostoucí prodlevou,
 * – `access`: účet organizátora nesmí zapisovat (odvolání, 403, cizí kalendář), zkouší se zřídka a správce dostane upozornění,
 * – `config`: chybí nebo nesedí nastavení serveru, bez zásahu se nezkouší,
 * – `data`: ruční změna, chybějící pozvánka nebo cizí originál, rozhoduje správce.
 */
export function errorKind(code: string | null): ErrorKind {
  switch (code) {
    case "calendar_unavailable":
      return "transient";
    case "calendar_revoked":
    case "calendar_forbidden":
    case "calendar_no_access":
      return "access";
    case "calendar_not_configured":
    case "calendar_not_allowed":
    case "attendee_not_allowed":
      return "config";
    default:
      return "data";
  }
}

/**
 * Prodleva dalšího pokusu fronty v minutách: přechodná chyba 5, 10, 20… nejvýš 6 h, chyba přístupu
 * nejdřív za hodinu. Ostatní druhy se samy neopakují (`null`).
 */
export function retryDelayMinutes(kind: ErrorKind, attempts: number): number | null {
  if (kind === "transient") return Math.min(360, 5 * 2 ** Math.max(0, attempts - MAX_ATTEMPTS));
  if (kind === "access") return Math.min(360, 60 * 2 ** Math.max(0, attempts - 1));
  return null;
}

/** Poskytovatel, který při každém volání ohlásí chybějící konfiguraci. Nikdy nespadne zpět do simulace. */
const unconfigured = new Proxy({} as CalendarProvider, {
  get: () => async () => {
    throw new CalendarError("calendar_not_configured", false);
  },
});

export function calendarProvider(db: Db): CalendarProvider {
  if (calendarMode() === "simulation") return new SimulatedCalendar(db);
  const cfg = googleCalendarConfig();
  if (!cfg) return unconfigured;
  return new GoogleCalendar({
    tokens: storedAccessToken(db, cfg),
    allowedCalendarIds: cfg.allowedCalendarIds,
    allowedAttendees: attendeeSource() === "audience" ? null : cfg.allowedAttendees,
  });
}

async function hasPublishedMinutes(db: Db, eventId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: minutes.id })
    .from(minutes)
    .leftJoin(recordings, eq(recordings.id, minutes.recordingId))
    // Zápis bez nahrávky (text, soubor, ručně) platí vždy, zápis z nahrávky jen k nevyměněné nahrávce.
    .where(and(eq(minutes.eventId, eventId), eq(minutes.status, "published"), or(isNull(minutes.recordingId), isNull(recordings.supersededAt))))
    .limit(1);
  return Boolean(row);
}

const eventUrl = (eventId: string) => `${config.appUrl}/vzdelavani/akce/${eventId}`;

/**
 * Popis pozvánky po propsání: ruční text (agenda, odkazy, poznámky) zůstane, Wiki nahradí jen své řádky
 * s odkazem na akci a připojí je na konec (audit A05). Google po ruční úpravě ukládá popis jako HTML,
 * řádky se proto dělí i podle `<br>`. Řádek Wiki se pozná podle adresy akce.
 */
export function mergeDescription(current: string, wikiBlock: string, url: string): string {
  const html = /<br\s*\/?>/i.test(current);
  const kept = current.split(html ? /<br\s*\/?>/i : "\n").filter((line) => !line.includes(url));
  while (kept.length && !kept[kept.length - 1]!.replace(/<[^>]*>|&nbsp;/g, "").trim()) kept.pop();
  const block = wikiBlock.split("\n");
  return (kept.length ? [...kept, "", ...block] : block).join(html ? "<br>" : "\n");
}

export function desiredData(eventId: string, snapshot: EventSnapshot, minutesPublished: boolean): ManagedEventData {
  const url = eventUrl(eventId);
  return {
    summary: calendarSummary(snapshot),
    // Do pozvánky jde jen odkaz. Wiki u něj znovu ověří přístup, citlivý obsah v Kalendáři není.
    description: minutesPublished
      ? `Zápis z akce je zveřejněný: ${url}#zapis\nPodrobnosti ve firemní Wiki: ${url}`
      : `Podrobnosti a zápis ve firemní Wiki: ${url}`,
    startsAt: new Date(snapshot.startsAt),
    endsAt: new Date(snapshot.endsAt),
    cancelled: snapshot.status === "cancelled",
  };
}

const managed = (data: ManagedEventData | ExternalEvent): ManagedFields => ({
  summary: data.summary,
  startsAt: data.startsAt.toISOString(),
  endsAt: data.endsAt.toISOString(),
  cancelled: data.cancelled,
});

const sameManaged = (a: ManagedFields, b: ManagedFields) =>
  a.summary === b.summary && a.startsAt === b.startsAt && a.endsAt === b.endsAt && a.cancelled === b.cancelled;

/** Zámek na úrovni akce: souběžné synchronizace téže akce se serializují. */
async function acquireLease(db: Db, eventId: string) {
  const [link] = await db
    .update(calendarLinks)
    .set({ leaseUntil: sql`now() + make_interval(secs => ${LEASE_SEC})` })
    .where(
      and(
        eq(calendarLinks.eventId, eventId),
        or(isNull(calendarLinks.leaseUntil), lt(calendarLinks.leaseUntil, sql`now()`)),
      ),
    )
    .returning();
  return link ?? null;
}

const releaseLease = (db: Db, eventId: string) =>
  db.update(calendarLinks).set({ leaseUntil: null }).where(eq(calendarLinks.eventId, eventId));

async function markAttention(db: Db, eventId: string, errorCode: string, attempts: number, conflict: ManagedFields | null = null) {
  // Čas fronty běží podle databáze (`now()`), ne podle ukázkových hodin Wiki.
  const delay = retryDelayMinutes(errorKind(errorCode), attempts);
  await db
    .update(calendarLinks)
    .set({
      syncStatus: "attention",
      errorCode,
      attempts,
      conflict,
      nextAttemptAt: delay === null ? null : sql`now() + make_interval(mins => ${delay})`,
      failingSince: sql`coalesce(${calendarLinks.failingSince}, now())`,
      updatedAt: new Date(),
    })
    .where(eq(calendarLinks.eventId, eventId));
}

/**
 * Propíše zveřejněnou revizi akce do Kalendáře. Posílá vždy nejnovější zveřejněný snímek,
 * takže starší revize nikdy nepřepíše novější. Opakované volání je bezpečné.
 * @param force přepsat ruční změnu provedenou mimo Wiki (rozhodnutí správce)
 */
export async function syncEvent(eventId: string, options: { force?: boolean } = {}): Promise<void> {
  const db = await getDb();
  // Osobní kalendáře: do kalendáře správce se nic nezapisuje, pozvánky ani e-maily nevznikají.
  if (personalDelivery()) {
    await markLinksDelivered(db, eventId);
    await syncPersonalCalendars(db);
    return;
  }
  const link = await acquireLease(db, eventId);
  if (!link) return;
  const provider = calendarProvider(db);
  let attempts = link.attempts;
  try {
    for (;;) {
      const row = await loadEventRow(db, eventId);
      const snapshot = row?.published;
      const revision = row?.publishedRevision ?? 0;
      const [current] = await db.select().from(calendarLinks).where(eq(calendarLinks.eventId, eventId)).limit(1);
      if (!row || !snapshot || !current) return;
      if (current.syncedRevision >= revision && current.syncStatus === "synced") return;

      const desired = desiredData(eventId, snapshot, await hasPublishedMinutes(db, eventId));
      // Akce zrušená dřív, než pozvánka vznikla: nic se nezakládá, pozvaným nepřijde pozvánka se stornem.
      // Jen po nejasném výsledku dřívějšího pokusu se ověří, zda pozvánka přece jen nevznikla.
      if (desired.cancelled && !current.externalEventId) {
        let orphan: ExternalEvent | null = null;
        try {
          orphan = await provider.findByKey(current.calendarId, `${config.orgId}:${eventId}`);
        } catch (error) {
          if (!(error instanceof CalendarError)) throw error;
          if (current.attempts > 0) {
            await markAttention(db, eventId, error.code, attempts + 1);
            return;
          }
        }
        if (!orphan) {
          await db
            .update(calendarLinks)
            .set({ syncedRevision: revision, syncStatus: "synced", errorCode: null, conflict: null, attempts: 0, nextAttemptAt: null, failingSince: null, updatedAt: new Date() })
            .where(eq(calendarLinks.eventId, eventId));
          await audit(db, null, "calendar.cancel_without_invite", "event", eventId);
          return;
        }
      }
      let external: ExternalEvent;
      let managedAttendees: string[];
      try {
        ({ external, managedAttendees } = await pushToCalendar(db, provider, current, desired, snapshot, options.force === true));
      } catch (error) {
        if (error instanceof ConflictDetected) {
          await markAttention(db, eventId, "external_change", attempts, error.external);
          return;
        }
        if (!(error instanceof CalendarError)) throw error;
        attempts += 1;
        logError("calendar.sync", error.code);
        if (!error.transient || attempts >= MAX_ATTEMPTS) {
          await markAttention(db, eventId, error.code, attempts);
          return;
        }
        await db
          .update(calendarLinks)
          .set({ attempts, errorCode: error.code, failingSince: sql`coalesce(${calendarLinks.failingSince}, now())` })
          .where(eq(calendarLinks.eventId, eventId));
        await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempts));
        continue;
      }

      // Monotónní zápis: revize se posune jen dopředu.
      await db
        .update(calendarLinks)
        .set({
          externalEventId: external.id,
          syncedRevision: revision,
          syncedFields: managed(external),
          managedAttendees,
          syncStatus: "synced",
          errorCode: null,
          conflict: null,
          attempts: 0,
          nextAttemptAt: null,
          failingSince: null,
          updatedAt: new Date(),
        })
        .where(and(eq(calendarLinks.eventId, eventId), lt(calendarLinks.syncedRevision, revision + 1)));
      await audit(db, null, "calendar.synced", "event", eventId);

      // Pokud mezitím správce zveřejnil novější revizi, rovnou ji odešleme.
      const [latest] = await db.select({ rev: events.publishedRevision }).from(events).where(eq(events.id, eventId));
      if ((latest?.rev ?? 0) <= revision) return;
      await db.update(calendarLinks).set({ syncStatus: "pending" }).where(eq(calendarLinks.eventId, eventId));
      attempts = 0;
    }
  } finally {
    await releaseLease(db, eventId);
  }
}

class ConflictDetected extends Error {
  constructor(readonly external: ManagedFields) {
    super("external_change");
  }
}

type Pushed = { external: ExternalEvent; managedAttendees: string[] };

async function pushToCalendar(
  db: Db,
  provider: CalendarProvider,
  link: typeof calendarLinks.$inferSelect,
  desired: ManagedEventData,
  snapshot: EventSnapshot,
  force: boolean,
): Promise<Pushed> {
  const guests = await audienceAttendees(db, snapshot.audience);
  const previouslyManaged = link.managedAttendees ?? [];

  /** Propíše spravovaná pole a hosty do existující pozvánky. Beze změny nic neposílá. */
  const reconcile = async (external: ExternalEvent): Promise<Pushed> => {
    // Hosté se upravují jen u budoucích platných akcí. Proběhlé a zrušené pozvánky zůstanou, jak jsou.
    const upcoming = !desired.cancelled && desired.startsAt > now();
    const plan = upcoming
      ? planGuests(guests, external.attendees, previouslyManaged)
      : { add: [], remove: [], managed: previouslyManaged };
    const data = { ...desired, description: mergeDescription(external.description, desired.description, eventUrl(link.eventId)) };
    // Pozvánka bez soukromí hostů (založená dřív nebo ručně změněná) se srovná i bez jiné změny.
    const privacyOk = external.guestsPrivate !== false;
    if (sameManaged(managed(external), managed(data)) && external.description === data.description && samePlan(plan) && privacyOk) {
      return { external, managedAttendees: plan.managed };
    }
    return { external: await provider.patch(link.calendarId, external.id, data, plan), managedAttendees: plan.managed };
  };

  if (!link.externalEventId) {
    // Nejasný výsledek předchozího pokusu: nejdřív ověřit, zda událost už nevznikla.
    const key = `${config.orgId}:${link.eventId}`;
    const existing = await provider.findByKey(link.calendarId, key);
    if (existing) return reconcile(existing);
    return {
      external: await provider.create(link.calendarId, key, desired, guests),
      managedAttendees: guests.map((g) => g.email.toLowerCase()),
    };
  }
  const external = await provider.get(link.calendarId, link.externalEventId);
  if (!external) throw new CalendarError("calendar_missing", false);
  if (!force && link.syncedFields && !sameManaged(managed(external), link.syncedFields)) {
    throw new ConflictDetected(managed(external));
  }
  return reconcile(external);
}

/** Dožene akce čekající ve frontě, například po změně skupin uživatele. Opakované volání je bezpečné. */
export async function syncPending(): Promise<void> {
  const db = await getDb();
  if (personalDelivery()) {
    await markLinksDelivered(db);
    await syncPersonalCalendars(db);
    return;
  }
  // Fronta: čekající změny a vazby, jejichž plánovaný další pokus po chybě už nastal.
  const due = await db
    .select({ eventId: calendarLinks.eventId })
    .from(calendarLinks)
    .where(
      or(
        eq(calendarLinks.syncStatus, "pending"),
        and(eq(calendarLinks.syncStatus, "attention"), isNotNull(calendarLinks.nextAttemptAt), lt(calendarLinks.nextAttemptAt, sql`now()`)),
      ),
    );
  for (const { eventId } of due) await syncEvent(eventId);
}

/** Jak daleko od začátku akce se cizí pozvánka ještě považuje za možný posunutý originál. */
const NEARBY_INVITE_MS = 3 * 60 * 60 * 1000;

const normalizeTitle = (title: string) => title.trim().toLocaleLowerCase("cs").replace(/\s+/g, " ");

/**
 * Může cizí pozvánka být tatáž akce? Stačí začátek do 3 hodin od akce nebo stejný název.
 * Raději zastaví automatiku zbytečně, než aby pozvaní dostali dvojí pozvánku (audit A01).
 */
export function looksLikeSameInvite(
  candidate: Pick<ExternalEvent, "startsAt" | "summary" | "cancelled">,
  target: { startsAt: Date; endsAt: Date; summary: string },
): boolean {
  if (candidate.cancelled) return false;
  if (Math.abs(candidate.startsAt.getTime() - target.startsAt.getTime()) <= NEARBY_INVITE_MS) return true;
  return normalizeTitle(candidate.summary) === normalizeTitle(target.summary);
}

/**
 * Založí vazbu každé zveřejněné budoucí akci, která ji nemá (typicky akce ze seedu nebo importu).
 * Pozvánku pak vytvoří běžná fronta. Výjimka: když v Kalendáři blízko termínu (nebo se stejným názvem) leží cizí
 * nespárovaná pozvánka, akce počká na rozhodnutí správce (spárovat, nebo založit novou),
 * aby pozvaným nepřišla dvojí pozvánka (`looksLikeSameInvite`). Proběhlé a zrušené akce se nezakládají.
 * @returns ID akcí, které dostaly vazbu
 */
export async function linkPublishedWithoutInvite(): Promise<string[]> {
  const db = await getDb();
  // Osobní kalendáře nepárují s kalendářem správce. Akce bez vazby čtou přímo z plánu.
  if (personalDelivery()) return [];
  // Bez použitelného Kalendáře by vazby jen spadly do chyby. Počká se na propojení.
  if (calendarMode() !== "simulation") {
    const cfg = googleCalendarConfig();
    if (!cfg || !(await connectionStatus(db))) return [];
  }
  const unlinked = await db
    .select({ id: events.id, published: events.published })
    .from(events)
    .leftJoin(calendarLinks, eq(calendarLinks.eventId, events.id))
    .where(
      and(
        eq(events.orgId, config.orgId),
        isNotNull(events.published),
        isNull(calendarLinks.eventId),
        ne(events.type, "holiday"),
        ne(events.status, "cancelled"),
        gt(sql`(${events.published}->>'startsAt')::timestamptz`, sql`${now().toISOString()}::timestamptz`),
      ),
    );
  if (!unlinked.length) return [];

  const provider = calendarProvider(db);
  const calendarId = targetCalendarId();
  const taken = new Set((await db.select({ id: calendarLinks.externalEventId }).from(calendarLinks)).map((l) => l.id));
  const linked: string[] = [];
  for (const { id, published } of unlinked) {
    const snapshot = published as EventSnapshot;
    if (snapshot.status === "cancelled" || snapshot.type === "holiday") continue;
    const startsAt = new Date(snapshot.startsAt);
    const endsAt = new Date(snapshot.endsAt);
    try {
      // Pozvánka, kterou Wiki založila dřív (například před obnovou ukázkových dat), se pozná podle klíče
      // a fronta ji převezme. Cizí pozvánka, která vypadá jako tatáž akce (blízký čas nebo stejný název
      // ve stejném dni), je důvod počkat na člověka: správce ji spáruje, nebo založí novou.
      const own = await provider.findByKey(calendarId, `${config.orgId}:${id}`);
      const day = toDateKey(startsAt);
      const lookalikes = (
        await provider.listBetween(calendarId, fromPragueLocal(day, "00:00"), fromPragueLocal(addDays(day, 1), "00:00"))
      ).filter((c) => c.id !== own?.id && !taken.has(c.id) && !c.createdByWiki && looksLikeSameInvite(c, { startsAt, endsAt, summary: calendarSummary(snapshot) }));
      if (lookalikes.length) continue;
    } catch (error) {
      if (!(error instanceof CalendarError)) throw error;
      logError("calendar.auto_link", error.code);
      return linked;
    }
    const inserted = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(calendarLinks)
        .values({ eventId: id, calendarId, syncStatus: "pending", syncedRevision: 0, attempts: 0 })
        .onConflictDoNothing()
        .returning({ eventId: calendarLinks.eventId });
      if (!row) return false;
      await tx.update(events).set({ calendarIntent: "create" }).where(eq(events.id, id));
      await audit(tx, null, "calendar.auto_link", "event", id);
      return true;
    });
    if (inserted) linked.push(id);
  }
  return linked;
}

/** Všechno zveřejněné dostane pozvánku: dozaloží chybějící vazby a odešle frontu. Opakované volání je bezpečné. */
export async function syncPublished(): Promise<void> {
  await linkPublishedWithoutInvite();
  await syncPending();
}

// ——— Akce správce nad vazbou ———

function requireOrganizer(viewer: Viewer) {
  if (!isOrganizer(viewer)) throw new DomainError("forbidden");
}

/** Ruční opakování po chybě. Vynulování pokusů je auditované. */
export async function requestRetry(viewer: Viewer, eventId: string): Promise<void> {
  requireOrganizer(viewer);
  const db = await getDb();
  const [link] = await db
    .update(calendarLinks)
    .set({ syncStatus: "pending", attempts: 0, errorCode: null, updatedAt: new Date() })
    .where(eq(calendarLinks.eventId, eventId))
    .returning();
  if (!link) throw new DomainError("not_found");
  await audit(db, viewer.id, "calendar.retry", "event", eventId);
}

/**
 * Chyby, které může vyřešit nové propojení: jiný účet, nový token nebo opravené nastavení kalendáře.
 * Ruční změnu v Kalendáři, chybějící pozvánku nebo spor o originál dál rozhoduje správce.
 */
const FIXED_BY_RECONNECT = ["calendar_revoked", "calendar_forbidden", "calendar_unavailable", "calendar_no_access", "calendar_not_allowed", "calendar_not_configured"];

/**
 * Po novém připojení účtu vrátí do fronty akce, které zastavil přístup ke Kalendáři.
 * Vazby, ke kterým ještě žádná pozvánka nevznikla, převede na kalendář z aktuálního nastavení.
 * @returns ID akcí vrácených do fronty
 */
export async function resumeAfterReconnect(db: Db): Promise<string[]> {
  const target = targetCalendarId();
  await db
    .update(calendarLinks)
    .set({ calendarId: target })
    .where(and(isNull(calendarLinks.externalEventId), ne(calendarLinks.calendarId, target)));
  const resumed = await db
    .update(calendarLinks)
    .set({ syncStatus: "pending", attempts: 0, errorCode: null, updatedAt: new Date() })
    .where(and(eq(calendarLinks.syncStatus, "attention"), inArray(calendarLinks.errorCode, FIXED_BY_RECONNECT)))
    .returning({ eventId: calendarLinks.eventId });
  return resumed.map((r) => r.eventId);
}

/**
 * Smí připojený účet zapisovat do nastaveného kalendáře? Krátké čtení jednoho dne po uložení propojení,
 * aby špatný kalendář nebo účet bez přístupu správce poznal hned, ne až na každé akci zvlášť.
 */
export async function probeTargetCalendar(db: Db): Promise<"ok" | "no_access" | "unknown"> {
  const from = now();
  try {
    await calendarProvider(db).listBetween(targetCalendarId(), from, new Date(from.getTime() + 24 * 60 * 60 * 1000));
    return "ok";
  } catch (error) {
    if (!(error instanceof CalendarError)) throw error;
    return error.code === "calendar_no_access" || error.code === "calendar_not_allowed" ? "no_access" : "unknown";
  }
}

/** Po uložení nového propojení odešle celou frontu: obnovené akce, čekající změny i akce bez pozvánky. */
export async function syncAfterReconnect(db: Db): Promise<string[]> {
  const resumed = await resumeAfterReconnect(db);
  await syncPublished();
  return resumed;
}

/** Správce výslovně rozhodl založit novou pozvánku pro zveřejněnou akci bez vazby. */
export async function requestNewInvite(viewer: Viewer, eventId: string): Promise<void> {
  requireOrganizer(viewer);
  const db = await getDb();
  await db.transaction(async (tx) => {
    const row = await loadEventRow(tx, eventId);
    // Zrušená akce pozvánku nedostane: pozvaným by přišla pozvánka se stornem.
    if (!row?.published || row.type === "holiday" || row.published.status === "cancelled") throw new DomainError("invalid_state");
    await tx.update(events).set({ calendarIntent: "create" }).where(eq(events.id, eventId));
    await tx
      .insert(calendarLinks)
      .values({ eventId, calendarId: targetCalendarId(), syncStatus: "pending", syncedRevision: 0, attempts: 0 })
      .onConflictDoNothing();
    await audit(tx, viewer.id, "calendar.create_intent", "event", eventId);
  });
}

/** Spáruje akci s existující pozvánkou. Hosté a RSVP pozvánky zůstanou, Wiki převezme jen spravovaná pole. */
export async function pairWithExisting(viewer: Viewer, eventId: string, externalEventId: string): Promise<void> {
  requireOrganizer(viewer);
  // Spárovat lze jen nespárovanou pozvánku ze stejného dne, kterou správce viděl v nabídce.
  const external = (await pairingCandidates(viewer, eventId)).find((c) => c.id === externalEventId);
  if (!external) throw new DomainError("invalid_state");
  const db = await getDb();
  await db.transaction(async (tx) => {
    const row = await loadEventRow(tx, eventId);
    if (!row?.published || row.published.status === "cancelled") throw new DomainError("invalid_state");
    await tx.insert(calendarLinks).values({
      eventId,
      calendarId: targetCalendarId(),
      externalEventId: external.id,
      // U opakované události se vazba drží konkrétního výskytu, ostatní termíny série zůstanou.
      recurringEventId: external.recurringEventId ?? null,
      originalStartTime: external.originalStartTime ?? null,
      syncedFields: managed(external),
      syncStatus: "pending",
      syncedRevision: 0,
      attempts: 0,
    });
    await audit(tx, viewer.id, "calendar.pair", "event", eventId);
  });
}

/** Nespárované události z testovacího kalendáře ve stejném dni jako akce. */
export async function pairingCandidates(viewer: Viewer, eventId: string): Promise<ExternalEvent[]> {
  requireOrganizer(viewer);
  const db = await getDb();
  const row = await loadEventRow(db, eventId);
  if (!row?.published) return [];
  const day = toDateKey(new Date(row.published.startsAt));
  const candidates = await calendarProvider(db).listBetween(
    targetCalendarId(),
    fromPragueLocal(day, "00:00"),
    fromPragueLocal(addDays(day, 1), "00:00"),
  );
  const linked = await db.select({ id: calendarLinks.externalEventId }).from(calendarLinks);
  const taken = new Set(linked.map((l) => l.id));
  return candidates.filter((c) => !taken.has(c.id));
}
