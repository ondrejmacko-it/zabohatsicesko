import type { Page } from "@playwright/test";
import { UCAST_PORT } from "./constants.mjs";
import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// PR2: přihlášky a omluvy v ukázce se zapnutou účastí (PARTICIPATION=on, vlastní server a databáze).
// Desktop píše jako účastník FP, telefon jako účastník RM, aby se zápisy projektů nepotkaly.

test.describe.configure({ mode: "serial" });

const BASE = `http://localhost:${UCAST_PORT}`;
const PROJECTS = ["windows-1280", "telefon-390"];
const NOTE = "e2e-soukroma-poznamka";

test.beforeEach(({}, info) => test.skip(!PROJECTS.includes(info.project.name), "jen windows-1280 a telefon-390"));

async function plan(page: Page, query = "") {
  await page.goto(`${BASE}/vzdelavani/harmonogram?mesic=2026-11&pohled=seznam${query}`);
  await settle(page);
}

async function openCard(page: Page, state: string) {
  const card = page.locator(`a:has([data-ucast="${state}"])`).filter({ visible: true }).first();
  await expect(card).toBeVisible();
  await page.goto(`${BASE}${await card.getAttribute("href")}`);
  await settle(page);
  return page.locator("[data-ucast-panel]");
}

test.describe("účast v harmonogramu", () => {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- `use` je fixture Playwrightu, ne hook Reactu.
  test.use({ storageState: ({}, use, info) => use(authFile(info.project.name === "windows-1280" ? "ucastnikFp" : "ucastnikRm")) });

  test("přepínač Moje/Všechny, štítky, přihlášení, odhlášení, omluva a její zrušení", async ({ page }, info) => {
    await plan(page);
    await expect(page.getByRole("link", { name: "Moje", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Všechny", exact: true })).toHaveAttribute("aria-current", "page");
    // Měsíc / Seznam zůstává beze změny (na telefonu je Plán vždy seznam a přepínač zobrazení je skrytý).
    if (info.project.name === "windows-1280") await expect(page.getByRole("link", { name: "Měsíc", exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Přihlásit se k nepovinné akci a zase se odhlásit, vždy přes potvrzovací okno.
    let panel = await openCard(page, "optional");
    await expect(panel).toContainText("Můžeš se přihlásit");
    await panel.getByRole("button", { name: "Přihlásit se" }).click();
    await page.getByRole("dialog", { name: "Přihlásit se na akci?" }).getByRole("button", { name: "Přihlásit se" }).click();
    await expect(page.locator('[data-ucast-panel="voluntary_enrolled"]')).toContainText("Přihlášeno");
    await page.locator("[data-ucast-panel]").getByRole("button", { name: "Odhlásit se" }).click();
    await page.getByRole("dialog", { name: "Odhlásit se z akce?" }).getByRole("button", { name: "Odhlásit se" }).click();
    await expect(page.locator('[data-ucast-panel="optional"]')).toBeVisible();

    // Omluva z povinné akce s důvodem a poznámkou, pravdivý stav Kalendáře.
    await plan(page);
    panel = await openCard(page, "required");
    await expect(panel).toContainText("Povinné pro tebe");
    const url = page.url();
    await panel.getByRole("button", { name: "Omluvit se" }).click();
    const dialog = page.getByRole("dialog", { name: "Omluvit se z akce?" });
    await dialog.getByLabel("Dovolená").check();
    await dialog.getByLabel("Poznámka (nepovinná)").fill(`${NOTE}-${info.project.name}`);
    await expectNoHorizontalScroll(page);
    await dialog.getByRole("button", { name: "Omluvit se" }).click();
    const excused = page.locator('[data-ucast-panel="excused"]');
    await expect(excused).toContainText("Omluveno ve Wiki, platí hned.");
    await expect(excused).toContainText(`${NOTE}-${info.project.name}`);

    // Moje: omluvená akce zůstává, nabídky k přihlášení ne.
    await plan(page, "&ucast=moje");
    await expect(page.getByRole("link", { name: "Moje", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator('[data-ucast="optional"]').filter({ visible: true })).toHaveCount(0);
    await expect(page.locator('[data-ucast="excused"]').filter({ visible: true }).first()).toBeVisible();

    // Zrušit omluvu.
    await page.goto(url);
    await settle(page);
    await page.locator("[data-ucast-panel]").getByRole("button", { name: "Zrušit omluvu" }).click();
    await page.getByRole("dialog", { name: "Zrušit omluvu?" }).getByRole("button", { name: "Zrušit omluvu" }).click();
    await expect(page.locator('[data-ucast-panel="required"]')).toBeVisible();
  });

  // F04 v simulaci Kalendáře: povinná akce je pozvánka, omluva ji odmítne, dobrovolná se přidá až po přihlášení.
  test("F04: pozvánka v Kalendáři podle povinnosti, omluvy a přihlášky", async ({ page }) => {
    // Návštěva Úvodu spustí frontu Kalendáře: zveřejněné akce dostanou pozvánku.
    await page.goto(`${BASE}/`);
    await settle(page);

    await plan(page);
    let panel = await openCard(page, "required");
    await expectCalendar(page, "Pozvánku máš v Kalendáři.");
    await panel.getByRole("button", { name: "Omluvit se" }).click();
    await page.getByRole("dialog", { name: "Omluvit se z akce?" }).getByRole("button", { name: "Omluvit se" }).click();
    await expect(page.locator('[data-ucast-panel="excused"]')).toContainText("Omluveno ve Wiki, platí hned.");
    await expectCalendar(page, "Pozvánku v Kalendáři nemáš, omluva ji odmítla.");
    await page.locator("[data-ucast-panel]").getByRole("button", { name: "Zrušit omluvu" }).click();
    await page.getByRole("dialog", { name: "Zrušit omluvu?" }).getByRole("button", { name: "Zrušit omluvu" }).click();
    await expectCalendar(page, "Pozvánku máš v Kalendáři.");

    await plan(page);
    panel = await openCard(page, "optional");
    await expectCalendar(page, "Do Kalendáře se akce přidá, až se přihlásíš.");
    await panel.getByRole("button", { name: "Přihlásit se" }).click();
    await page.getByRole("dialog", { name: "Přihlásit se na akci?" }).getByRole("button", { name: "Přihlásit se" }).click();
    await expectCalendar(page, "Pozvánku máš v Kalendáři.");
    await page.locator("[data-ucast-panel]").getByRole("button", { name: "Odhlásit se" }).click();
    await page.getByRole("dialog", { name: "Odhlásit se z akce?" }).getByRole("button", { name: "Odhlásit se" }).click();
    await expectCalendar(page, "Do Kalendáře se akce přidá, až se přihlásíš.");
  });
});

/** Stav vlastní pozvánky v panelu „Tvoje účast“. Kalendář se upravuje hned po odpovědi, proto se čeká na obnovení. */
async function expectCalendar(page: Page, text: string) {
  await expect
    .poll(
      async () => {
        await page.reload();
        await settle(page);
        return page.locator("[data-ucast-panel] [data-kalendar]").textContent();
      },
      { timeout: 20_000, intervals: [300, 600, 1_000] },
    )
    .toBe(text);
}

test.describe("soukromí omluvy", () => {
  test.use({ storageState: authFile("vedouci") });

  test("poznámka kolegy není v HTML jiného uživatele", async ({ browser }, info) => {
    const own = await browser.newContext({ storageState: authFile(info.project.name === "windows-1280" ? "ucastnikFp" : "ucastnikRm") });
    const page = await own.newPage();
    await plan(page);
    await openCard(page, "required");
    const url = page.url();
    const note = `${NOTE}-cizi-${info.project.name}`;
    await page.locator("[data-ucast-panel]").getByRole("button", { name: "Omluvit se" }).click();
    const dialog = page.getByRole("dialog", { name: "Omluvit se z akce?" });
    await dialog.getByLabel("Poznámka (nepovinná)").fill(note);
    await dialog.getByRole("button", { name: "Omluvit se" }).click();
    await expect(page.locator('[data-ucast-panel="excused"]')).toBeVisible();
    await own.close();

    const other = await browser.newContext({ storageState: authFile("vedouci") });
    const view = await other.newPage();
    for (const target of [url, `${BASE}/vzdelavani/harmonogram?mesic=2026-11`, `${BASE}/vzdelavani/harmonogram?mesic=2026-11&pohled=seznam`]) {
      const html = await (await view.request.get(target)).text();
      expect(html).not.toContain(note);
    }
    await other.close();
  });
});

test.describe("témata v režimu všech zveřejněných (F10, F11)", () => {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- `use` je fixture Playwrightu, ne hook Reactu.
  test.use({ storageState: ({}, use, info) => use(authFile(info.project.name === "windows-1280" ? "ucastnikFp" : "ucastnikRm")) });

  test("Pro mou roli je výchozí, Všechna ukáže i cizí témata, pořadí kolega měnit nemůže", async ({ page }, info) => {
    const fp = info.project.name === "windows-1280";
    const own = fp ? "Otevřené otázky na schůzce" : "Návaznost po konzultaci";
    const foreign = fp ? "Návaznost po konzultaci" : "Otevřené otázky na schůzce";
    await page.goto(`${BASE}/vzdelavani/temata`);
    await settle(page);
    await expect(page.getByRole("link", { name: "Pro mou roli", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("main").getByText(own, { exact: true })).toBeVisible();
    await expect(page.locator("main").getByText("Týmové priority", { exact: true })).toBeVisible();
    await expect(page.locator("main").getByText(foreign, { exact: true })).toHaveCount(0);

    await page.getByRole("link", { name: "Všechna", exact: true }).click();
    await expect(page).toHaveURL(/filtr=vse/);
    await expect(page.locator("main").getByText(foreign, { exact: true })).toBeVisible();
    await expect(page.locator(".topic-handle, .topic-rank")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Možnosti tématu/ })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});

test.describe("víc pracovních rolí (F05)", () => {
  test.use({ storageState: authFile("vedouci") });

  test("F05: vedoucí s rolemi FP i RM má povinné akce obou rolí, nic jen dobrovolného", async ({ page }) => {
    await plan(page);
    await expect(page.locator('[data-ucast="required"]').filter({ visible: true }).first()).toBeVisible();
    expect(await page.locator('[data-ucast="required"]').filter({ visible: true }).count()).toBeGreaterThan(1);
    await expect(page.locator('[data-ucast="optional"]').filter({ visible: true })).toHaveCount(0);
  });
});
