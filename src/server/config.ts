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
    return (process.env.APP_URL ?? "https://wiki.example.invalid").replace(/\/$/, "");
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
  return process.env.CALENDAR_MODE === "google-test" ? "google-test" : "simulation";
}

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

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
