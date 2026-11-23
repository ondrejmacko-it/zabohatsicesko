import type { Page } from "@playwright/test";
import { UCAST_PORT } from "./constants.mjs";
import { authFile, expect, expectNoHorizontalScroll, expectNoSeriousA11y, settle, test } from "./support";

// PR2: přihlášky a omluvy v ukázce se zapnutou účastí (PARTICIPATION=on, vlastní server a databáze).
// Desktop píše jako účastník FP, telefon jako účastník RM, aby se zápisy projektů nepotkaly.

test.describe.configure({ mode: "serial" });

const BASE = `http://localhost:${UCAST_PORT}`;
const PROJECTS = ["windows-1280", "telefon-390"];
const NOTE = "e2e-soukroma-poznamka";
/** Ukázková akce se spárovanou existující pozvánkou (seed `calendarFixture`). */
const PAIRED_INVITE = "tr-rm-1112";

test.beforeEach(({}, info) => test.skip(!PROJECTS.includes(info.project.name), "jen windows-1280 a telefon-390"));

async function plan(page: Page, query = "") {
  await page.goto(`${BASE}/vzdelavani/harmonogram?mesic=2026-11&pohled=seznam${query}`);
  await settle(page);
}

/**
 * `except`: ID akce, jejíž kartu přeskočit. Bere poslední kartu měsíce: od sdílení všech zveřejněných akcí
 * (PR #86) jsou první karty listopadu už proběhlé a účast u nich nejde měnit.
 */
async function openCard(page: Page, state: string, except?: string) {
  const skip = except ? `:not([href*="${except}"])` : "";
  const card = page.locator(`a:has([data-ucast="${state}"])${skip}`).filter({ visible: true }).last();
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
    // Odhlášeno (0017) je jiný stav než „nikdy nepřihlášeno“ a jde se znovu přihlásit.
    const withdrawn = page.locator('[data-ucast-panel="withdrawn"]');
    await expect(withdrawn).toContainText("Odhlášeno");
    await expect(withdrawn.getByRole("button", { name: "Přihlásit se" })).toBeVisible();

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
  // Akce, jejíž pozvánku založila Wiki. Ukázková tr-rm-1112 je spárovaná existující pozvánka: její hosté jsou
  // ruční (ne spravovaní Wiki), panel o nich proto nic netvrdí (`data-kalendar-stav="neznamy"`).
  test("F04: pozvánka v Kalendáři podle povinnosti, omluvy a přihlášky", async ({ page }) => {
    // Návštěva Úvodu spustí frontu Kalendáře: zveřejněné akce dostanou pozvánku.
    await page.goto(`${BASE}/`);
    await settle(page);

    await plan(page);
    let panel = await openCard(page, "required", PAIRED_INVITE);
    await expectCalendar(page, "Pozvánku máš v Kalendáři.");
    await panel.getByRole("button", { name: "Omluvit se" }).click();
    await page.getByRole("dialog", { name: "Omluvit se z akce?" }).getByRole("button", { name: "Omluvit se" }).click();
    await expect(page.locator('[data-ucast-panel="excused"]')).toContainText("Omluveno ve Wiki, platí hned.");
    await expectCalendar(page, "Wiki tě na tuto akci do Kalendáře nezve.");
    await page.locator("[data-ucast-panel]").getByRole("button", { name: "Zrušit omluvu" }).click();
    await page.getByRole("dialog", { name: "Zrušit omluvu?" }).getByRole("button", { name: "Zrušit omluvu" }).click();
    await expectCalendar(page, "Pozvánku máš v Kalendáři.");

    await plan(page);
    panel = await openCard(page, "optional", PAIRED_INVITE);
    await expectCalendar(page, "Do Kalendáře se akce přidá, až se přihlásíš.");
    await panel.getByRole("button", { name: "Přihlásit se" }).click();
    await page.getByRole("dialog", { name: "Přihlásit se na akci?" }).getByRole("button", { name: "Přihlásit se" }).click();
    await expectCalendar(page, "Pozvánku máš v Kalendáři.");
    await page.locator("[data-ucast-panel]").getByRole("button", { name: "Odhlásit se" }).click();
    await page.getByRole("dialog", { name: "Odhlásit se z akce?" }).getByRole("button", { name: "Odhlásit se" }).click();
    // Odhlášeno (0017) má vlastní větu, odlišnou od „nikdy nepřihlášeno“ (viz `calendarNote`).
    await expect(page.locator('[data-ucast-panel="withdrawn"]')).toBeVisible();
    await expectCalendar(page, "Wiki tě na tuto akci do Kalendáře nezve.");
  });
});

/** Stav vlastní pozvánky v panelu „Tvoje účast“. Kalendář se upravuje hned po odpovědi, proto se čeká na obnovení. */
async function expectCalendar(page: Page, text: string) {
  await expect
    .poll(
      async () => {
        await page.reload();
        await settle(page);
        // Stav vazby (data-kalendar-stav) je v hlášce chyby, aby šlo poznat, proč věta chybí.
        const stav = await page.locator("[data-ucast-panel]").getAttribute("data-kalendar-stav");
        const note = await page.locator("[data-ucast-panel] [data-kalendar]").textContent({ timeout: 500 }).catch(() => `(bez věty, stav ${stav})`);
        return note;
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

test.describe("náhled kolegy s omluvou (audit 23. 11.)", () => {
  test.use({ storageState: authFile("spravce") });

  test("správce vidí stav kolegy, ale ne jeho důvod, ne „Tvoje účast“ a žádné akce", async ({ browser, page, context }, info) => {
    const persona = info.project.name === "windows-1280" ? { auth: "ucastnikFp", id: "demo-ucastnik" } : { auth: "ucastnikRm", id: "demo-mimo-skupinu" };
    const own = await browser.newContext({ storageState: authFile(persona.auth as "ucastnikFp" | "ucastnikRm") });
    const colleague = await own.newPage();
    await plan(colleague);
    await openCard(colleague, "required");
    const url = colleague.url();
    const note = `${NOTE}-nahled-${info.project.name}`;
    await colleague.locator("[data-ucast-panel]").getByRole("button", { name: "Omluvit se" }).click();
    const dialog = colleague.getByRole("dialog", { name: "Omluvit se z akce?" });
    await dialog.getByLabel("Poznámka (nepovinná)").fill(note);
    await dialog.getByRole("button", { name: "Omluvit se" }).click();
    await expect(colleague.locator('[data-ucast-panel="excused"]')).toBeVisible();
    await own.close();

    await context.addCookies([{ name: "zbc_nahled", value: `demo-spravce|kolega-${persona.id}`, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
    await page.goto(url);
    await settle(page);
    const panel = page.locator('[data-ucast-panel="excused"]');
    await expect(panel.getByRole("heading", { name: "Účast v náhledu" })).toBeVisible();
    await expect(panel).toContainText("Omluveno");
    await expect(panel).not.toContainText("Důvod vidíš jen ty");
    await expect(panel).not.toContainText(note);
    await expect(panel.getByRole("button")).toHaveCount(0);
    expect(await page.content()).not.toContain(note);
    await page.screenshot({ path: info.outputPath("nahled-kolegy-omluva.png") });
  });
});

test.describe("stavy účasti: kontrast a čitelnost (audit 23. 11.)", () => {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- `use` je fixture Playwrightu, ne hook Reactu.
  test.use({ storageState: ({}, use, info) => use(authFile(info.project.name === "windows-1280" ? "ucastnikFp" : "ucastnikRm")) });

  test("měsíc, seznam a Úvod se štítky účasti projdou axe", async ({ page }, info) => {
    for (const [name, path] of [["mesic", "/vzdelavani/harmonogram?mesic=2026-11"], ["seznam", "/vzdelavani/harmonogram?mesic=2026-11&pohled=seznam"], ["uvod", "/"]]) {
      await page.goto(`${BASE}${path}`);
      await settle(page);
      await expectNoSeriousA11y(page);
      await page.screenshot({ path: info.outputPath(`ucast-${name}.png`), fullPage: true });
    }
    // Štítky nesou stav i textem, ne jen barvou.
    await page.goto(`${BASE}/vzdelavani/harmonogram?mesic=2026-11&pohled=seznam`);
    await settle(page);
    for (const badge of await page.locator("[data-ucast]:not(a)").filter({ visible: true }).all()) expect((await badge.textContent())?.trim()).toBeTruthy();
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
