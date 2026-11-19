import type { CDPSession, Locator, Page } from "@playwright/test";
import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Ukázka běží s referenčním časem 12. 11. 2026 9:00, měsíční Plán ukazuje listopad. Telefonní testy posílají
// skutečné dotykové události Chromia (CDP `Input.dispatchTouchEvent`), stejně jako prst na telefonu.

const addDialog = (page: Page) => page.getByRole("dialog", { name: "Přidat akci" });
const agendaDay = (page: Page, day: string) => page.locator(`[data-agenda-day="${day}"]`).filter({ visible: true });
const handles = (page: Page) => page.locator("[data-move-handle]").filter({ visible: true });
const quick = (page: Page) => page.getByRole("group", { name: "Rychlé ovládání Plánu" });

async function openPlan(page: Page, query = "") {
  await page.goto(`/vzdelavani/harmonogram${query}`);
  await settle(page);
}

/** Okno Přidat akci je otevřené s daným datem. Esc ho zavře a adresa ztratí `den`. Nic se neuloží. */
async function expectAddDialog(page: Page, day: string) {
  const dialog = addDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Datum", { exact: true })).toHaveValue(day);
  await expectNoHorizontalScroll(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/den=/);
}

/** Posun stránky tak, aby lišta i řádek filtrů odjely nahoru a ukázalo se rychlé ovládání. */
async function scrollPastToolbar(page: Page) {
  await page.evaluate(() => {
    const row = document.querySelector(".plan-filters") ?? document.querySelector(".plan-head");
    window.scrollTo(0, window.scrollY + row!.getBoundingClientRect().bottom + 40);
  });
  await expect(quick(page)).toBeVisible();
}

async function openGoToDate(page: Page) {
  await scrollPastToolbar(page);
  await quick(page).getByRole("button", { name: "Další možnosti Plánu" }).click();
  await page.getByRole("button", { name: "Přejít na datum" }).click();
  const dialog = page.getByRole("dialog", { name: "Přejít na datum" });
  await expect(dialog).toBeVisible();
  return dialog;
}

type Point = { x: number; y: number };

/** Prst přes CDP: dotyk, pohyb po krocích a puštění. */
class Finger {
  private constructor(
    private readonly cdp: CDPSession,
    private readonly page: Page,
  ) {}
  static async on(page: Page) {
    return new Finger(await page.context().newCDPSession(page), page);
  }
  down(p: Point) {
    return this.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
  }
  async move(from: Point, to: Point, steps = 10) {
    for (let i = 1; i <= steps; i++) {
      const x = from.x + ((to.x - from.x) * i) / steps;
      const y = from.y + ((to.y - from.y) * i) / steps;
      await this.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
      await this.page.waitForTimeout(16);
    }
  }
  up() {
    return this.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
}

async function center(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("prvek není vidět");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Podržení úchytu (déle než 350 ms), karta se zvedne a dole se ukáže dočasný přehled dnů. */
async function lift(page: Page, finger: Finger, handle: Locator) {
  const start = await center(handle);
  await finger.down(start);
  await page.waitForTimeout(500);
  await expect(page.locator(".move-panel")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-moving", "");
  return start;
}

test.describe("Plán: přidání akce na telefonu i počítači", () => {
  test.use({ storageState: authFile("spravce") });

  test("Přidat akci v liště otevře okno v Měsíci i v Seznamu", async ({ page }) => {
    for (const query of ["", "?pohled=seznam"]) {
      await openPlan(page, query);
      const add = page.getByRole("button", { name: "Přidat akci", exact: true });
      await expect(add).toBeVisible();
      await add.click();
      await expectAddDialog(page, "2026-11-12");
    }
  });

  test("telefon: „+“ u dne, rychlé „+“ a Přejít na datum otevřou Přidat akci", async ({ page, isMobile }) => {
    test.skip(!isMobile, "telefonní cesty");
    for (const query of ["", "?pohled=seznam"]) {
      await openPlan(page, query);
      // „+“ u dne v agendě: dny od dneška, minulé dny ho nemají.
      await expect(page.getByRole("link", { name: /^Přidat akci na .* 11\. 11\.$/ })).toHaveCount(0);
      await agendaDay(page, "2026-11-18").getByRole("link", { name: "Přidat akci na středa 18. 11." }).click();
      await expectAddDialog(page, "2026-11-18");

      await scrollPastToolbar(page);
      await quick(page).getByRole("link", { name: "Přidat akci" }).click();
      await expectAddDialog(page, "2026-11-12");

      const dialog = await openGoToDate(page);
      await dialog.getByRole("button", { name: "sobota 28. 11." }).click();
      await expect(dialog.getByRole("status")).toContainText("v seznamu tu není žádná akce");
      await dialog.getByRole("link", { name: "Přidat akci na tento den" }).click();
      await expectAddDialog(page, "2026-11-28");
    }
  });

  test("telefon: nová akce přes „+“ u dne se uloží jako návrh", async ({ page }, testInfo) => {
    // Zápis do sdílených dat ukázky jen v jednom projektu.
    test.skip(testInfo.project.name !== "telefon-390", "zápis jen jednou");
    const label = `Přidání z telefonu e2e ${Date.now()}`;
    await openPlan(page);
    await agendaDay(page, "2026-11-19").getByRole("link", { name: /^Přidat akci na / }).click();
    const dialog = addDialog(page);
    await dialog.getByLabel("Název akce", { exact: true }).fill(label);
    await dialog.getByRole("button", { name: "Uložit jako návrh" }).click();
    await expect(dialog).toBeHidden();
    await expect(agendaDay(page, "2026-11-19").getByText(label)).toBeVisible();
  });
});

test.describe("Plán na telefonu: přesun úchytem", () => {
  test.use({ storageState: authFile("spravce") });
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, "dotykové ovládání telefonu"));

  test("podržení a tažení na den v agendě otevře potvrzení, Nepřesouvat nic nezmění", async ({ page }) => {
    await openPlan(page);
    const from = agendaDay(page, "2026-11-18");
    await page.evaluate(() => document.querySelector('[data-agenda-day="2026-11-18"]')!.scrollIntoView({ block: "start" }));
    const handle = from.locator("[data-move-handle]").first();
    const label = await handle.getAttribute("data-handle-label");
    const finger = await Finger.on(page);
    const start = await lift(page, finger, handle);
    const target = agendaDay(page, "2026-11-19");
    const box = (await target.boundingBox())!;
    const point = { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 40) };
    await finger.move(start, point);
    await expect(target).toHaveAttribute("data-drop-over", "");
    // C-06: během tažení jediná kopie karty, nepřekáží cíli (pointer-events) ani čtečce, originál zůstává na místě.
    const ghost = page.locator(".move-ghost");
    await expect(ghost).toHaveCount(1);
    await expect(ghost).toContainText(label!);
    await expect(ghost).toHaveCSS("pointer-events", "none");
    await expect(ghost).toHaveAttribute("aria-hidden", "true");
    await finger.up();

    const confirm = page.getByRole("dialog", { name: "Přesunout akci" });
    await expect(confirm).toContainText(`Přesunout akci ${label} z st 18. 11. na čt 19. 11.?`);
    await expect(ghost).toHaveCount(0);
    await expect(page.locator("[data-lifted]")).toHaveCount(0);
    await expect(page.locator(".move-panel")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveAttribute("data-moving", "");
    await confirm.getByRole("button", { name: "Nepřesouvat" }).click();
    await expect(confirm).toBeHidden();
    await expect(from.getByText(label!)).toBeVisible();
    await expect(page.locator(`[data-move-handle][data-handle-label="${label}"]`)).toHaveCount(1);
    await expect(page).not.toHaveURL(/akce=/);
  });

  test("tažení na den v dočasném přehledu dole otevře potvrzení i pro den bez akcí", async ({ page }) => {
    await openPlan(page);
    const handle = agendaDay(page, "2026-11-18").locator("[data-move-handle]").first();
    await handle.scrollIntoViewIfNeeded();
    const finger = await Finger.on(page);
    const start = await lift(page, finger, handle);
    const day = page.locator('.move-panel [data-drop-day="2026-11-27"]');
    await finger.move(start, await center(day));
    await expect(day).toHaveAttribute("data-drop-over", "");
    await finger.up();
    const confirm = page.getByRole("dialog", { name: "Přesunout akci" });
    await expect(confirm).toContainText("na pá 27. 11.?");
    await page.keyboard.press("Escape");
    await expect(confirm).toBeHidden();
  });

  test("swipe přes úchyt, puštění mimo cíl a klik na kartu nic nepřesunou", async ({ page }) => {
    await openPlan(page);
    const handle = agendaDay(page, "2026-11-18").locator("[data-move-handle]").first();
    await handle.scrollIntoViewIfNeeded();
    const finger = await Finger.on(page);

    // Swipe: pohyb dřív než za 350 ms je posun stránky, karta se nezvedne.
    const start = await center(handle);
    await finger.down(start);
    await finger.move(start, { x: start.x, y: start.y - 120 }, 6);
    await finger.up();
    await page.waitForTimeout(500);
    await expect(page.locator(".move-panel")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Puštění mimo den: na nápovědu dočasného přehledu (není to den). Nic se neotevře.
    await handle.scrollIntoViewIfNeeded();
    const again = await lift(page, finger, handle);
    await finger.move(again, await center(page.locator(".move-panel-text")));
    await finger.up();
    await page.waitForTimeout(700);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".move-panel")).toHaveCount(0);
    await expect(page.locator("[data-lifted]")).toHaveCount(0);
    await expect(page.locator(".move-ghost")).toHaveCount(0);

    // Ťuknutí na kartu otevře detail akce, ne přesun.
    const card = agendaDay(page, "2026-11-18").getByRole("link").filter({ hasText: (await handle.getAttribute("data-handle-label"))! });
    await card.tap();
    await expect(page).toHaveURL(/akce=/);
    await expect(page.getByRole("dialog", { name: "Přesunout akci" })).toHaveCount(0);
  });

  test("ťuknutí na úchyt nabídne výběr dne, Vybrat návrhy úchyty i „+“ skryje", async ({ page }) => {
    await openPlan(page);
    const handle = agendaDay(page, "2026-11-18").locator("[data-move-handle]").first();
    await handle.tap();
    const picker = page.getByRole("dialog", { name: "Přesunout akci" });
    await expect(picker.getByRole("group", { name: "Nový den akce" })).toBeVisible();
    await expect(picker.getByRole("button", { name: "středa 18. 11." })).toBeDisabled();
    await picker.getByRole("button", { name: "pátek 20. 11." }).click();
    await expect(picker).toContainText("na pá 20. 11.?");
    await picker.getByRole("button", { name: "Nepřesouvat" }).click();

    expect(await handles(page).count()).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Vybrat návrhy" }).click();
    await expect(handles(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Přidat akci na / }).filter({ visible: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Ukončit výběr" }).click();
    expect(await handles(page).count()).toBeGreaterThan(0);
  });

  test("potvrzený přesun tažením se zapíše", async ({ page }, testInfo) => {
    // Zápis do sdílených dat ukázky jen v jednom projektu. Návrh si test založí sám ve vzdáleném měsíci.
    test.skip(testInfo.project.name !== "telefon-390", "zápis jen jednou");
    const label = `Přesun z telefonu e2e ${Date.now()}`;
    await openPlan(page);
    await page.getByRole("button", { name: "Přidat akci", exact: true }).click();
    const add = addDialog(page);
    await add.getByLabel("Název akce", { exact: true }).fill(label);
    await add.getByLabel("Datum", { exact: true }).fill("2027-10-05");
    await add.getByRole("button", { name: "Uložit jako návrh" }).click();
    await page.waitForURL(/mesic=2027-10/);
    await settle(page);

    const handle = agendaDay(page, "2027-10-05").locator(`[data-move-handle][data-handle-label="${label}"]`);
    await handle.scrollIntoViewIfNeeded();
    const finger = await Finger.on(page);
    const start = await lift(page, finger, handle);
    await finger.move(start, await center(page.locator('.move-panel [data-drop-day="2027-10-21"]')));
    await finger.up();
    const confirm = page.getByRole("dialog", { name: "Přesunout akci" });
    await expect(confirm).toContainText("na čt 21. 10.?");
    await expect(confirm).toContainText("Přesun se uloží jako návrh.");
    await confirm.getByRole("button", { name: "Potvrdit" }).click();
    await expect(confirm).toBeHidden();
    await expect(agendaDay(page, "2027-10-21").getByText(label)).toBeVisible();
    await expect(agendaDay(page, "2027-10-05")).toHaveCount(0);
  });
});

test.describe("Plán na telefonu: rychlé ovládání, Přejít na datum, filtry", () => {
  test.use({ storageState: authFile("spravce") });
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, "telefon"));

  test("rychlé ovládání je skryté nahoře a ukáže se po posunu, Skrýt ho schová", async ({ page }) => {
    await openPlan(page);
    await expect(quick(page)).toHaveCount(0);
    await scrollPastToolbar(page);
    await expectNoHorizontalScroll(page);
    await quick(page).getByRole("button", { name: "Další možnosti Plánu" }).click();
    await page.getByRole("button", { name: "Skrýt rychlé ovládání" }).click();
    await expect(quick(page)).toHaveCount(0);
    // Návrat k liště rychlé ovládání znovu povolí (po dalším posunu dolů se ukáže).
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator(".plan-filters")).toBeInViewport();
    await page.waitForTimeout(200);
    await expect(quick(page)).toHaveCount(0);
    await scrollPastToolbar(page);
  });

  test("Přejít na datum: den s akcí posune stránku a předá mu fokus, den bez akce nabídne nejbližší", async ({ page }) => {
    await openPlan(page);
    let dialog = await openGoToDate(page);
    await expect(dialog.getByRole("button", { name: "čtvrtek 19. 11., má akce" })).toBeVisible();
    await dialog.getByRole("button", { name: "čtvrtek 19. 11., má akce" }).click();
    await expect(dialog).toBeHidden();
    const day = agendaDay(page, "2026-11-19");
    await expect(day).toBeFocused();
    await expect(day).toBeInViewport();

    dialog = await openGoToDate(page);
    await dialog.getByRole("button", { name: "pondělí 16. 11." }).click();
    await expect(dialog.getByRole("status")).toContainText("pondělí 16. 11.: v seznamu tu není žádná akce");
    await dialog.getByRole("button", { name: /^Nejbližší den s akcí: / }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("[data-agenda-day]:focus")).toHaveCount(1);
  });

  test("filtry tvoří mřížku 2 × 2 bez díry a stránka nejde posunout do strany", async ({ page }) => {
    await openPlan(page);
    await expectNoHorizontalScroll(page);
    const rows = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>(".plan-filters")!;
      const width = grid.getBoundingClientRect().width;
      const items = [...grid.querySelectorAll<HTMLElement>(".plan-filters-start > *, .plan-filters-end > *")].filter((el) => el.getBoundingClientRect().width > 0);
      // Řádek mřížky podle horního okraje (s tolerancí), součet šířek prvků v něm.
      const rows: { top: number; filled: number }[] = [];
      for (const el of items) {
        const r = el.getBoundingClientRect();
        const row = rows.find((x) => Math.abs(x.top - r.top) < 6);
        if (row) row.filled += r.width;
        else rows.push({ top: r.top, filled: r.width });
      }
      return { width, rows: rows.map((x) => x.filled), heights: items.map((el) => Math.round(el.getBoundingClientRect().height)) };
    });
    expect(rows.rows.length).toBeGreaterThan(0);
    // Každý řádek mřížky je plný: dva prvky, nebo jeden přes celou šířku (plus mezera 8 px).
    for (const filled of rows.rows) expect(filled).toBeGreaterThanOrEqual(rows.width - 10);
    for (const height of rows.heights) expect(height).toBe(rows.heights[0]);
  });
});
