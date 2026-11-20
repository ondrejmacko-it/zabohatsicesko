// Servery pro Playwright: jeden produkční build a dva `next start` nad vlastní PGlite.
// Ukázka (port 3310) a ostrá Wiki s falešnými hodnotami Google (port 3311). Všechny hodnoty jsou jen
// pro lokální test a nikde neplatí. Produkční build, ne `next dev`: chyby CSP se projeví jen v něm.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { createServer as createHttpServer, request as httpRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { DEMO_CODE, DEMO_PORT, DEMO_TLS_PORT, FEEDBACK_HOOK_PORT, FEEDBACK_HOOK_SECRET, LIVE_PORT } from "./constants.mjs";


const shared = {
  ...process.env,
  NODE_ENV: "production",
  SESSION_SECRET: "e2e-only-session-secret-not-a-secret-000000",
  DEMO_ACCESS_CODE: DEMO_CODE,
  SIM_LATENCY_MS: "0",
  NEXT_TELEMETRY_DISABLED: "1",
  // Testy běží přes http://localhost, WebKit by jinak povýšil požadavky na https (src/proxy.ts).
  CSP_UPGRADE_INSECURE: "0",
};
delete shared.DATABASE_URL;

// Ukázka posílá zpětnou vazbu na falešný webhook níže. Ostrá Wiki ho nemá, tam platí „není nastavené“.
const demoEnv = {
  ...shared,
  PGLITE_DIR: ".data/e2e-demo",
  FEEDBACK_WEBHOOK_URL: `http://127.0.0.1:${FEEDBACK_HOOK_PORT}/hook`,
  FEEDBACK_WEBHOOK_SECRET: FEEDBACK_HOOK_SECRET,
};
const liveEnv = {
  ...shared,
  PGLITE_DIR: ".data/e2e-live",
  WIKI_MODE: "production",
  LOGIN_MODE: "google-test",
  CALENDAR_MODE: "google-test",
  CALENDAR_ATTENDEES: "audience",
  // Osobní kalendáře účastníků, stejně jako ostrá Wiki po zapnutí na Vercelu.
  CALENDAR_DELIVERY: "personal",
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

// Falešný webhook Make.com: ověří tajemství, hlášení drží v paměti a vrátí je testu (GET /hlaseni).
// Text s „SIMULOVAT-CHYBU“ poprvé odmítne stavem 500, aby šlo ověřit chybu doručení a opakování.
const reports = [];
const failedOnce = new Set();
createHttpServer((req, res) => {
  if (req.method === "GET" && req.url === "/hlaseni") {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(reports));
    return;
  }
  if (req.method !== "POST" || req.url !== "/hook") return void res.writeHead(404).end();
  if (req.headers["x-zbc-feedback-secret"] !== FEEDBACK_HOOK_SECRET) return void res.writeHead(401).end();
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    try {
      const report = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (String(report.text).includes("SIMULOVAT-CHYBU") && !failedOnce.has(report.text)) {
        failedOnce.add(report.text);
        return void res.writeHead(500).end();
      }
      reports.push(report);
      res.writeHead(200).end("Accepted");
    } catch {
      res.writeHead(400).end();
    }
  });
}).listen(FEEDBACK_HOOK_PORT, "127.0.0.1");

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

// WebKit přes http://localhost neposílá cookie Secure (__Host-), Chromium a Firefox localhost berou jako
// bezpečný. Pro projekty webkit-* proto ukázka běží i za lokální TLS proxy s jednorázovým certifikátem,
// aplikace i její cookie zůstávají stejné jako v produkci.
if (process.env.E2E_WEBKIT === "1") {
  const dir = ".data/e2e-tls";
  mkdirSync(dir, { recursive: true });
  const cert = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost",
    "-keyout", `${dir}/key.pem`, "-out", `${dir}/cert.pem`], { stdio: "ignore" });
  if (cert.status !== 0) process.exit(cert.status ?? 1);
  createHttpsServer({ key: readFileSync(`${dir}/key.pem`), cert: readFileSync(`${dir}/cert.pem`) }, (req, res) => {
    const upstream = httpRequest(
      { host: "127.0.0.1", port: DEMO_PORT, method: req.method, path: req.url, headers: { ...req.headers, "x-forwarded-proto": "https" } },
      (reply) => {
        res.writeHead(reply.statusCode ?? 502, reply.headers);
        reply.pipe(res);
      },
    );
    upstream.on("error", () => res.writeHead(502).end());
    req.pipe(upstream);
  }).listen(DEMO_TLS_PORT);
}

const stop = () => {
  live.kill();
  demo.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
live.on("exit", (code) => code && process.exit(code));
demo.on("exit", (code) => code && process.exit(code));
