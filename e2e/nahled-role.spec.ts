import { authFile, expect, settle, test, type Role } from "./support";

// D4: náhled 1:1. Správce v náhledu kolegy vidí stejné nadpisy a stejná tlačítka jako ten kolega po přihlášení
// (stejná data, 1280). Jediný rozdíl: akční tlačítka jsou zamčená. Kontrolor zápisu a nadřízený nejsou samostatné
// účty ukázky, jsou to vazby: kontrolorem akcí je vedoucí (FP + RM), takže jeho pár kryje i roli FP+RM.
// Pravidla nadřízeného (důvody omluv) kryjí unit testy, v náhledu se důvody nezobrazují vůbec.

const PAIRS: { role: Role; key: string; label: string }[] = [
  { role: "ucastnikFp", key: "kolega-demo-ucastnik", label: "FP" },
  { role: "ucastnikRm", key: "kolega-demo-mimo-skupinu", label: "RM" },
  { role: "vedouci", key: "kolega-demo-vedouci", label: "vedoucí akce, kontrolor, FP+RM" },
];
const PAGES = ["/", "/vzdelavani/harmonogram?mesic=2026-11&pohled=seznam", "/vzdelavani/temata", "/vzdelavani/zapisy", "/sprava"];

type Snapshot = { headings: string[]; buttons: string[]; enabledActions: string[] };

async function snapshot(page: import("@playwright/test").Page, path: string): Promise<Snapshot> {
  await page.goto(path);
  await settle(page);
  return page.locator("main").evaluate((main) => {
    const visible = (el: Element) => (el as HTMLElement).offsetParent !== null || el.getClientRects().length > 0;
    const name = (el: Element) => (el.getAttribute("aria-label") ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
    // Osobní pozvánky z Kalendáře náhled nenačítá (soukromá data kolegy), proto se z porovnání vynechají.
    const personal = (el: Element) => /pozvánk/i.test(el.closest(".brief-row")?.textContent ?? "");
    const all = (sel: string) => [...main.querySelectorAll(sel)].filter((el) => visible(el) && !personal(el));
    // Odkaz-tlačítko (`a.btn`) je v náhledu zamčené `button`, porovnává se jako jedno ovládání.
    const buttons = all("button, [role=button], a.btn");
    return {
      // Počet úkolů v nadpisu se liší o osobní pozvánky; karta jen s pozvánkami se v náhledu nevykreslí.
      headings: all("h1, h2, h3")
        .filter((h) => !(h.id === "ceka" && ![...(h.closest("section")?.querySelectorAll(".brief-row") ?? [])].some((r) => !personal(r.firstElementChild ?? r))))
        .map((h) => name(h).replace(/\d+$/, "")),
      buttons: buttons.map(name),
      enabledActions: buttons
        .filter((el) => !(el as HTMLButtonElement).disabled && el.getAttribute("aria-disabled") !== "true")
        // Odeslání formuláře, který zapisuje (vyhledávání přes GET je jen čtení).
        .filter((el) => el.tagName === "BUTTON" && el.closest("form") !== null && el.closest("form")?.method !== "get")
        .map(name),
    };
  });
}

test.describe("náhled 1:1 proti skutečnému účtu @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  for (const pair of PAIRS) {
    test(`pohled ${pair.label}: stejné nadpisy a tlačítka, akce zamčené`, async ({ browser, page, context }) => {
      const real = await browser.newContext({ storageState: authFile(pair.role), viewport: { width: 1280, height: 800 } });
      const own = await real.newPage();
      await context.addCookies([
        { name: "zbc_nahled", value: `demo-spravce|${pair.key}`, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
      ]);
      for (const path of PAGES) {
        const expected = await snapshot(own, path);
        const viewed = await snapshot(page, path);
        await expect(page.getByTestId("pruh-nahledu"), path).toContainText("jen ke čtení");
        if (path === "/sprava") {
          // Kolega Správu nemá: skutečný účet dostane 404/odepření, náhled zástupný stav bez účtů.
          await expect(page.getByTestId("sprava-nahled"), path).toBeVisible();
          continue;
        }
        expect(viewed.headings, path).toEqual(expected.headings);
        expect(viewed.buttons, path).toEqual(expected.buttons);
        expect(viewed.enabledActions, `${path}: odeslání formuláře v náhledu`).toEqual([]);
      }
      await real.close();
    });
  }
});

// Bod 4: v náhledu menu Účet patří skutečnému účtu (výslovně označenému) a oslovení se v něm nemění.
test.describe("menu Účet v náhledu @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  test("skutečný účet je označený a oslovení se nenabízí", async ({ page, context }) => {
    const menu = page.locator(".account-menu");
    await page.goto("/");
    await menu.getByRole("button", { name: "Účet" }).click();
    await expect(menu.getByText("Upravit oslovení")).toBeVisible();
    await expect(menu.getByText("Skutečný účet")).toHaveCount(0);

    await context.addCookies([
      { name: "zbc_nahled", value: "demo-spravce|kolega-demo-ucastnik", domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/");
    await menu.getByRole("button", { name: "Účet" }).click();
    await expect(menu.getByText("Skutečný účet")).toBeVisible();
    await expect(menu.getByText("Upravit oslovení")).toHaveCount(0);
    await expect(page.locator("main").getByText("Upravit oslovení")).toHaveCount(0);
  });
});
