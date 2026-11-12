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

/** Režimy integrací. Skutečné adaptéry se přidají až se schváleným testovacím přístupem. */
export const integrationModes = {
  calendar: "simulation",
  transcription: "fixture",
} as const;
