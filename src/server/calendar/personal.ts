import { createHash } from "node:crypto";
import { and, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { EventSnapshot } from "@/lib/types";
import { audit, logError } from "@/server/audit";
import { config, googleCalendarConfig, participationEnabled, personalDelivery, personalSelfInvite, tokenEncryptionKey } from "@/server/config";
import type { Db, Executor } from "@/server/db/client";
import { calendarLinks, eventParticipation, events, minutes, personalCalendarEntries, personalCalendars, recordings, users, type PersonalCalendarStatus } from "@/server/db/schema";
import { openSecret, sealSecret } from "@/server/integrations/secret-box";
import { participationState, type Participant, type ParticipationRecord } from "@/server/domain/participation";
import { eventIdForKey } from "./google";
import { revokeToken, type FetchLike } from "./google-auth";
import { PersonalCalendarApi } from "./personal-api";
import { CalendarError } from "./provider";
import { desiredData } from "./sync";

// Osobní kalendáře účastníků (`CALENDAR_DELIVERY=personal`). Každý uživatel má v účtu Google vlastní
// kalendář „Vzdělávání ZBC“ a Wiki do něj zapisuje akce jeho skupin. Hosté ani pozvánky nejsou.
// Zdroj pravdy je Wiki: synchronizace porovná požadovanou sadu akcí s tím, co už do kalendáře zapsala.

export const PERSONAL_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
/** Jak daleko do minulosti Wiki akce v kalendáři drží. Starší zůstanou, jak byly. */
const HISTORY_DAYS = 60;
const LEASE_SEC = 120;
/** Kolikrát se běh zopakuje, když během něj přišla další změna. */
const MAX_ROUNDS = 3;
/**
 * Jak často se ověří, že přístup u Googlu ještě platí, i když se nic nezměnilo. Odebrání přístupu v účtu
 * Google Wiki jinak pozná až při příští změně akce a do té doby by ukazovala „Propojeno“.
 */
export const ACCESS_CHECK_MIN = 10;

export const grantsPersonalCalendar = (scopes: string) => scopes.split(" ").includes(PERSONAL_SCOPE);

const secretContext = (userId: string) => `${config.orgId}:google-personal:${userId}`;

export type PersonalDeps = { fetchImpl?: FetchLike; clock?: () => Date };

function apiFor(refreshToken: string, deps: PersonalDeps): PersonalCalendarApi | null {
  const cfg = googleCalendarConfig();
  if (!cfg) return null;
  return new PersonalCalendarApi({ clientId: cfg.clientId, clientSecret: cfg.clientSecret, fetchImpl: deps.fetchImpl }, refreshToken);
}

const whereUser = (userId: string) => and(eq(personalCalendars.orgId, config.orgId), eq(personalCalendars.userId, userId));

/**
 * Uloží souhlas s osobním kalendářem. Jiný účet Google než minule = nový kalendář: starý patří cizímu
 * účtu, jeho token se zneplatní a záznamy o zapsaných akcích se zahodí.
 */
export async function savePersonalGrant(
  db: Db,
  userId: string,
  grant: { refreshToken: string; scopes: string; accountEmail: string },
  deps: PersonalDeps = {},
): Promise<void> {
  const [previous] = await db.select().from(personalCalendars).where(whereUser(userId)).limit(1);
  const sameAccount = previous?.accountEmail === grant.accountEmail && previous.status !== "calendar_deleted";
  if (previous && !sameAccount) {
    const old = previous.encryptedRefreshToken ? openSecret(previous.encryptedRefreshToken, tokenEncryptionKey(), secretContext(userId)) : null;
    if (old && previous.accountEmail !== grant.accountEmail) await revokeToken(old, deps.fetchImpl);
    await db.delete(personalCalendarEntries).where(eq(personalCalendarEntries.userId, userId));
  }
  const values = {
    accountEmail: grant.accountEmail,
    encryptedRefreshToken: sealSecret(grant.refreshToken, tokenEncryptionKey(), secretContext(userId)),
    scopes: grant.scopes,
    calendarId: sameAccount ? previous.calendarId : null,
    status: "active" as const,
    errorCode: null,
    // Prázdné `syncedAt` = čerstvý souhlas: první běh ověří, že uložený kalendář ještě existuje, a znovu ho nastaví.
    syncedAt: null,
    syncRequestedAt: new Date(),
    updatedAt: new Date(),
  };
  await db
    .insert(personalCalendars)
    .values({ userId, orgId: config.orgId, ...values })
    .onConflictDoUpdate({ target: personalCalendars.userId, set: values });
  await audit(db, userId, "calendar.personal.connected", "user", userId);
}

/** Uživatel na obrazovce Googlu Kalendář odškrtl. Wiki se při dalším přihlášení znovu neptá. */
export async function markPersonalDeclined(db: Executor, userId: string, accountEmail: string): Promise<void> {
  const [previous] = await db.select({ status: personalCalendars.status }).from(personalCalendars).where(whereUser(userId)).limit(1);
  // Platné propojení z dřívějška se odškrtnutím při jiném přihlášení neruší.
  if (previous?.status === "active") return;
  const values = { accountEmail, encryptedRefreshToken: "", scopes: "", status: "declined" as const, errorCode: null, updatedAt: new Date() };
  await db.insert(personalCalendars).values({ userId, orgId: config.orgId, ...values }).onConflictDoUpdate({ target: personalCalendars.userId, set: values });
}

export type PersonalCalendarState = {
  status: PersonalCalendarStatus | "none";
  accountEmail: string | null;
  syncedAt: string | null;
  /** Poslední zápis selhal přechodně, Wiki to zkusí znovu. */
  retrying: boolean;
  /** Google zápis opakovaně odmítá (403), i když přístup platí. Pomůže propojit znovu. */
  blocked: boolean;
  /** Kód chyby u nepovedeného smazání kalendáře (`removal_failed`). */
  errorCode?: string | null;
};

const FORBIDDEN_PREFIX = "forbidden";

function stateOf(row: typeof personalCalendars.$inferSelect): PersonalCalendarState {
  const failing = row.status === "active" && row.errorCode !== null;
  const blocked = failing && row.errorCode!.startsWith(FORBIDDEN_PREFIX);
  return {
    status: row.status,
    accountEmail: row.accountEmail,
    syncedAt: row.syncedAt?.toISOString() ?? null,
    retrying: failing && !blocked,
    blocked,
    errorCode: row.status === "removal_failed" ? row.errorCode : null,
  };
}

export async function personalCalendarState(db: Executor, userId: string): Promise<PersonalCalendarState> {
  const [row] = await db.select().from(personalCalendars).where(whereUser(userId)).limit(1);
  if (!row) return { status: "none", accountEmail: null, syncedAt: null, retrying: false, blocked: false, errorCode: null };
  return stateOf(row);
}

/** Stav osobních kalendářů všech účtů pro Správu. Bez tokenů. */
export async function personalCalendarStates(db: Executor): Promise<Map<string, PersonalCalendarState>> {
  const rows = await db.select().from(personalCalendars).where(eq(personalCalendars.orgId, config.orgId));
  return new Map(rows.map((row) => [row.userId, stateOf(row)]));
}

/** Má přihlášení požádat o osobní kalendář? Ne, když už platí, nebo ho uživatel odmítl (pak jen tlačítko). */
export async function needsPersonalCalendar(db: Executor, userId: string | null): Promise<boolean> {
  if (!personalDelivery()) return false;
  if (!userId) return true;
  const [row] = await db.select({ status: personalCalendars.status }).from(personalCalendars).where(whereUser(userId)).limit(1);
  return !row || row.status === "revoked" || row.status === "calendar_deleted" || row.status === "removal_failed";
}

/** Zařadí uživatele k synchronizaci. Bez argumentu všechny aktivní. */
export async function requestPersonalSync(db: Executor, userIds?: readonly string[]): Promise<void> {
  const where = and(eq(personalCalendars.orgId, config.orgId), eq(personalCalendars.status, "active"));
  await db
    .update(personalCalendars)
    .set({ syncRequestedAt: new Date() })
    .where(userIds ? and(where, inArray(personalCalendars.userId, [...userIds])) : where);
}

/** Kalendáře, které je potřeba srovnat (výběr pro `personalSyncNeeded` i plánovač). */
const dueQuery = (db: Executor) =>
  db
    .select({ userId: personalCalendars.userId })
    .from(personalCalendars)
    .leftJoin(users, eq(users.id, personalCalendars.userId))
    .where(
      and(
        eq(personalCalendars.orgId, config.orgId),
        or(
          and(
            eq(personalCalendars.status, "active"),
            or(
              isNotNull(personalCalendars.errorCode),
              isNull(personalCalendars.syncedAt),
              gt(personalCalendars.syncRequestedAt, personalCalendars.syncedAt),
              // Nasazení s novou podobou akcí: samo nic nezmění, proto se přepis spustí odsud.
              lt(personalCalendars.eventFormat, EVENT_FORMAT),
              // Pravidelná kontrola, že přístup u Googlu ještě platí (odvolání v účtu Google).
              lt(personalCalendars.syncedAt, sql`now() - make_interval(mins => ${ACCESS_CHECK_MIN})`),
            ),
          ),
          isNull(users.id),
          ne(users.status, "active"),
        ),
      ),
    );

/**
 * Je co dohánět? Aktivní kalendář po přechodné chybě, se změnou novější než poslední zápis, ještě nikdy
 * nezapsaný, nebo kalendář účtu, který už není aktivní (úklid). Jeden levný dotaz bez volání Googlu,
 * proto ho smí položit každé otevření Úvodu.
 */
export async function personalSyncNeeded(db: Executor): Promise<boolean> {
  if (!personalDelivery()) return false;
  const [row] = await dueQuery(db).limit(1);
  return Boolean(row);
}

/**
 * Srovná jen kalendáře, které to potřebují (stejný výběr jako `personalSyncNeeded`). Pro plánovač:
 * opakování po chybě a změny čekající ve frontě se doženou i bez návštěvy Wiki. Vrací, kolik jich zbývá.
 */
export async function syncDuePersonalCalendars(db: Db, deps: PersonalDeps = {}): Promise<number> {
  if (!personalDelivery()) return 0;
  const rows = await dueQuery(db);
  for (const row of rows) await syncPersonalCalendar(db, row.userId, deps);
  return (await dueQuery(db)).length;
}

/**
 * Verze podoby zapsané akce. Zvýšení přepíše všechny akce v kalendářích a znovu zkusí nastavení kalendáře
 * (2 = připomínky přímo v akci, 3 = oprava nastavení kalendáře po 401 na `calendarList.patch`, 4 = pět připomínek 7 d / 1 d / 60 / 30 / 10 min). Kalendář si pamatuje verzi v `event_format`, `personalSyncNeeded` podle ní
 * pozná, že po nasazení je co přepisovat.
 */
export const EVENT_FORMAT = 4;
const hashOf = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
export const personalEventId = (eventId: string) => eventIdForKey(`personal:${config.orgId}:${eventId}`);

/** Akce, ke kterým je zveřejněný zápis z platné nahrávky. Volitelně jen pro vybrané akce. */
async function eventsWithMinutes(db: Executor, eventIds?: readonly string[]): Promise<Set<string>> {
  const published = eq(minutes.status, "published");
  const rows = await db
    .select({ eventId: minutes.eventId })
    .from(minutes)
    .leftJoin(recordings, eq(recordings.id, minutes.recordingId))
    // Zápis bez nahrávky (text, soubor, ručně) platí vždy, zápis z nahrávky jen k nevyměněné nahrávce.
    .where(and(published, or(isNull(minutes.recordingId), isNull(recordings.supersededAt)), eventIds ? inArray(minutes.eventId, [...eventIds]) : undefined));
  return new Set(rows.map((m) => m.eventId));
}

/**
 * Podoba akce v osobním kalendáři a její otisk. Jediné místo, kde otisk vzniká: synchronizace podle něj
 * pozná, co přepsat, a detail akce podle něj pozná, zda zapsaná podoba ještě odpovídá Wiki.
 */
function desiredEntry(eventId: string, snapshot: EventSnapshot, withMinutes: boolean, guest: string | undefined) {
  const data = desiredData(eventId, snapshot, withMinutes);
  return { data, hash: hashOf({ v: EVENT_FORMAT, g: guest ?? null, s: data.summary, d: data.description, a: data.startsAt, b: data.endsAt }) };
}

/**
 * Akce, které mají být v kalendáři uživatele: zveřejněné, nezrušené, ne svátky, nedávné a budoucí, a podle
 * pravidel účasti (`participationState`) povinné bez omluvy nebo dobrovolně přihlášené. Bez zapnuté účasti
 * (a tedy bez čtení `event_participation`) rozhoduje jen povinnost podle rolí a publika.
 */
async function desiredEvents(db: Executor, userId: string, person: Participant, since: Date, guest: string | undefined) {
  const rows = await db
    .select({ id: events.id, published: events.published })
    .from(events)
    .where(
      and(
        eq(events.orgId, config.orgId),
        isNotNull(events.published),
        ne(events.type, "holiday"),
        gt(sql`(${events.published}->>'endsAt')::timestamptz`, sql`${since.toISOString()}::timestamptz`),
      ),
    );
  const records = participationEnabled()
    ? new Map<string, ParticipationRecord>(
        (
          await db
            .select({ eventId: eventParticipation.eventId, kind: eventParticipation.kind, excuseReason: eventParticipation.excuseReason })
            .from(eventParticipation)
            .where(and(eq(eventParticipation.orgId, config.orgId), eq(eventParticipation.userId, userId)))
        ).map((r) => [r.eventId, { kind: r.kind, excuseReason: r.excuseReason }]),
      )
    : new Map<string, ParticipationRecord>();
  const withMinutes = await eventsWithMinutes(db);
  const wanted = new Map<string, ReturnType<typeof desiredEntry>>();
  for (const row of rows) {
    const snapshot = row.published as EventSnapshot;
    const state = participationState(person, snapshot, records.get(row.id) ?? null);
    if (state !== "required" && state !== "voluntary_enrolled") continue;
    wanted.set(row.id, desiredEntry(row.id, snapshot, withMinutes.has(row.id), guest));
  }
  return wanted;
}

async function acquireLease(db: Executor, userId: string) {
  const [row] = await db
    .update(personalCalendars)
    .set({ leaseUntil: sql`now() + make_interval(secs => ${LEASE_SEC})` })
    .where(and(whereUser(userId), or(isNull(personalCalendars.leaseUntil), lt(personalCalendars.leaseUntil, sql`now()`))))
    .returning();
  return row ?? null;
}

/**
 * Nastaví kalendář v seznamu kalendářů uživatele a uloží výsledek jako strojový kód: runtime logy nejsou
 * vždy dostupné, důvod odmítnutí od Googlu tak zůstane k přečtení v databázi.
 */
async function configure(db: Executor, api: PersonalCalendarApi, userId: string, calendarId: string) {
  const { setup, failures } = await api.configureCalendar(calendarId);
  const setupCode = [setup, ...failures].join("|").slice(0, 200);
  await setState(db, userId, { setupCode });
  if (setup !== "full") await audit(db, userId, `calendar.personal.setup_${setup}`, "user", userId);
}

async function setState(db: Executor, userId: string, values: Partial<typeof personalCalendars.$inferInsert>) {
  await db.update(personalCalendars).set({ ...values, updatedAt: new Date() }).where(whereUser(userId));
}

export type PersonalSyncResult = "synced" | "skipped" | "revoked" | "calendar_deleted" | "retry" | "removed";

/**
 * Srovná kalendář jednoho uživatele s Wiki pod zámkem. Zapisuje jen rozdíly, bez změn Google nevolá.
 * Změna, která přijde během běhu (`sync_requested_at` > začátek), spustí další kolo.
 */
export async function syncPersonalCalendar(db: Db, userId: string, deps: PersonalDeps = {}): Promise<PersonalSyncResult> {
  const clock = deps.clock ?? (() => new Date());
  const row = await acquireLease(db, userId);
  if (!row) return "skipped";
  try {
    const [account] = await db.select({ status: users.status, groups: users.groups }).from(users).where(and(eq(users.orgId, config.orgId), eq(users.id, userId))).limit(1);
    if (!account || account.status !== "active") {
      return (await removePersonalCalendar(db, userId, deps)) === "removed" ? "removed" : "retry";
    }
    if (row.status !== "active") return "skipped";
    const refreshToken = openSecret(row.encryptedRefreshToken, tokenEncryptionKey(), secretContext(userId));
    const api = refreshToken ? apiFor(refreshToken, deps) : null;
    if (!api) {
      if (!refreshToken) {
        logError("google.personal", "token_undecryptable");
        await setState(db, userId, { status: "revoked", errorCode: "calendar_revoked", encryptedRefreshToken: "" });
        return "revoked";
      }
      return "skipped";
    }
    let calendarId = row.calendarId;
    if (calendarId && !row.syncedAt) {
      // Čerstvý souhlas stejného účtu: kalendář, který Wiki založila dřív, se použije znovu. Smazal-li ho
      // uživatel, založí se nový. Uživatel o propojení právě požádal, stav „smazán“ by tu nedával smysl.
      if (await api.calendarExists(calendarId)) await configure(db, api, userId, calendarId);
      else {
        await db.delete(personalCalendarEntries).where(eq(personalCalendarEntries.userId, userId));
        await setState(db, userId, { calendarId: null });
        calendarId = null;
      }
    }
    else if (calendarId && row.eventFormat < EVENT_FORMAT) {
      // Nová podoba akcí po nasazení: jednou za verzi se zkusí i nastavení kalendáře.
      await configure(db, api, userId, calendarId);
    }
    // Zapnutí i vypnutí zkušebního režimu změní otisk všech akcí, takže se přepíšou s hostem nebo bez něj.
    const guest = personalSelfInvite() ? row.accountEmail : undefined;
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const started = clock();
      const since = new Date(started.getTime() - HISTORY_DAYS * 24 * 3600 * 1000);
      const wanted = await desiredEvents(db, userId, account, since, guest);
      const written = new Map(
        (await db.select().from(personalCalendarEntries).where(eq(personalCalendarEntries.userId, userId))).map((e) => [e.eventId, e]),
      );
      // Akce mimo okno historie se nemažou: stará akce v kalendáři nikomu nevadí a výmaz by byl šum.
      const stale = [...written.values()].filter((e) => !wanted.has(e.eventId));
      const changed = [...wanted.entries()].filter(([id, w]) => written.get(id)?.dataHash !== w.hash);

      // Bez změn akcí se zapisovat nemá co, jen se obnoví token: tak Wiki pozná odvolání přístupu v účtu
      // Google. Běh bez změn spustí Úvod nejvýš jednou za `ACCESS_CHECK_MIN` (viz `personalSyncNeeded`).
      if (round === 0 && !changed.length && !stale.length && calendarId) await api.verifyAccess();
      if (changed.length || stale.length || !calendarId) {
        if (!calendarId) {
          // ID se uloží hned po založení: cokoli dalšího může selhat a příští běh musí kalendář najít,
          // jinak by každý pokus založil další kalendář „Vzdělávání ZBC“.
          calendarId = await api.insertCalendar();
          await setState(db, userId, { calendarId });
          await audit(db, userId, "calendar.personal.created", "user", userId);
          await configure(db, api, userId, calendarId);
        }
        for (const [eventId, w] of changed) {
          const externalEventId = personalEventId(eventId);
          const result = await api.putEvent(calendarId, externalEventId, w.data, written.has(eventId), guest);
          if (result === "calendar_missing") {
            await db.delete(personalCalendarEntries).where(eq(personalCalendarEntries.userId, userId));
            await setState(db, userId, { status: "calendar_deleted", calendarId: null, errorCode: null });
            return "calendar_deleted";
          }
          await db
            .insert(personalCalendarEntries)
            .values({ userId, eventId, externalEventId, dataHash: w.hash })
            .onConflictDoUpdate({ target: [personalCalendarEntries.userId, personalCalendarEntries.eventId], set: { dataHash: w.hash, updatedAt: new Date() } });
        }
        for (const entry of stale) {
          await api.deleteEvent(calendarId, entry.externalEventId, Boolean(guest));
          await db.delete(personalCalendarEntries).where(and(eq(personalCalendarEntries.userId, userId), eq(personalCalendarEntries.eventId, entry.eventId)));
        }
      }
      await setState(db, userId, { syncedAt: started, errorCode: null, eventFormat: EVENT_FORMAT });
      const [after] = await db.select({ requested: personalCalendars.syncRequestedAt }).from(personalCalendars).where(whereUser(userId)).limit(1);
      if (!after?.requested || after.requested <= started) return "synced";
    }
    return "synced";
  } catch (error) {
    if (!(error instanceof CalendarError)) throw error;
    if (error.code === "calendar_revoked") {
      // Odvoláno u Googlu: token je k ničemu, zůstane jen stav a jedna akce k nápravě u uživatele.
      await setState(db, userId, { status: "revoked", errorCode: "calendar_revoked", encryptedRefreshToken: "" });
      await audit(db, userId, "calendar.personal.revoked", "user", userId);
      return "revoked";
    }
    // Přechodná chyba nebo 403 u jedné operace: token i kalendář zůstávají, zkusí se při dalším spouštěči
    // (zveřejnění, přihlášení, otevření Úvodu). U 403 se uloží důvod od Googlu kvůli diagnostice.
    const errorCode = error.code === "calendar_forbidden" ? `${FORBIDDEN_PREFIX}_${error.reason || "unknown"}` : error.code;
    await setState(db, userId, { errorCode });
    logError("calendar.personal", errorCode);
    return "retry";
  } finally {
    await db.update(personalCalendars).set({ leaseUntil: null }).where(whereUser(userId));
  }
}

/** Synchronizuje všechny, kdo to potřebují, a uklidí kalendáře odebraných účtů. Opakované volání je bezpečné. */
export async function syncPersonalCalendars(db: Db, deps: PersonalDeps = {}): Promise<void> {
  if (!personalDelivery()) return;
  await requestPersonalSync(db);
  const rows = await db
    .select({ userId: personalCalendars.userId, status: personalCalendars.status, userStatus: users.status })
    .from(personalCalendars)
    .leftJoin(users, eq(users.id, personalCalendars.userId))
    .where(eq(personalCalendars.orgId, config.orgId));
  for (const row of rows) {
    if (row.status === "active" || row.userStatus !== "active") await syncPersonalCalendar(db, row.userId, deps);
  }
}

/**
 * Odebraný nebo vypnutý účet: smaže jeho kalendář „Vzdělávání ZBC“ (akce z Wiki mu nezůstanou),
 * zneplatní token u Googlu a smaže záznamy. Volá se pod zámkem ze synchronizace.
 *
 * Když Google smazání odmítne (cokoli kromě 404, to znamená „už smazaný“), token ani řádek se nemažou:
 * řádek dostane stav `removal_failed` s kódem chyby a další běh to zkusí znovu. Jinak by kalendář zůstal
 * v účtu uživatele a Wiki by o něm už nevěděla.
 */
export async function removePersonalCalendar(db: Db, userId: string, deps: PersonalDeps): Promise<"removed" | "failed"> {
  const [row] = await db.select().from(personalCalendars).where(whereUser(userId)).limit(1);
  if (!row) return "removed";
  const refreshToken = row.encryptedRefreshToken ? openSecret(row.encryptedRefreshToken, tokenEncryptionKey(), secretContext(userId)) : null;
  if (refreshToken) {
    if (row.calendarId) {
      const api = apiFor(refreshToken, deps);
      const errorCode = api ? await deleteCalendarCode(api, row.calendarId) : "config_missing";
      if (errorCode) {
        await setState(db, userId, { status: "removal_failed", errorCode });
        logError("calendar.personal", `remove_${errorCode}`);
        await audit(db, null, "calendar.personal.removal_failed", "user", userId);
        return "failed";
      }
    }
    await revokeToken(refreshToken, deps.fetchImpl);
  }
  await db.delete(personalCalendars).where(whereUser(userId));
  await audit(db, null, "calendar.personal.removed", "user", userId);
  return "removed";
}

/** Smaže kalendář. `null` = smazaný (i dřív, 404), jinak kód chyby od Googlu. */
async function deleteCalendarCode(api: PersonalCalendarApi, calendarId: string): Promise<string | null> {
  try {
    await api.deleteCalendar(calendarId);
    return null;
  } catch (error) {
    if (!(error instanceof CalendarError)) throw error;
    return error.code === "calendar_forbidden" ? `${FORBIDDEN_PREFIX}_${error.reason || "unknown"}` : error.code;
  }
}

/** Zveřejněná akce v režimu osobních kalendářů: vazba se jen označí za zpracovanou, zápis jde do kalendářů uživatelů. */
export async function markLinksDelivered(db: Executor, eventId?: string): Promise<void> {
  await db
    .update(calendarLinks)
    .set({ syncStatus: "synced", syncedRevision: sql`coalesce((select ${events.publishedRevision} from ${events} where ${events.id} = ${calendarLinks.eventId}), ${calendarLinks.syncedRevision})`, errorCode: null, attempts: 0, updatedAt: new Date() })
    .where(eventId ? eq(calendarLinks.eventId, eventId) : ne(calendarLinks.syncStatus, "synced"));
}

/** Důvod, proč účet z publika akci v osobním kalendáři nemá nebo mít nemusí. */
export type PersonalFailure = "retrying" | "blocked" | "revoked" | "calendar_deleted";

/**
 * Co o zápisu jedné akce do osobních kalendářů skutečně víme. Jediný důkaz zápisu je záznam
 * v `personal_calendar_entries`, který vzniká až po úspěšné odpovědi Googlu. Jeho otisk se porovná
 * s otiskem současné podoby akce (`desiredEntry`), takže zápis před změnou termínu se nepočítá jako aktuální.
 * Stav vazby `calendar_links` v osobním režimu nic nedokazuje (`markLinksDelivered` ji jen označí za zpracovanou).
 */
export type PersonalEventDelivery = {
  /** Akce má v kalendářích být (zveřejněná a nezrušená). U zrušené akce se záznamy naopak odebírají. */
  expected: boolean;
  /** Aktivní účty z publika akce. */
  audience: number;
  /** Účty z publika, které mají akci v kalendáři zapsanou (v jakékoli podobě). */
  written: number;
  /** Zapsaná podoba odpovídá současné akci. */
  current: number;
  /** Zapsaná podoba je starší (změna termínu, názvu, zápisu) a čeká na aktualizaci. */
  outdated: number;
  /** Propojený kalendář bez chyby, do kterého akce ještě zapsaná není. */
  missing: number;
  /** Účty z publika bez propojeného osobního kalendáře (nepropojeno nebo odmítnuto). */
  notConnected: number;
  /** Účty z publika, u kterých synchronizace selhává. Jen jména, bez e-mailů a kódů chyb. */
  failing: Array<{ name: string; reason: PersonalFailure }>;
  /** Poslední běh synchronizace osobního kalendáře někoho z publika (celého kalendáře, ne této akce). */
  lastSyncedAt: string | null;
};

export async function personalEventDelivery(db: Executor, eventId: string, snapshot: EventSnapshot): Promise<PersonalEventDelivery> {
  const people = (
    await db
      .select({ id: users.id, name: users.name, groups: users.groups })
      .from(users)
      .where(and(eq(users.orgId, config.orgId), eq(users.status, "active")))
  ).filter((u) => u.groups.includes(snapshot.audience));
  const ids = people.map((u) => u.id);
  const calendars = ids.length
    ? new Map((await db.select().from(personalCalendars).where(and(eq(personalCalendars.orgId, config.orgId), inArray(personalCalendars.userId, ids)))).map((r) => [r.userId, r]))
    : new Map<string, typeof personalCalendars.$inferSelect>();
  const entries = ids.length
    ? new Map(
        (
          await db
            .select({ userId: personalCalendarEntries.userId, dataHash: personalCalendarEntries.dataHash })
            .from(personalCalendarEntries)
            .where(and(eq(personalCalendarEntries.eventId, eventId), inArray(personalCalendarEntries.userId, ids)))
        ).map((e) => [e.userId, e.dataHash]),
      )
    : new Map<string, string>();
  const expected = snapshot.status !== "cancelled" && snapshot.type !== "holiday";
  const withMinutes = expected && entries.size ? (await eventsWithMinutes(db, [eventId])).has(eventId) : false;
  const selfInvite = personalSelfInvite();
  const result: PersonalEventDelivery = { expected, audience: people.length, written: entries.size, current: 0, outdated: 0, missing: 0, notConnected: 0, failing: [], lastSyncedAt: null };
  for (const person of people) {
    const row = calendars.get(person.id);
    const hash = entries.get(person.id);
    if (expected && hash !== undefined) {
      // Host je součástí otisku: zkušební pozvánka sobě mění podobu zápisu stejně jako při synchronizaci.
      const guest = selfInvite ? (row?.accountEmail ?? undefined) : undefined;
      if (hash === desiredEntry(eventId, snapshot, withMinutes, guest).hash) result.current += 1;
      else result.outdated += 1;
    }
    if (!row || row.status === "declined") {
      result.notConnected += 1;
      continue;
    }
    if (row.status === "revoked" || row.status === "calendar_deleted") {
      result.failing.push({ name: person.name, reason: row.status });
      continue;
    }
    if (row.status !== "active") continue;
    const state = stateOf(row);
    if (state.blocked || state.retrying) result.failing.push({ name: person.name, reason: state.blocked ? "blocked" : "retrying" });
    else if (expected && hash === undefined) result.missing += 1;
    if (row.syncedAt && (!result.lastSyncedAt || row.syncedAt.toISOString() > result.lastSyncedAt)) result.lastSyncedAt = row.syncedAt.toISOString();
  }
  result.failing.sort((a, b) => a.name.localeCompare(b.name, "cs"));
  return result;
}
