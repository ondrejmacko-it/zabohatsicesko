import { UCAST_PORT } from "./constants.mjs";
import { authFile, expect, expectNoHorizontalScroll, expectNoSeriousA11y, settle, test, type Role } from "./support";

// Stránka Účast (přehled očekávané účasti) v ukázce se zapnutou účastí (PARTICIPATION=on).
// Jen čte, nic nezapisuje: nepotká se se zápisy v e2e/ucast.spec.ts.

const BASE = `http://localhost:${UCAST_PORT}`;
const PROJECTS = ["windows-1280", "telefon-390"];

test.beforeEach(({}, info) => test.skip(!PROJECTS.includes(info.project.name), "jen windows-1280 a telefon-390"));

const subNav = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Vzdělávání" });

test.describe("Účast pro správce", () => {
  test.use({ storageState: authFile("spravce") });

  test("odkaz v menu, přehled podle akcí a lidí, detail akce a historie člověka @smoke", async ({ page }) => {
    await page.goto(`${BASE}/vzdelavani/harmonogram`);
    await settle(page);
    await subNav(page).getByRole("link", { name: "Účast", exact: true }).click();
    await page.waitForURL(/\/vzdelavani\/ucast$/);
    await settle(page);
    await expect(page.getByRole("heading", { name: "Očekávaná účast" })).toBeVisible();
    await expect(subNav(page).getByRole("link", { name: "Účast", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Všichni zaměstnanci.")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11y(page);

    // Detail první akce: seznam lidí se stavem účasti.
    const firstEvent = page.locator("table tbody tr").first().getByRole("link").first();
    const title = (await firstEvent.textContent())?.trim() ?? "";
    await firstEvent.click();
    await page.waitForURL(/akce=/);
    await settle(page);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Pohled podle lidí a historie člověka.
    await page.goto(`${BASE}/vzdelavani/ucast?pohled=lide`);
    await settle(page);
    await expect(page.getByRole("link", { name: "Podle lidí" })).toHaveAttribute("aria-current", "page");
    const person = page.locator("table tbody tr").first().getByRole("link").first();
    const name = (await person.textContent())?.trim() ?? "";
    await person.click();
    await page.waitForURL(/clovek=/);
    await settle(page);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("filtr bez výsledku ukáže prázdný stav a Zrušit filtr ho vrátí", async ({ page }) => {
    await page.goto(`${BASE}/vzdelavani/ucast?q=zadna-takova-akce-e2e`);
    await settle(page);
    await expect(page.getByText("V tomto období a filtru není žádná akce.")).toBeVisible();
    await page.getByRole("link", { name: "Zrušit filtr" }).click();
    await page.waitForURL(/\/vzdelavani\/ucast$/);
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("neexistující akce a člověk vrací 404", async ({ page }) => {
    expect((await page.request.get(`${BASE}/vzdelavani/ucast?akce=neexistuje`)).status()).toBe(404);
    expect((await page.request.get(`${BASE}/vzdelavani/ucast?clovek=neexistuje`)).status()).toBe(404);
  });
});

// Zaměstnanec ani vedoucí akce bez určených lidí Účast nevidí: v menu není a stránka je 404.
for (const role of ["ucastnikFp", "vedouci"] as Role[]) {
  test.describe(`Účast pro roli ${role}`, () => {
    test.use({ storageState: authFile(role) });

    test("bez odkazu v menu a stránka je 404", async ({ page }) => {
      await page.goto(`${BASE}/vzdelavani/harmonogram`);
      await settle(page);
      await expect(subNav(page).getByRole("link", { name: "Plán", exact: true })).toBeVisible();
      await expect(subNav(page).getByRole("link", { name: "Účast", exact: true })).toHaveCount(0);
      expect((await page.request.get(`${BASE}/vzdelavani/ucast`)).status()).toBe(404);
      expect((await page.request.get(`${BASE}/vzdelavani/ucast?pohled=lide`)).status()).toBe(404);
    });
  });
}
