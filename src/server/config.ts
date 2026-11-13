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
  if (isProduction) throw new Error("DEMO_ACCESS_CODE musí být nastavený a mít aspoň 12 znaků.");
  return null;
}

export const config = {
  orgId: seed.organization,
  get sessionSecret() {
    return sessionSecret();
  },
  /** null = lokální vývoj bez přístupové brány. Na hostingu je brána povinná. */
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
  /** Demo běží v referenčním čase ze seedu, aby scénář seděl na listopadová data. */
  get useRealClock() {
    return process.env.DEMO_CLOCK === "real";
  },
  referenceNow: new Date(seed.referenceNow),
  isProduction,
};

export function now(): Date {
  return config.useRealClock ? new Date() : config.referenceNow;
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

export type GoogleCalendarConfig = {
  clientId: string;
  clientSecret: string;
  /** Kalendář, do kterého Wiki zapisuje. Musí být na seznamu povolených. */
  calendarId: string;
  allowedCalendarIds: string[];
  /** Testovací příjemci pozvánek, přesné adresy malými písmeny. */
  allowedAttendees: string[];
  redirectUri: string;
};

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
  const problems: string[] = GOOGLE_CALENDAR_ENV.filter((name) => !env[name]?.trim());
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
};

export const GOOGLE_LOGIN_ENV = ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "APP_URL"] as const;

const LOGIN_ACCOUNT = /^[^@\s=]+@[^@\s=]+=[a-z0-9-]+$/;

/** Názvy proměnných, které přihlášení chybí nebo nedávají smysl. Hodnoty se nevypisují. */
export function googleLoginConfigProblems(): string[] {
  const env = process.env;
  const problems: string[] = GOOGLE_LOGIN_ENV.filter((name) => !env[name]?.trim());
  const entries = list(env.GOOGLE_LOGIN_ACCOUNTS);
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

/** Úplná konfigurace přihlášení Google identitou, nebo null. Neúplná konfigurace přihlášení nezapne. */
export function googleLoginConfig(): GoogleLoginConfig | null {
  if (loginMode() !== "google-test" || googleLoginConfigProblems().length) return null;
  const env = process.env;
  return {
    clientId: env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
    redirectUri: `${config.appUrl}/api/google/prihlaseni/callback`,
    accounts: new Map(
      list(env.GOOGLE_LOGIN_ACCOUNTS).map((entry) => {
        const [email, userId] = entry.split("=");
        return [email!.toLowerCase(), userId!] as const;
      }),
    ),
  };
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
