import seed from "../../demo/seed.json";

// Konfigurace z prostředí. Hodnoty tajemství se nikde nelogují ani nevypisují.

const isProduction = process.env.NODE_ENV === "production";
const DEV_SESSION_SECRET = "pouze-pro-lokalni-vyvoj-nepouzivat-na-hostingu";

function sessionSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (isProduction) throw new Error("SESSION_SECRET musí být nastavený a mít aspoň 32 znaků.");
  return DEV_SESSION_SECRET;
}

function accessCode(): string | null {
  const value = process.env.DEMO_ACCESS_CODE;
  if (value && value.length >= 12) return value;
  // Ostrá Wiki fiktivní role ani bránu ukázky nemá, kód nepotřebuje.
  if (isProduction && !isLiveWiki()) throw new Error("DEMO_ACCESS_CODE musí být nastavený a mít aspoň 12 znaků.");
  return null;
}

export const config = {
  orgId: seed.organization,
  get sessionSecret() {
    return sessionSecret();
  },
  /** null = lokální vývoj (nebo ostrá Wiki) bez přístupové brány. Na hostingu ukázky je brána povinná. */
  get accessCode() {
    return accessCode();
  },
  get databaseUrl() {
    return process.env.DATABASE_URL ?? null;
  },
  get pgliteDir() {
    return process.env.PGLITE_DIR ?? ".data/pglite";
  },
  get appUrl() {
    return (process.env.APP_URL?.trim() || "https://wiki.example.invalid").replace(/\/+$/, "");
  },
  /** Demo běží v referenčním čase ze seedu, aby scénář seděl na listopadová data. Ostrá Wiki vždy ve skutečném. */
  get useRealClock() {
    return isLiveWiki() || process.env.DEMO_CLOCK === "real";
  },
  referenceNow: new Date(seed.referenceNow),
  isProduction,
};

export function now(): Date {
  return config.useRealClock ? new Date() : config.referenceNow;
}

export type WikiMode = "demo" | "production";

/**
 * Ostrá Wiki pro firmu (`WIKI_MODE=production`), nebo ukázka s fiktivními rolemi (výchozí). Ostrá Wiki
 * na serveru odmítá fiktivní role, obnovu ukázkových dat i přepínače simulace. Zapíná se výslovně,
 * aby chybějící proměnná nikdy nevypnula ochrany ukázky, a naopak.
 */
export function wikiMode(): WikiMode {
  return process.env.WIKI_MODE?.trim() === "production" ? "production" : "demo";
}

export const isLiveWiki = () => wikiMode() === "production";

export type EventVisibility = "audience" | "all-published";

/**
 * Zveřejněný firemní plán je společný všem přihlášeným. Viditelnost akce není oprávnění
 * ke změně účasti, nahrávkám, zápisům ani návrhům (ty kontroluje server samostatně).
 * Starší filtr podle publika je dostupný pouze jako výslovný nouzový rollback.
 */
export function eventVisibility(): EventVisibility {
  return process.env.EVENT_VISIBILITY?.trim() === "audience" ? "audience" : "all-published";
}

/** Migrace, bez kterých účast nesmí běžet (tabulka `event_participation` a stav „odhlášeno“). */
export const PARTICIPATION_MIGRATIONS = ["0016_event_participation", "0017_participation_withdrawn"] as const;

const schemaState = globalThis as unknown as { __zbcAppliedMigrations?: ReadonlySet<string> };

/** Volá `prepareDatabase` po migracích: které migrace databáze skutečně má (funkce podmíněné schématem). */
export function markParticipationSchema(applied: ReadonlySet<string>): void {
  const ready = PARTICIPATION_MIGRATIONS.every((id) => applied.has(id));
  if (!ready && process.env.PARTICIPATION?.trim() === "on") {
    console.warn(`[ucast] PARTICIPATION=on, ale chybí migrace ${PARTICIPATION_MIGRATIONS.join(", ")}: účast zůstává vypnutá`);
  }
  schemaState.__zbcAppliedMigrations = new Set(applied);
}

const migrationApplied = (id: string) => schemaState.__zbcAppliedMigrations?.has(id) === true;

/** Nadřízení pro omluvy (0018). Bez migrace se vazby nečtou ani neukládají, omluvy vidí jen omluvený. */
export function excuseManagersEnabled(): boolean {
  return participationEnabled() && migrationApplied("0018_excuse_managers");
}

/** Vlastní oslovení (0019). Bez migrace se nečte ani neukládá, pozdrav bere tvar ze slovníku. */
export function salutationsEnabled(): boolean {
  return migrationApplied("0019_user_salutation");
}

export type ParticipationReadiness = "on" | "off" | "missing-schema";

/** Stav připravenosti účasti pro kontrolu po nasazení (bez tajemství). */
export function participationReadiness(): ParticipationReadiness {
  if (process.env.PARTICIPATION?.trim() !== "on") return "off";
  return PARTICIPATION_MIGRATIONS.every(migrationApplied) ? "on" : "missing-schema";
}

/**
 * Individuální účast (F02–F05): štítky, přihlášky, omluvy, Moje/Všechny a hosté pozvánky podle účasti.
 * Zapíná se výslovně `PARTICIPATION=on` v ukázce i v ostré Wiki, ale jen pokud databáze má provedené
 * migrace 0016 a 0017 (pojistka proti zapnutí nad nepřipravenou databází: bez schématu se aplikace chová
 * jako dřív a tabulku účasti nečte; změnu účasti server odmítne, nic se tiše nezahodí). Ostrá Wiki
 * zůstává v produkčním režimu včetně přihlašování a oprávnění, účast nemění nic jiného.
 * Rollback: odebrat `PARTICIPATION` (záznamy v tabulce zůstanou, jen se nečtou).
 */
/** Tabulka účasti existuje (migrace 0016 a 0017), i když je přepínač vypnutý. Pro rollback hostů pozvánek. */
export function participationSchemaReady(): boolean {
  return PARTICIPATION_MIGRATIONS.every(migrationApplied);
}

export function participationEnabled(): boolean {
  return participationReadiness() === "on";
}

/**
 * Volba „Nahrávka“ u zápisu (F14). Automatický přepis zatím umí jen ukázkovou nahrávku, proto je nahrávání
 * ve výchozím stavu skryté a server ho odmítne. `RECORDING_DEMO=on` ukázku zapne (lokálně, e2e, dohodnuté
 * Preview). Už nahrané nahrávky zůstávají vidět a dají se přehrát. V ostré Wiki se přepínač ignoruje,
 * dokud přepis neumí skutečné schůzky.
 */
export function recordingUploadEnabled(): boolean {
  if (isLiveWiki()) return false;
  return process.env.RECORDING_DEMO?.trim() === "on";
}

export type CalendarMode = "simulation" | "google-test";

/**
 * Testovací režim Google Kalendáře se zapíná výslovně. Bez `CALENDAR_MODE=google-test` běží simulace,
 * takže chybějící nebo překlepnutá hodnota nikdy nezačne zapisovat do skutečného kalendáře.
 */
export function calendarMode(): CalendarMode {
  return process.env.CALENDAR_MODE?.trim() === "google-test" ? "google-test" : "simulation";
}

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export type AttendeeSource = "allowlist" | "audience";

/**
 * Komu jdou pozvánky v režimu Googlu. Výchozí je pevný seznam testovacích příjemců. Skutečné publikum
 * akce se zapíná výslovně `CALENDAR_ATTENDEES=audience`, překlep tedy nikdy nerozešle e-maily kolegům.
 */
export function attendeeSource(): AttendeeSource {
  return process.env.CALENDAR_ATTENDEES?.trim() === "audience" ? "audience" : "allowlist";
}

/**
 * OAuth aplikace v Google konzoli je ve stavu Testing, dokud ji správce nepřepne do produkce. V tomto
 * stavu platí souhlas ke Kalendáři 7 dní. Po přepnutí se nastaví `GOOGLE_OAUTH_PUBLISHED=1` a Wiki
 * přestane na vypršení upozorňovat.
 */
export const oauthConsentExpiryDays = (): number | null => (process.env.GOOGLE_OAUTH_PUBLISHED?.trim() === "1" ? null : 7);

export type CalendarDelivery = "personal" | "organizer";

/**
 * Jak se akce dostanou účastníkům, když běží Google Kalendář:
 * – `organizer` (výchozí): jeden organizátor (dedikovaný účet Google) zapisuje akce do svého kalendáře a zve
 *   účastníky skutečnými pozvánkami. Starší hodnota `invites` znamená totéž.
 * – `personal`: Wiki zapisuje do vlastního kalendáře „Vzdělávání ZBC“ v účtu každého uživatele (dočasně, odstraní PR B).
 * Režimy se vylučují: v `organizer` se osobní kalendáře nečtou ani nemění, v `personal` se nezve. V simulaci vždy `organizer`.
 */
export function calendarDelivery(): CalendarDelivery {
  if (calendarMode() !== "google-test") return "organizer";
  return process.env.CALENDAR_DELIVERY?.trim() === "personal" ? "personal" : "organizer";
}

export const personalDelivery = () => calendarDelivery() === "personal";
export const organizerDelivery = () => calendarDelivery() === "organizer";

/**
 * Tajné tokeny, kterými se prokazuje plánovač fronty Kalendáře (`/api/kalendar/fronta`):
 * `CALENDAR_WORKER_TOKEN` pro GitHub Actions a `CRON_SECRET`, který Vercel sám posílá svému cronu.
 * Kratší než 32 znaků se nepřijímá. Bez obou endpoint odmítá každý požadavek.
 */
export function calendarWorkerTokens(): string[] {
  return [process.env.CALENDAR_WORKER_TOKEN, process.env.CRON_SECRET]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length >= 32);
}

/**
 * Repozitář (`vlastník/název`), jehož workflow `kalendar-fronta.yml` se smí k frontě prokázat GitHub
 * OIDC tokenem místo sdíleného `CALENDAR_WORKER_TOKEN`. Prázdné = OIDC vypnuté.
 */
export function calendarWorkerOidcRepository(): string | null {
  const value = process.env.CALENDAR_WORKER_OIDC_REPOSITORY?.trim() ?? "";
  return /^[\w.-]+\/[\w.-]+$/.test(value) ? value : null;
}

/**
 * Zkušební režim upozornění v osobním kalendáři (`CALENDAR_PERSONAL_NOTIFY=self-invite`, výchozí vypnuto):
 * akce v kalendáři „Vzdělávání ZBC“ nese jako hosta účet samotného účastníka a zapisuje se se
 * `sendUpdates=all`, aby Google poslal e-mail o nové, změněné a zrušené akci. Dokumentace Googlu chování
 * u vlastníka kalendáře nepopisuje, rozhodne živý test.
 */
export const personalSelfInvite = () => personalDelivery() && process.env.CALENDAR_PERSONAL_NOTIFY?.trim() === "self-invite";

export type GoogleCalendarConfig = {
  clientId: string;
  clientSecret: string;
  /** Kalendář, do kterého Wiki zapisuje. Musí být na seznamu povolených. */
  calendarId: string;
  allowedCalendarIds: string[];
  /** Testovací příjemci pozvánek, přesné adresy malými písmeny. */
  allowedAttendees: string[];
  redirectUri: string;
  /**
   * Účet Google organizátora (`GOOGLE_ORGANIZER_EMAIL`, malými písmeny). Propojit Kalendář smí jen on:
   * porovnává se s e-mailem z ID tokenu od Googlu, ne se vstupem uživatele. `null` jen v osobním režimu.
   */
  organizerEmail: string | null;
};

const organizerRequired = () => process.env.CALENDAR_DELIVERY?.trim() !== "personal";
const organizerEmailValue = () => process.env.GOOGLE_ORGANIZER_EMAIL?.trim().toLowerCase() ?? "";

export const GOOGLE_CALENDAR_ENV = [
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_CALENDAR_ID",
  "GOOGLE_ALLOWED_CALENDAR_IDS",
  "GOOGLE_ALLOWED_ATTENDEES",
  "TOKEN_ENCRYPTION_KEY",
  "APP_URL",
] as const;

/** Názvy proměnných, které testovacímu režimu chybí nebo nedávají smysl. Hodnoty se nevypisují. */
export function googleCalendarConfigProblems(): string[] {
  const env = process.env;
  // Testovací příjemci jsou povinní jen tehdy, když se pozvánky omezují na ně. Při `audience` se nečtou.
  const required = GOOGLE_CALENDAR_ENV.filter((name) => name !== "GOOGLE_ALLOWED_ATTENDEES" || attendeeSource() === "allowlist");
  const problems: string[] = required.filter((name) => !env[name]?.trim());
  // Režim organizátora bez známého účtu organizátora by nepoznal, že Kalendář propojil osobní účet správce.
  // Pozvánky se proto bez něj neposílají (konfigurace není úplná, fronta stojí, Správa ukáže tento řádek).
  if (organizerRequired()) {
    const organizer = organizerEmailValue();
    if (!organizer) problems.push("GOOGLE_ORGANIZER_EMAIL");
    else if (!/^[^@\s]+@[^@\s]+$/.test(organizer)) problems.push("GOOGLE_ORGANIZER_EMAIL musí být celá adresa");
  }
  const allowed = list(env.GOOGLE_ALLOWED_CALENDAR_IDS);
  if (env.GOOGLE_CALENDAR_ID && allowed.length && !allowed.includes(env.GOOGLE_CALENDAR_ID.trim())) {
    problems.push("GOOGLE_CALENDAR_ID není v GOOGLE_ALLOWED_CALENDAR_IDS");
  }
  if (list(env.GOOGLE_ALLOWED_ATTENDEES).some((entry) => !/^[^@\s]+@[^@\s]+$/.test(entry))) {
    problems.push("GOOGLE_ALLOWED_ATTENDEES smí obsahovat jen celé adresy");
  }
  if (env.TOKEN_ENCRYPTION_KEY && Buffer.from(env.TOKEN_ENCRYPTION_KEY, "base64").length !== 32) {
    problems.push("TOKEN_ENCRYPTION_KEY musí být 32 bajtů v base64");
  }
  return problems;
}

/** Úplná konfigurace testovacího režimu, nebo null. Neúplná konfigurace integraci nespustí. */
export function googleCalendarConfig(): GoogleCalendarConfig | null {
  if (calendarMode() !== "google-test" || googleCalendarConfigProblems().length) return null;
  const env = process.env;
  return {
    clientId: env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
    calendarId: env.GOOGLE_CALENDAR_ID!.trim(),
    allowedCalendarIds: list(env.GOOGLE_ALLOWED_CALENDAR_IDS),
    allowedAttendees: list(env.GOOGLE_ALLOWED_ATTENDEES).map((entry) => entry.toLowerCase()),
    redirectUri: `${config.appUrl}/api/google/kalendar/callback`,
    organizerEmail: organizerRequired() ? organizerEmailValue() : null,
  };
}

export type LoginMode = "demo" | "google-test";

/**
 * Přihlášení Google identitou je druhý režim vedle fiktivních rolí a zapíná se výslovně.
 * Bez `LOGIN_MODE=google-test` se tlačítko Google nenabízí a trasy přihlášení vrací 404.
 */
export function loginMode(): LoginMode {
  return process.env.LOGIN_MODE?.trim() === "google-test" ? "google-test" : "demo";
}

export type GoogleLoginConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /**
   * Volitelný zaváděcí seznam: ověřený e-mail malými písmeny → ID uživatele Wiki. Slouží jen k prvnímu
   * svázání účtu (například s fiktivní rolí). Další účty zve nebo schvaluje správce ve Wiki.
   */
  accounts: ReadonlyMap<string, string>;
  /**
   * Adresy malými písmeny, jejichž první přihlášení Googlem založí aktivního správce. Slouží ke spuštění
   * prázdné ostré Wiki, kde ještě nikdo nemůže nikoho pozvat. Platí jen pro adresu bez účtu ve Wiki.
   */
  bootstrapAdmins?: ReadonlySet<string>;
};

export const GOOGLE_LOGIN_ENV = ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "APP_URL"] as const;

const LOGIN_ACCOUNT = /^[^@\s=]+@[^@\s=]+=[a-z0-9-]+$/;
const EMAIL = /^[^@\s=]+@[^@\s=]+$/;

/** Názvy proměnných, které přihlášení chybí nebo nedávají smysl. Hodnoty se nevypisují. */
export function googleLoginConfigProblems(): string[] {
  const env = process.env;
  const problems: string[] = GOOGLE_LOGIN_ENV.filter((name) => !env[name]?.trim());
  if (list(env.BOOTSTRAP_ADMIN_EMAILS).some((entry) => !EMAIL.test(entry))) {
    problems.push("BOOTSTRAP_ADMIN_EMAILS má obsahovat jen e-mailové adresy oddělené čárkou");
  }
  // Ostrá Wiki fiktivní role nezná, zaváděcí seznam v ní nemá smysl a ignoruje se.
  const entries = isLiveWiki() ? [] : list(env.GOOGLE_LOGIN_ACCOUNTS);
  if (entries.some((entry) => !LOGIN_ACCOUNT.test(entry))) {
    problems.push("GOOGLE_LOGIN_ACCOUNTS má mít tvar adresa=id-uzivatele, oddělené čárkou");
  } else {
    const emails = entries.map((entry) => entry.split("=")[0]!.toLowerCase());
    const userIds = entries.map((entry) => entry.split("=")[1]!);
    // Jeden účet Google patří jednomu uživateli a naopak, jinak by vazba na `sub` nebyla jednoznačná.
    if (new Set(emails).size !== emails.length || new Set(userIds).size !== userIds.length) {
      problems.push("GOOGLE_LOGIN_ACCOUNTS smí každou adresu i každého uživatele uvést jen jednou");
    }
  }
  return problems;
}

/**
 * Hlavní správce: první adresa z `BOOTSTRAP_ADMIN_EMAILS`. Dovnitř se dostane vždy (`/vstup?spravce=1`),
 * jeho přihlášení platí dlouhodobě a jeho účet, odkazy ani zařízení nikdo ve Wiki nemění. Jediná výjimka:
 * odkaz pro další zařízení si smí vytvořit (a zneplatnit) on sám.
 */
export function primaryAdminEmail(): string | null {
  return list(process.env.BOOTSTRAP_ADMIN_EMAILS)[0]?.toLowerCase() ?? null;
}

export const isPrimaryAdmin = (account: { email: string }): boolean => {
  const primary = primaryAdminEmail();
  return primary !== null && account.email.trim().toLowerCase() === primary;
};

/** Úplná konfigurace přihlášení Google identitou, nebo null. Neúplná konfigurace přihlášení nezapne. */
export function googleLoginConfig(): GoogleLoginConfig | null {
  if (loginMode() !== "google-test" || googleLoginConfigProblems().length) return null;
  const env = process.env;
  return {
    clientId: env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
    redirectUri: `${config.appUrl}/api/google/prihlaseni/callback`,
    accounts: new Map(
      (isLiveWiki() ? [] : list(env.GOOGLE_LOGIN_ACCOUNTS)).map((entry) => {
        const [email, userId] = entry.split("=");
        return [email!.toLowerCase(), userId!] as const;
      }),
    ),
    bootstrapAdmins: new Set(list(env.BOOTSTRAP_ADMIN_EMAILS).map((entry) => entry.toLowerCase())),
  };
}

/**
 * Co ostré Wiki chybí ke spuštění. Bez přihlášení Googlem by se do ní nikdo nedostal a bez Kalendáře
 * by plán tiše běžel nad simulací. Hodnoty se nevypisují, jen názvy.
 */
export function liveWikiConfigProblems(): string[] {
  if (!isLiveWiki()) return [];
  const problems: string[] = [];
  if (loginMode() !== "google-test") problems.push("LOGIN_MODE");
  else problems.push(...googleLoginConfigProblems());
  if (calendarMode() !== "google-test") problems.push("CALENDAR_MODE");
  else problems.push(...googleCalendarConfigProblems());
  return [...new Set(problems)];
}

/** Klíč pro šifrování tokenů v databázi. Jen na serveru, nikdy v logu. */
export function tokenEncryptionKey(): Buffer {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY musí být 32 bajtů v base64.");
  return key;
}

/** Režimy integrací. Kalendář se řídí prostředím, přepis zatím zná jen testovací nahrávku. */
export const integrationModes = {
  get calendar(): CalendarMode {
    return calendarMode();
  },
  transcription: "fixture",
} as const;

export const FEEDBACK_ENV = ["FEEDBACK_WEBHOOK_URL", "FEEDBACK_WEBHOOK_SECRET"] as const;

/**
 * Webhook Make.com pro zpětnou vazbu, nebo null, když není nastavený. Adresa i tajemství zůstávají na serveru.
 * Jen https, http jen na vlastní počítač (lokální test). Tajemství aspoň 32 znaků.
 */
export function feedbackWebhook(): { url: string; secret: string } | null {
  const url = process.env.FEEDBACK_WEBHOOK_URL?.trim();
  const secret = process.env.FEEDBACK_WEBHOOK_SECRET?.trim();
  if (!url || !secret || secret.length < 32) return null;
  try {
    const parsed = new URL(url);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) return null;
    if (parsed.username || parsed.password) return null;
    return { url: parsed.toString(), secret };
  } catch {
    return null;
  }
}
