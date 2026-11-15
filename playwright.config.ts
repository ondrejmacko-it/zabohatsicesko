import { defineConfig, devices, type Project } from "@playwright/test";
import { DEMO_PORT } from "./e2e/constants.mjs";

// User agenty macOS. Vykresluje vždy Chromium, user agent jen ověří, že aplikace podle něj nic nemění.
const MAC_CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const MAC_SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15";

const desktop = (name: string, width: number, height: number, extra: Project["use"] = {}): Project => ({
  name,
  dependencies: ["prihlaseni"],
  testIgnore: /prihlaseni\.setup\.ts/,
  use: { ...devices["Desktop Chrome"], viewport: { width, height }, ...extra },
});

const phone = (name: string, width: number): Project => ({
  name,
  dependencies: ["prihlaseni"],
  testIgnore: /prihlaseni\.setup\.ts/,
  // Klávesnice a axe jen na počítači, telefon hlídá rozložení a okna.
  grepInvert: /@desktop/,
  use: { ...devices["Desktop Chrome"], viewport: { width, height: 760 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
});

const projects: Project[] = [
  { name: "prihlaseni", testMatch: /prihlaseni\.setup\.ts/ },
  desktop("windows-1280", 1280, 800),
  desktop("windows-1920", 1920, 1080),
  desktop("macos-1440", 1440, 900, { deviceScaleFactor: 2, userAgent: MAC_CHROME_UA }),
  desktop("macos-1512", 1512, 982, { deviceScaleFactor: 2, userAgent: MAC_SAFARI_UA }),
  phone("telefon-390", 390),
  phone("telefon-360", 360),
  phone("telefon-320", 320),
];

// Skutečný WebKit (jádro Safari) jen na vyžádání: v cloudovém prostředí není nainstalovaný.
// Na Macu: `npx playwright install webkit`, pak `E2E_WEBKIT=1 npm run e2e`.
if (process.env.E2E_WEBKIT === "1") {
  projects.push(desktop("webkit-1440", 1440, 900, { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }));
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
