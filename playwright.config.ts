import { defineConfig, devices, type Project } from "@playwright/test";
import { DEMO_PORT, DEMO_TLS_PORT } from "./e2e/constants.mjs";

// User agenty macOS. Vykresluje vždy Chromium, user agent jen ověří, že aplikace podle něj nic nemění.
const MAC_CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const MAC_SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15";

// Testy se značkou @zapis-temat mění sdílená garantovaná témata a pořadí. Běží až ve vlastním projektu po všech
// ostatních (teardown přihlášení), takže čtecí testy vidí vždy seed a nemusí přijímat víc stavů. Závislost na všech
// projektech by nešla: Playwright na závislé projekty nepoužije filtr souboru a spustil by celou sadu.
const TOPIC_WRITES = /@zapis-temat/;

const desktop = (name: string, width: number, height: number, extra: Project["use"] = {}): Project => ({
  name,
  dependencies: ["prihlaseni"],
  testIgnore: /prihlaseni\.setup\.ts/,
  grepInvert: TOPIC_WRITES,
  use: { ...devices["Desktop Chrome"], viewport: { width, height }, ...extra },
});

const phone = (name: string, width: number): Project => ({
  name,
  dependencies: ["prihlaseni"],
  testIgnore: /prihlaseni\.setup\.ts/,
  // Klávesnice a axe jen na počítači, telefon hlídá rozložení a okna.
  grepInvert: [/@desktop/, TOPIC_WRITES],
  use: { ...devices["Desktop Chrome"], viewport: { width, height: 760 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
});

const projects: Project[] = [
  // Teardown přihlášení = zápisy témat: běží, až doběhnou všechny projekty, které na přihlášení závisí.
  { name: "prihlaseni", testMatch: /prihlaseni\.setup\.ts/, teardown: "zapis-temat" },
  desktop("windows-1280", 1280, 800),
  desktop("windows-1920", 1920, 1080),
  desktop("macos-1440", 1440, 900, { deviceScaleFactor: 2, userAgent: MAC_CHROME_UA }),
  desktop("macos-1512", 1512, 982, { deviceScaleFactor: 2, userAgent: MAC_SAFARI_UA }),
  phone("telefon-390", 390),
  phone("telefon-360", 360),
  phone("telefon-320", 320),
];
projects.push({
  ...desktop("zapis-temat", 1280, 800),
  dependencies: [],
  testMatch: /(temata-planovani|vyber-navrhu)\.spec\.ts/,
  grep: TOPIC_WRITES,
  grepInvert: undefined,
});

// Skutečný WebKit (jádro Safari) a Firefox jen na vyžádání: v cloudovém prostředí nemusí být nainstalované.
// `npx playwright install webkit firefox`, pak `E2E_WEBKIT=1 npm run e2e -- --project=webkit-1440 …`.
// E2E_WEBKIT=1 přidá WebKit (1440 Retina, telefon 390 a 320) a Firefox (1280, telefon 390) a Chromium 768 a 1024.
// Chromium s user agentem Safari (macos-1512) není test Safari; ten dělají jen projekty webkit-*.
if (process.env.E2E_WEBKIT === "1") {
  // WebKit jde přes HTTPS proxy (e2e/server.mjs), jinak by nepřijal cookie Secure na http://localhost.
  const tls = { baseURL: `https://localhost:${DEMO_TLS_PORT}`, ignoreHTTPSErrors: true };
  const webkit = { ...devices["Desktop Safari"], ...tls };
  const firefox = { ...devices["Desktop Firefox"] };
  projects.push(
    desktop("webkit-1440", 1440, 900, { ...webkit, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }),
    { ...phone("webkit-390", 390), use: { ...devices["iPhone 13"], ...tls, viewport: { width: 390, height: 760 } } },
    { ...phone("webkit-320", 320), use: { ...devices["iPhone SE"], ...tls, viewport: { width: 320, height: 640 } } },
    desktop("firefox-1280", 1280, 800, { ...firefox, viewport: { width: 1280, height: 800 } }),
    // Firefox nepodporuje isMobile, telefon = úzké okno s dotykem.
    { ...phone("firefox-390", 390), use: { ...firefox, viewport: { width: 390, height: 760 }, hasTouch: true } },
    desktop("chromium-768", 768, 1024),
    desktop("chromium-1024", 1024, 768),
  );
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 3,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://localhost:${DEMO_PORT}`,
    locale: "cs-CZ",
    timezoneId: "Europe/Prague",
    trace: "off",
  },
  projects,
  webServer: {
    command: "node e2e/server.mjs",
    url: `http://localhost:${DEMO_PORT}/soukromi`,
    timeout: 240_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
