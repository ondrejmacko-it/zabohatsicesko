// Servery pro Playwright: jeden produkční build a dva `next start` nad vlastní PGlite.
// Ukázka (port 3310) a ostrá Wiki s falešnými hodnotami Google (port 3311). Všechny hodnoty jsou jen
// pro lokální test a nikde neplatí. Produkční build, ne `next dev`: chyby CSP se projeví jen v něm.
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { DEMO_CODE, DEMO_PORT, LIVE_PORT } from "./constants.mjs";


const shared = {
  ...process.env,
  NODE_ENV: "production",
  SESSION_SECRET: "e2e-only-session-secret-not-a-secret-000000",
  DEMO_ACCESS_CODE: DEMO_CODE,
  SIM_LATENCY_MS: "0",
  NEXT_TELEMETRY_DISABLED: "1",
};
delete shared.DATABASE_URL;

const demoEnv = { ...shared, PGLITE_DIR: ".data/e2e-demo" };
const liveEnv = {
  ...shared,
  PGLITE_DIR: ".data/e2e-live",
  WIKI_MODE: "production",
  LOGIN_MODE: "google-test",
  CALENDAR_MODE: "google-test",
  CALENDAR_ATTENDEES: "audience",
  APP_URL: `http://localhost:${LIVE_PORT}`,
  GOOGLE_OAUTH_CLIENT_ID: "e2e-falesny-klient.apps.googleusercontent.com",
  GOOGLE_OAUTH_CLIENT_SECRET: "e2e-falesne-tajemstvi",
  GOOGLE_CALENDAR_ID: "primary",
  GOOGLE_ALLOWED_CALENDAR_IDS: "primary",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  BOOTSTRAP_ADMIN_EMAILS: "spravce@example.invalid",
};

// Každý běh začíná z čistého seedu, testy pak nezávisí na tom, co zůstalo z minula.
rmSync(".data/e2e-demo", { recursive: true, force: true });
rmSync(".data/e2e-live", { recursive: true, force: true });

if (process.env.E2E_SKIP_BUILD !== "1") {
  const build = spawnSync("npx", ["next", "build"], { env: shared, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const start = (env, port) => spawn("npx", ["next", "start", "-p", String(port)], { env, stdio: "inherit" });

// Nejdřív ostrá Wiki. Playwright čeká na port ukázky, takže v tu chvíli běží obě.
const live = start(liveEnv, LIVE_PORT);
for (let i = 0; i < 120; i++) {
  try {
    if ((await fetch(`http://localhost:${LIVE_PORT}/soukromi`)).ok) break;
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
const demo = start(demoEnv, DEMO_PORT);

const stop = () => {
  live.kill();
  demo.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
live.on("exit", (code) => code && process.exit(code));
demo.on("exit", (code) => code && process.exit(code));
