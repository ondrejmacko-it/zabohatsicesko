import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";
import { DEMO_CODE } from "./constants.mjs";

/** Role ukázky: klíč souboru se session a text štítku na vstupu. */
export const ROLES = {
  spravce: "Správce ZBC ukázky",
  vedouci: "Vedoucí akce",
  ucastnikFp: "Účastník – finanční poradce",
  ucastnikRm: "Účastník – relationship manažer",
} as const;
export type Role = keyof typeof ROLES;

export const authFile = (role: Role) => `e2e/.auth/${role}.json`;

let ipCounter = 0;

/** Přihlášení do ukázky přes vstupní obrazovku. Každý kontext má vlastní IP kvůli limitu pokusů brány. */
export async function enterDemo(page: Page, role: Role) {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `10.20.${process.pid % 250}.${++ipCounter % 250}` });
  await page.goto("/vstup");
  const code = page.locator("input[name=code]");
  if (await code.count()) await code.fill(DEMO_CODE);
  await page.locator("label.persona", { hasText: ROLES[role] }).click();
  await page.getByRole("button", { name: "Vstoupit do ukázky" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/vstup"));
}

/** Chyby v konzoli, které k testu patří (stránka 404 vrací stav 404, to prohlížeč hlásí jako chybu). */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of 404/];

type Fixtures = { consoleErrors: string[] };

/**
 * Test s hlídáním konzole: každá chyba nebo nezachycená výjimka na stránce test shodí.
 * Test, který chybu čeká, ji z pole `consoleErrors` odebere.
 */
export const test = base.extend<Fixtures>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error" && !EXPECTED_CONSOLE.some((pattern) => pattern.test(message.text()))) errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
      await use(errors);
      expect(errors, "chyby v konzoli").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Stránka nesmí jít posunout do strany (ani obsah otevřeného okna). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const result: string[] = [];
    if (root.scrollWidth > root.clientWidth + 1) result.push(`stránka ${root.scrollWidth} > ${root.clientWidth}`);
    for (const dialog of document.querySelectorAll<HTMLElement>("dialog[open] .dialog-body")) {
      if (dialog.scrollWidth > dialog.clientWidth + 1) result.push(`okno ${dialog.scrollWidth} > ${dialog.clientWidth}`);
    }
    return result;
  });
  expect(overflow, "vodorovný posun").toEqual([]);
}

/**
 * axe bez závažných nálezů (critical, serious).
 * Kontrast (U02) zatím vypnutý: opravuje ho audit PR 6, který pravidlo zase zapne.
 */
export async function expectNoSeriousA11y(page: Page) {
  const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
  const serious = results.violations
    .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(serious, "závažné nálezy axe").toEqual([]);
}

/** Počká, až stránka doběhne (hydratace, odložené dotazy). */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
}
