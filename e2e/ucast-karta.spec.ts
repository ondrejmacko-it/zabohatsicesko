import type { Locator, Page } from "@playwright/test";
import { UCAST_PORT } from "./constants.mjs";
import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Karta vlastní účasti v okně akce otevřeném KLIKEM v harmonogramu (zadání 26. 11., body 1, 2, 8).
// Trvalá regrese: karta účasti stojí až po obsahu akce (údaje / formulář editace), na všech šířkách bez
// vodorovného posunu. Screenshoty jdou do výstupu testu, s `UCAST_SHOTS=<složka>` do zadané složky.
// Zápisy dělá účastník RM a správce na PRVNÍ budoucí kartě (ucast.spec bere poslední), stav pak vrací.

test.describe.configure({ mode: "serial" });

const BASE = `http://localhost:${UCAST_PORT}`;
const WIDTHS = [320, 390, 768, 1024, 1280, 1440, 1920];
/** Zveřejněné akce po referenčním čase ukázky (12. 11. 9:00), na kterých jde účast měnit. */
const FUTURE = ["tr-rm-1112", "ev-11-18", "ev-11-20", "ev-11-24", "ev-11-26"];
const CANCELLED = "ev-11-4";
const PAST = "tr-fp-1111";

test.beforeEach(({}, info) => test.skip(info.project.name !== "windows-1280", "šířky nastavuje test sám"));

const height = (width: number) => (width < 768 ? 760 : 900);

async function shot(page: Page, name: string, info: { outputPath: (name: string) => string }) {
  const dir = process.env.UCAST_SHOTS;
  await page.screenshot({ path: dir ? `${dir}/${name}.png` : info.outputPath(`${name}.png`) });
}

async function plan(page: Page) {
  await page.goto(`${BASE}/vzdelavani/harmonogram?mesic=2026-11&pohled=seznam`);
  await settle(page);
}

/** Karta akce v harmonogramu: podle stavu účasti mezi budoucími akcemi, nebo podle ID. */
function card(page: Page, by: { state?: string; id?: string }) {
  const ids = by.id ? [by.id] : FUTURE;
  const state = by.state ? `[data-ucast="${by.state}"]` : "";
  // `data-ucast` je v měsíci na odkazu samotném, v seznamu na jeho potomkovi.
  const selector = ids.flatMap((id) => [`a[href*="akce=${id}"]${state}`, `a[href*="akce=${id}"]:has(${state || "*"})`]).join(", ");
  return page.locator(selector).filter({ visible: true }).first();
}

/** Otevře akci klikem na kartu (ne přes goto), vrátí okno akce. */
async function openByClick(page: Page, by: { state?: string; id?: string }) {
  await plan(page);
  const target = card(page, by);
  await expect(target).toBeVisible();
  await target.click();
  const dialog = page.locator("dialog[open]").last();
  await expect(dialog).toBeVisible();
  await settle(page);
  // Fokus je po otevření v okně (past fokusu Modal).
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  return dialog;
}

/** Karta účasti stojí až po obsahu akce: údaje (`.fact-list`, `.key-facts`) nebo formulář editace. */
async function expectPanelAfterContent(scope: Locator) {
  const panel = scope.locator("[data-ucast-panel]");
  await expect(panel).toBeVisible();
  const order = await scope.evaluate((root) => {
    const panelEl = root.querySelector("[data-ucast-panel]")!;
    const content = root.querySelector(".event-form, .fact-list, .key-facts");
    if (!content) return "chybí obsah akce";
    if (content.contains(panelEl)) return "karta účasti uvnitř obsahu (vnořený formulář)";
    return content.compareDocumentPosition(panelEl) & Node.DOCUMENT_POSITION_FOLLOWING ? "ok" : "karta účasti před obsahem";
  });
  expect(order).toBe("ok");
  // Formulář účasti nikdy není uvnitř formuláře editace.
  expect(await scope.locator("form form").count()).toBe(0);
}

/** Pro každou šířku: pořadí, bez posunu do strany, screenshot. */
async function acrossWidths(page: Page, name: string, info: Parameters<typeof shot>[2], scope: () => Locator) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: height(width) });
    await expectPanelAfterContent(scope());
    await expectNoHorizontalScroll(page);
    // Úzké šířky: karta účasti je pod obsahem, okno se musí dát doscrollovat až k ní.
    const panel = scope().locator("[data-ucast-panel]");
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toBeInViewport();
    await shot(page, `${name}-${width}`, info);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
}

test.describe("správce: karta účasti po formuláři editace", () => {
  test.use({ storageState: authFile("spravce") });

  test("povinná a dobrovolná akce otevřená klikem @smoke", async ({ page }, info) => {
    await openByClick(page, { state: "required" });
    await acrossWidths(page, "spravce-povinna", info, () => page.locator("dialog[open]").last());
    // Správce je v ukázce ve všech skupinách, dobrovolnou akci pro něj seed nemá (dobrovolná viz účastník).
  });

  test("změna účasti neuloží ani nezahodí rozpracovanou editaci akce", async ({ page }) => {
    const dialog = await openByClick(page, { id: "ev-11-24", state: "required" });
    await dialog.getByRole("link", { name: "Upravit akci" }).click();
    // Název v plánu je u některých typů jen pro čtení, rozpracovaná je proto poznámka/čas konce.
    const label = dialog.locator('input[name="endTime"]');
    const draft = "11:45";
    await label.fill(draft);
    await dialog.locator("[data-ucast-panel]").getByRole("button", { name: "Omluvit se" }).click();
    await page.getByRole("dialog", { name: "Omluvit se z akce?" }).getByLabel("Nemoc").check();
    await page.getByRole("dialog", { name: "Omluvit se z akce?" }).getByRole("button", { name: "Omluvit se" }).click();
    await expect(dialog.locator('[data-ucast-panel="excused"]')).toBeVisible();
    await expect(label).toHaveValue(draft);
    // Vrátit omluvu; okno zavřít bez uložení, název akce zůstal původní.
    await dialog.locator("[data-ucast-panel]").getByRole("button", { name: "Zrušit omluvu" }).click();
    await page.getByRole("dialog").filter({ hasText: "Zrušit omluvu" }).last().getByRole("button", { name: "Zrušit omluvu" }).click();
    await expect(dialog.locator('[data-ucast-panel="required"]')).toBeVisible();
    await expect(label).toHaveValue(draft);
    await plan(page);
    await expect(card(page, { id: "ev-11-24" })).toContainText("10:00–12:00");
  });
});

test.describe("účastník: stavy karty účasti", () => {
  // Desktop zapisuje jako účastník FP (jako `ucast.spec.ts`): telefon tam mění účast RM a bere jeho poslední
  // nepovinnou akci. Odhlášení RM odsud by mu ji vzalo a F04 by otevřel už proběhlou akci bez akcí.
  // FP tu bere první budoucí akce (tr-rm-1112, ev-11-18), `ucast.spec.ts` poslední (ev-11-20, ev-11-24, ev-11-26).
  test.use({ storageState: authFile("ucastnikFp") });

  test("povinná, omluva, omluveno, přihlášení a odhlášení", async ({ page }, info) => {
    let dialog = await openByClick(page, { state: "required" });
    await acrossWidths(page, "ucastnik-povinna", info, () => page.locator("dialog[open]").last());

    // Formulář omluvy: volby, nepovinná poznámka, přesný text soukromí; klávesnicí Tab a mezerník.
    await dialog.locator("[data-ucast-panel]").getByRole("button", { name: "Omluvit se" }).click();
    const excuse = page.getByRole("dialog", { name: "Omluvit se z akce?" });
    for (const reason of ["Nemoc", "Dovolená", "Jiné"]) await expect(excuse.getByLabel(reason)).toBeVisible();
    await expect(excuse).toContainText("Důvod a poznámku vidíš ty a tvůj oprávněný nadřízený. Do Google Kalendáře se neposílají.");
    // Důvod není předvybraný: omluva bez vědomé volby neprojde.
    await expect(excuse.locator('input[name="reason"]:checked')).toHaveCount(0);
    await excuse.getByLabel("Nemoc").focus();
    await page.keyboard.press("ArrowDown");
    await expect(excuse.getByLabel("Dovolená")).toBeChecked();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: height(width) });
      await expectNoHorizontalScroll(page);
      await shot(page, `formular-omluvy-${width}`, info);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await excuse.getByRole("button", { name: "Omluvit se" }).click();
    dialog = page.locator("dialog[open]").last();
    await expect(dialog.locator('[data-ucast-panel="excused"]')).toBeVisible();
    await acrossWidths(page, "omluveno", info, () => page.locator("dialog[open]").last());
    await dialog.locator("[data-ucast-panel]").getByRole("button", { name: "Zrušit omluvu" }).click();
    await page.getByRole("dialog").filter({ hasText: "Zrušit omluvu" }).last().getByRole("button", { name: "Zrušit omluvu" }).click();
    await expect(dialog.locator('[data-ucast-panel="required"]')).toBeVisible();

    dialog = await openByClick(page, { state: "optional" });
    await acrossWidths(page, "pred-prihlasenim", info, () => page.locator("dialog[open]").last());
    await dialog.locator("[data-ucast-panel]").getByRole("button", { name: "Přihlásit se" }).click();
    await page.getByRole("dialog", { name: "Přihlásit se na akci?" }).getByRole("button", { name: "Přihlásit se" }).click();
    await expect(dialog.locator('[data-ucast-panel="voluntary_enrolled"]')).toBeVisible();
    await acrossWidths(page, "prihlaseno", info, () => page.locator("dialog[open]").last());
    await dialog.locator("[data-ucast-panel]").getByRole("button", { name: "Odhlásit se" }).click();
    const confirm = page.getByRole("dialog", { name: "Odhlásit se z akce?" });
    await expect(confirm).toBeVisible();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: height(width) });
      await shot(page, `potvrzeni-odhlaseni-${width}`, info);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await confirm.getByRole("button", { name: "Odhlásit se" }).click();
    await expect(dialog.locator('[data-ucast-panel="withdrawn"]')).toBeVisible();
  });
});

test.describe("účastník FP: zrušená, proběhlá a stránka detailu", () => {
  test.use({ storageState: authFile("ucastnikFp") });

  test("zrušená a proběhlá akce bez akčních tlačítek, detail se stejným pořadím", async ({ page }, info) => {
    for (const [id, name] of [[CANCELLED, "zrusena"], [PAST, "probehla"]] as const) {
      const dialog = await openByClick(page, { id });
      const panel = dialog.locator("[data-ucast-panel]");
      if (await panel.count()) {
        await expect(panel.getByRole("button")).toHaveCount(0);
        await acrossWidths(page, name, info, () => page.locator("dialog[open]").last());
      } else {
        // Zrušená akce kartu účasti nemá: stav nese pás okna.
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: height(width) });
          await expectNoHorizontalScroll(page);
          await shot(page, `${name}-${width}`, info);
        }
        await page.setViewportSize({ width: 1280, height: 800 });
      }
    }
    await page.goto(`${BASE}/vzdelavani/akce/ev-11-18`);
    await settle(page);
    await acrossWidths(page, "detail", info, () => page.locator("main"));
  });
});

test.describe("náhled kolegy a skupiny: stejná karta, zamčená", () => {
  test.use({ storageState: authFile("spravce") });
  const cookie = (value: string) => ({ name: "zbc_nahled", value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" as const });

  for (const [key, name] of [["kolega-demo-ucastnik", "nahled-kolegy"], ["skupina-fp", "nahled-skupiny"]] as const) {
    test(`${name}: karta po obsahu, tlačítka zamčená`, async ({ page, context }, info) => {
      await context.addCookies([cookie(`demo-spravce|${key}`)]);
      const dialog = await openByClick(page, { state: "required" });
      const panel = dialog.locator("[data-ucast-panel]");
      await expect(panel.getByRole("heading", { name: "Účast v náhledu" })).toBeVisible();
      for (const button of await panel.getByRole("button").all()) await expect(button).toBeDisabled();
      await acrossWidths(page, name, info, () => page.locator("dialog[open]").last());
    });
  }
});
