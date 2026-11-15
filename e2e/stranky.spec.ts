import { authFile, expect, expectNoHorizontalScroll, expectNoSeriousA11y, ROLES, settle, test, type Role } from "./support";

type PageCase = { name: string; path: string; heading: RegExp; text?: string };

const UNAVAILABLE = /Tato stránka není dostupná/;

/** Stránky a co má která role vidět. Nedostupná stránka vypadá stejně jako neexistující akce. */
function pagesFor(role: Role): PageCase[] {
  const admin = role === "spravce";
  const seesRm = role !== "ucastnikFp";
  const seesTeamA = role === "spravce" || role === "vedouci";
  return [
    { name: "Úvod", path: "/", heading: /Vítejte/ },
    { name: "Plán", path: "/vzdelavani/harmonogram", heading: /Vzdělávání/, text: "Setkání týmu" },
    { name: "Plán seznam", path: "/vzdelavani/harmonogram?mesic=2026-11&pohled=seznam", heading: /Vzdělávání/, text: "Setkání týmu" },
    { name: "Zápisy", path: "/vzdelavani/zapisy", heading: /Vzdělávání/ },
    { name: "Témata", path: "/vzdelavani/temata", heading: /Vzdělávání/, text: "Navrhnout téma" },
    { name: "Detail akce pro všechny", path: "/vzdelavani/akce/ev-11-5", heading: /Vzdělávání/, text: "Setkání týmu" },
    { name: "Detail akce RM", path: "/vzdelavani/akce/tr-rm-1112", heading: seesRm ? /Vzdělávání/ : UNAVAILABLE },
    { name: "Detail akce týmu A", path: "/vzdelavani/akce/ev-11-24", heading: seesTeamA ? /Vzdělávání/ : UNAVAILABLE },
    { name: "Správa", path: "/sprava", heading: admin ? /Správa systému/ : UNAVAILABLE },
    { name: "Integrace", path: "/vzdelavani/integrace", heading: admin ? /Vzdělávání/ : UNAVAILABLE },
    { name: "404", path: "/tato-stranka-neexistuje", heading: /Stránka nenalezena/ },
  ];
}

for (const role of Object.keys(ROLES) as Role[]) {
  test.describe(`stránky: ${ROLES[role]}`, () => {
    test.use({ storageState: authFile(role) });

    for (const pageCase of pagesFor(role)) {
      test(`${pageCase.name}: obsah a bez vodorovného posunu`, async ({ page }) => {
        await page.goto(pageCase.path);
        await settle(page);
        await expect(page.locator("h1").first()).toHaveText(pageCase.heading);
        if (pageCase.text) await expect(page.getByText(pageCase.text).filter({ visible: true }).first()).toBeVisible();
        await expectNoHorizontalScroll(page);
      });

      test(`${pageCase.name}: axe bez závažných nálezů @desktop`, async ({ page }) => {
        await page.goto(pageCase.path);
        await settle(page);
        await expectNoSeriousA11y(page);
      });
    }
  });
}

test.describe("přístup bez přihlášení", () => {
  test("chráněné stránky vedou na vstup", async ({ page }) => {
    for (const path of ["/", "/vzdelavani/harmonogram", "/sprava"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/vstup/);
    }
  });

  test("vstup do ukázky: kód, role, bez posunu", async ({ page }) => {
    await page.goto("/vstup");
    await settle(page);
    await expect(page.locator("input[name=code]")).toBeVisible();
    await expect(page.locator("label.persona")).toHaveCount(4);
    await expectNoHorizontalScroll(page);
  });

  test("špatný kód ukáže chybu a nepustí dál", async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ "x-forwarded-for": "10.99.0.1" });
    await page.goto("/vstup");
    await page.locator("input[name=code]").fill("spatny-kod-0000");
    await page.getByRole("button", { name: "Vstoupit do ukázky" }).click();
    await expect(page.locator(".form-error")).toBeVisible();
    await expect(page).toHaveURL(/\/vstup/);
  });

  test("každý skript stránky nese nonce z CSP", async ({ page }) => {
    for (const path of ["/vstup", "/soukromi", "/tato-stranka-neexistuje"]) {
      const response = await page.goto(path);
      const csp = response?.headers()["content-security-policy"] ?? "";
      const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
      expect(nonce, `nonce v CSP na ${path}`).toBeTruthy();
      const scripts = await page.locator("script").evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).nonce));
      expect(scripts.length).toBeGreaterThan(0);
      expect(scripts.every((value) => value === nonce), `skripty bez nonce na ${path}`).toBe(true);
    }
  });
});
