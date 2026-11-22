import type { Locator, Page } from "@playwright/test";
import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Ukázka běží s referenčním časem 12. 11. 2026 9:00. Zápisy do sdílených dat dělá jen jeden projekt a ve
// vlastních vzdálených měsících (březen a duben 2027), aby nekolidovaly s ostatními testy.

const menuButton = (scope: Page | Locator, label: string) => scope.getByRole("button", { name: `Možnosti akce ${label}`, exact: true });
const menuItems = (page: Page) => page.locator(".menu-list:not([hidden])").locator("a, button");
const agendaDay = (page: Page, day: string) => page.locator(`[data-agenda-day="${day}"]`).filter({ visible: true });

async function openPlan(page: Page, query = "") {
  await page.goto(`/vzdelavani/harmonogram${query}`);
  await settle(page);
}

/** Návrh založený přes Přidat akci (uložit jako návrh). Vrací jeho id z karty v mřížce. */
async function createDraft(page: Page, label: string, date: string) {
  await openPlan(page, `?mesic=${date.slice(0, 7)}`);
  await page.getByRole("button", { name: "Přidat akci", exact: true }).click();
  const add = page.getByRole("dialog", { name: "Přidat akci" });
  await add.getByLabel("Název akce", { exact: true }).fill(label);
  await add.getByLabel("Datum", { exact: true }).fill(date);
  await add.getByRole("button", { name: "Uložit jako návrh" }).click();
  await expect(add).toBeHidden();
  await page.waitForURL(new RegExp(`mesic=${date.slice(0, 7)}`));
  await settle(page);
  const card = page.locator("a[data-move-id]").filter({ hasText: label });
  await expect(card).toHaveCount(1);
  return (await card.getAttribute("data-move-id"))!;
}

test.describe("Rychlé akce ⋯ u návrhu @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  test("scénář 1: Upravit, Přesunout, Duplikovat, Zveřejnit a Smazat s potvrzením", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "windows-1280", "zápis jen jednou");
    const label = `Rychlá akce e2e ${Date.now()}`;
    const id = await createDraft(page, label, "2027-03-10");
    const button = menuButton(page, label);

    // Pořadí: hlavní akce, úpravy, méně časté a oddělené nebezpečné. Klik na ⋯ neotevře okno akce.
    await button.click();
    await expect(menuItems(page)).toHaveText(["Upravit akci", "Přesunout termín…", "Duplikovat akci", "Zveřejnit návrh…", "Smazat návrh…"]);
    await expect(page).not.toHaveURL(/akce=/);
    await expect(page.locator(".menu-list:not([hidden]) hr.menu-divider")).toHaveCount(1);

    await page.getByRole("link", { name: "Upravit akci" }).click();
    await expect(page).toHaveURL(new RegExp(`akce=${id}`));
    await expect(page).toHaveURL(/mesic=2027-03/);
    const win = page.getByRole("dialog", { name: label });
    await expect(win).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(win).toBeHidden();

    // Přesunout termín: stávající výběr dne a potvrzení.
    await button.click();
    await page.getByRole("button", { name: "Přesunout termín…" }).click();
    const move = page.getByRole("dialog", { name: "Přesunout akci" });
    await move.getByRole("button", { name: "čtvrtek 11. 3." }).click();
    await expect(move).toContainText("Přesun se uloží jako návrh.");
    await move.getByRole("button", { name: "Potvrdit" }).click();
    await expect(move).toBeHidden();
    await expect(page.locator('td[data-drop-day="2027-03-11"]').locator(`[data-move-id="${id}"]`)).toHaveCount(1);

    // Duplikovat: předvyplněné okno, jen jako návrh. Nic se neuloží.
    await button.click();
    await page.getByRole("link", { name: "Duplikovat akci" }).click();
    const copy = page.getByRole("dialog", { name: "Duplikovat akci" });
    await expect(copy.getByLabel("Název akce", { exact: true })).toHaveValue(label);
    await expect(copy.getByLabel("Datum", { exact: true })).toHaveValue("2027-03-18");
    await page.keyboard.press("Escape");
    await expect(copy).toBeHidden();
    await expect(page).not.toHaveURL(/kopie=/);

    // Zveřejnit návrh: stejné potvrzení úplnosti a dopadu jako hromadné zveřejnění.
    await button.click();
    await page.getByRole("button", { name: "Zveřejnit návrh…" }).click();
    const publish = page.getByRole("dialog", { name: "Zveřejnit návrh" });
    await expect(publish).toContainText("Chybí téma a vedoucí.");
    await expect(publish).toContainText("Simulace");
    const confirm = publish.getByRole("button", { name: "Zveřejnit", exact: true });
    await expect(confirm).toBeDisabled();
    await publish.getByLabel("Zveřejnit i bez tématu a vedoucího.").check();
    await confirm.click();
    await expect(publish).toBeHidden();
    await expect(page).toHaveURL(/mesic=2027-03/);
    const card = page.locator(`a[data-move-id="${id}"]`);
    await expect(card).not.toContainText("Návrh");

    // Zveřejněná akce už nejde smazat, jen zrušit.
    await button.click();
    await expect(menuItems(page)).toHaveText(["Upravit akci", "Přesunout termín…", "Duplikovat akci", "Otevřít podrobnosti", "Zrušit akci…"]);
    await page.keyboard.press("Escape");

    // Smazat návrh: druhý návrh, potvrzení a Plán zůstane na stejném měsíci.
    const other = `Smazat e2e ${Date.now()}`;
    const otherId = await createDraft(page, other, "2027-03-17");
    await menuButton(page, other).click();
    await page.getByRole("button", { name: "Smazat návrh…" }).click();
    const remove = page.getByRole("dialog", { name: "Smazat návrh" });
    await remove.getByRole("button", { name: "Smazat návrh" }).click();
    await expect(remove).toBeHidden();
    await expect(page.locator(`a[data-move-id="${otherId}"]`)).toHaveCount(0);
    await expect(page).toHaveURL(/mesic=2027-03/);
  });

  test("scénář 3: Duplikovat zveřejněnou akci vytvoří nový návrh s předvyplněnými údaji", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "windows-1280", "zápis jen jednou");
    await openPlan(page, "?mesic=2026-11&kopie=ev-11-18");
    const copy = page.getByRole("dialog", { name: "Duplikovat akci" });
    await expect(copy).toBeVisible();
    await expect(copy.getByLabel("Datum", { exact: true })).toHaveValue("2026-11-25");
    await expect(copy).toContainText("Navržené datum, zkontroluj.");
    await expect(copy.getByLabel(/^Téma/)).toHaveValue("Porovnání dvou postupů");
    await expect(copy.getByLabel(/^Vede/)).toHaveValue("demo-vedouci");
    await expect(copy.getByRole("button", { name: /Zveřejnit/ })).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    await copy.getByLabel("Datum", { exact: true }).fill("2027-04-07");
    await copy.getByRole("button", { name: "Uložit jako návrh" }).click();
    await expect(copy).toBeHidden();
    // Rovnou se otevře okno nové akce v jejím měsíci: nový návrh, ne původní akce.
    await page.waitForURL(/mesic=2027-04&akce=/);
    const newId = new URL(page.url()).searchParams.get("akce");
    expect(newId).not.toBe("ev-11-18");
    const win = page.getByRole("dialog", { name: "Portfolio tým" });
    await expect(win).toContainText("Návrh · kolegové ho zatím nevidí");
    await expect(win.getByLabel(/^Téma/)).toHaveValue("Porovnání dvou postupů");
  });
});

test.describe("Rychlé akce ⋯ u zveřejněné akce @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  test("scénář 2: bez Smazat, Zrušit ukáže dopad a Zpět nic nezmění", async ({ page }) => {
    await openPlan(page);
    const button = menuButton(page, "Portfolio tým");
    await button.click();
    await expect(menuItems(page)).toHaveText(["Upravit akci", "Přesunout termín…", "Duplikovat akci", "Otevřít podrobnosti", "Zrušit akci…"]);
    await page.getByRole("button", { name: "Zrušit akci…" }).click();
    const dialog = page.getByRole("dialog", { name: "Zrušit akci" });
    await expect(dialog).toContainText("Koho se zrušení dotkne");
    await expect(dialog).toContainText("uvidí ve Wiki skupina");
    await dialog.getByRole("button", { name: "Zpět" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('a[data-move-id="ev-11-18"]')).not.toContainText("Zrušeno");
  });

  test("klávesnice: Enter otevře, Esc zavře a vrátí fokus na ⋯", async ({ page }) => {
    await openPlan(page);
    const button = menuButton(page, "Portfolio tým");
    await button.focus();
    await expect(button).toHaveCSS("opacity", "1");
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Upravit akci" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
    await expect(page).not.toHaveURL(/akce=/);
  });

  test("svátek menu nemá, Vybrat návrhy menu skryje", async ({ page }) => {
    await openPlan(page);
    await expect(menuButton(page, "Státní svátek")).toHaveCount(0);
    const menus = page.getByRole("button", { name: /^Možnosti akce / }).filter({ visible: true });
    expect(await menus.count()).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Vybrat návrhy" }).click();
    await expect(menus).toHaveCount(0);
    await page.getByRole("button", { name: "Ukončit výběr" }).click();
    expect(await menus.count()).toBeGreaterThan(0);
  });
});

test.describe("Rychlé akce ⋯ pro účastníka @desktop", () => {
  test.use({ storageState: authFile("ucastnikFp") });

  test("budoucí akce menu nemají, jinde jen čtecí položky", async ({ page }) => {
    await openPlan(page);
    const menus = page.getByRole("button", { name: /^Možnosti akce / }).filter({ visible: true });
    for (let i = 0; i < (await menus.count()); i++) {
      await menus.nth(i).click();
      const items = await menuItems(page).allTextContents();
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items.filter((item) => /Upravit|Duplikovat|Přesunout|Zveřejnit|Smazat|Zrušit/.test(item))).toEqual([]);
      await page.keyboard.press("Escape");
    }
  });
});

test.describe("Rychlé akce ⋯ na telefonu", () => {
  test.use({ storageState: authFile("spravce") });
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, "telefon"));

  test("scénář 11: ťuknutí na ⋯ otevře menu v okně, neotevře detail, úchyt přesunu funguje dál", async ({ page }) => {
    await openPlan(page);
    const day = agendaDay(page, "2026-11-18");
    await page.evaluate(() => document.querySelector('[data-agenda-day="2026-11-18"]')!.scrollIntoView({ block: "center" }));
    const button = menuButton(day, "Portfolio tým");
    const box = (await button.boundingBox())!;
    // Viditelná ikona je malá, dotyková plocha (pseudo-prvek) větší. Ťuknutí na ⋯ detail neotevře.
    expect(box.width).toBeGreaterThanOrEqual(24);
    await button.tap();
    await expect(page).not.toHaveURL(/akce=/);
    const list = page.locator(".menu-list:not([hidden])");
    await expect(list).toBeVisible();
    const placed = (await list.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(placed.x).toBeGreaterThanOrEqual(0);
    expect(placed.x + placed.width).toBeLessThanOrEqual(viewport.width);
    expect(placed.y).toBeGreaterThanOrEqual(0);
    expect(placed.y + placed.height).toBeLessThanOrEqual(viewport.height);
    await expectNoHorizontalScroll(page);

    // Ťuknutí mimo menu ho zavře.
    await page.locator("#mesic").tap();
    await expect(list).toBeHidden();
    await expect(page).not.toHaveURL(/akce=/);

    // Přesunout termín z menu i úchyt otevřou stejný výběr dne.
    await button.tap();
    await page.getByRole("button", { name: "Přesunout termín…" }).tap();
    const picker = page.getByRole("dialog", { name: "Přesunout akci" });
    await expect(picker.getByRole("group", { name: "Nový den akce" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    await day.locator("[data-move-handle]").first().tap();
    await expect(picker).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
  });
});

test.describe("⋯ a „+“ v mřížce @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  // A-01, A-08, A-02: ⋯ je vidět bez najetí a trefí se, menu roste do volné strany, „+“ v prázdném dni je naznačené.
  test("viditelné tlačítko, menu podle strany, decentní plus", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
    await settle(page);
    const triggers = page.locator(".menu-card-trigger:visible");
    const first = triggers.first();
    const box = (await first.boundingBox())!;
    // Malé, ale nalezitelné: viditelná plocha aspoň 24 × 20 px, dotyková (pseudo-prvek) větší.
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(20);
    expect(await first.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");

    const viewport = page.viewportSize()!;
    for (const trigger of [first, triggers.last()]) {
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();
      const anchor = (await trigger.boundingBox())!;
      const list = page.locator(".menu-list:visible");
      const menu = (await list.boundingBox())!;
      if (anchor.x + anchor.width / 2 < viewport.width / 2) expect(Math.abs(menu.x - anchor.x)).toBeLessThan(2);
      else expect(Math.abs(menu.x + menu.width - (anchor.x + anchor.width))).toBeLessThan(2);
      await page.keyboard.press("Escape");
      await expect(list).toHaveCount(0);
    }

    await page.goto("/vzdelavani/harmonogram?mesic=2027-02");
    await settle(page);
    const emptyPlus = page.locator("td:not(:has(a[class*='event'])) a[aria-label^='Přidat akci na']").first();
    await page.mouse.move(0, 0);
    expect(Number(await emptyPlus.evaluate((el) => getComputedStyle(el).opacity))).toBeCloseTo(0.35, 2);
  });
});

test.describe("⋯ v kartě mřížky: místo, překryv a kliknutí @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  // P1-1: ⋯ má v kartě vyhrazené místo (vpravo nahoře v řádku názvu) a nepřekrývá žádný text ani výstrahu.
  test("⋯ nepřekrývá text karty a klik na něj neotevře detail ani nezačne tažení", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
    await settle(page);
    const overlaps = await page.evaluate(() => {
      const hits: string[] = [];
      for (const wrap of document.querySelectorAll("td [class*='cardWrap']")) {
        const trigger = wrap.querySelector(".menu-card-trigger");
        const card = wrap.querySelector("a");
        if (!trigger || !card) continue;
        const t = trigger.getBoundingClientRect();
        const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
        const parts: Element[] = [...card.querySelectorAll("svg")];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim() || (node.parentElement?.closest(".visually-hidden"))) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const r of range.getClientRects()) {
            if (r.right > t.left && r.left < t.right && r.bottom > t.top && r.top < t.bottom) hits.push(`${card.textContent?.slice(0, 30)}: ${node.textContent}`);
          }
        }
        for (const icon of parts) {
          const r = icon.getBoundingClientRect();
          if (r.right > t.left && r.left < t.right && r.bottom > t.top && r.top < t.bottom) hits.push(`${card.textContent?.slice(0, 30)}: ikona`);
        }
      }
      return hits;
    });
    expect(overlaps).toEqual([]);

    // Klik na ⋯ karty, kterou jde táhnout: menu se otevře, okno akce ne a tažení nezačne.
    await page.evaluate(() => {
      (window as unknown as { dragStarts: number }).dragStarts = 0;
      document.addEventListener("dragstart", () => (window as unknown as { dragStarts: number }).dragStarts++, true);
    });
    const draggable = page.locator("[class*='cardWrap']:has(> a[draggable='true'])").first();
    const trigger = draggable.locator(".menu-card-trigger");
    const before = page.url();
    await trigger.click();
    await expect(page.locator(".menu-list:visible")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(page.url()).toBe(before);
    // Pokus o tažení za ⋯ také tažení karty nespustí.
    await page.keyboard.press("Escape");
    const box = (await trigger.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 80, box.y + 120, { steps: 6 });
    await page.mouse.up();
    expect(await page.evaluate(() => (window as unknown as { dragStarts: number }).dragStarts)).toBe(0);
    expect(page.url()).toBe(before);
  });

  test("dlouhé menu se přizpůsobí nízkému oknu a neořízne se", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 260 });
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
    await settle(page);
    const trigger = page.locator(".menu-card-trigger:visible").nth(4);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const list = page.locator(".menu-list:visible");
    await expect(list).toBeVisible();
    const menu = (await list.boundingBox())!;
    expect(menu.y).toBeGreaterThanOrEqual(0);
    expect(menu.y + menu.height).toBeLessThanOrEqual(260);
  });
});
