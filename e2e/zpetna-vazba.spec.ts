import type { Page, TestInfo } from "@playwright/test";
import { FEEDBACK_HOOK_PORT } from "./constants.mjs";
import { authFile, expect, settle, test } from "./support";

// Zpětná vazba (brouček). Ukázka posílá na falešný webhook Make.com z e2e/server.mjs, který hlášení vrací
// přes GET /hlaseni. Živý Make.com se v testech nevolá.

const bug = (page: Page) => page.getByTestId("broucek");
const dialog = (page: Page) => page.getByRole("dialog", { name: "Zpětná vazba" });

// Odeslání jen v jednom projektu na jádro prohlížeče: limit 10 hlášení za hodinu platí na účet a projekty sdílí DB.
const SENDING_PROJECTS = ["windows-1280", "webkit-1440", "firefox-1280"];
const skipUnlessSending = (testInfo: TestInfo) => test.skip(!SENDING_PROJECTS.includes(testInfo.project.name), "odeslání jen jednou na prohlížeč");

type Report = { text: string; type: string; marks: unknown[]; screenshot: { mime: string; base64: string } | null; context: Record<string, unknown>; reporter: Record<string, unknown> };

async function reportWith(text: string): Promise<Report | undefined> {
  const response = await fetch(`http://127.0.0.1:${FEEDBACK_HOOK_PORT}/hlaseni`);
  return ((await response.json()) as Report[]).find((report) => report.text === text);
}

async function openAndDescribe(page: Page, type: string, text: string) {
  await bug(page).click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByLabel(new RegExp(`^${type}`)).check();
  await dialog(page).getByRole("button", { name: "Pokračovat" }).click();
  await dialog(page).getByLabel(/^(Co se stalo\?|Popis)$/).fill(text);
}

test.describe("brouček na počítači", () => {
  test.use({ storageState: authFile("ucastnikFp") });
  test.beforeEach(({ isMobile, viewport }) => test.skip(isMobile || (viewport?.width ?? 0) < 900, "brouček jen na počítači"));

  test("vpravo dole, šipky a tažení ho přesunou a poloha vydrží načtení", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    const width = page.viewportSize()!.width;
    const start = (await bug(page).boundingBox())!;
    expect(start.x).toBeGreaterThan(width / 2);
    expect(start.width).toBe(44);

    await bug(page).focus();
    await page.keyboard.press("ArrowLeft");
    await expect.poll(async () => (await bug(page).boundingBox())!.x).toBeLessThan(width / 2);
    // Vlevo stojí vedle levého menu, ne přes něj.
    const sidebar = (await page.locator(".sidebar").boundingBox())!;
    const left = (await bug(page).boundingBox())!;
    const overlaps = left.x < sidebar.x + sidebar.width && left.x + left.width > sidebar.x && left.y < sidebar.y + sidebar.height && left.y + left.height > sidebar.y;
    expect(overlaps).toBe(false);

    const box = (await bug(page).boundingBox())!;
    await page.mouse.move(box.x + 22, box.y + 22);
    await page.mouse.down();
    await page.mouse.move(width - 60, 300, { steps: 6 });
    await page.mouse.up();
    // Tažení okno neotevře.
    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(async () => (await bug(page).boundingBox())!.x).toBeGreaterThan(width / 2);
    const dropped = (await bug(page).boundingBox())!;
    expect(Math.abs(dropped.y + 22 - 300)).toBeLessThan(40);

    await page.reload();
    await settle(page);
    const restored = (await bug(page).boundingBox())!;
    expect(restored.x).toBeGreaterThan(width / 2);
    expect(Math.abs(restored.y - dropped.y)).toBeLessThan(4);
  });

  test("schová se k okraji jako jazýček, skryje se úplně a z menu se vrátí", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await bug(page).hover();
    await page.getByRole("button", { name: "Schovat tlačítko zpětné vazby k okraji" }).click();
    await expect(bug(page)).toHaveCount(0);
    const tab = page.getByTestId("broucek-jazycek");
    await expect(tab).toBeVisible();
    expect((await tab.boundingBox())!.width).toBe(18);
    await tab.click();
    await expect(bug(page)).toBeVisible();

    await bug(page).click();
    await dialog(page).getByRole("button", { name: "Skrýt broučka" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(bug(page)).toHaveCount(0);
    await page.reload();
    await settle(page);
    await expect(bug(page)).toHaveCount(0);

    await page.locator(".sidebar").getByRole("button", { name: "Zpětná vazba" }).click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByRole("button", { name: "Zavřít" }).click();
    await expect(bug(page)).toBeVisible();
  });

  test("při otevřeném okně se schová a rozepsané hlášení se bez dotazu nezahodí", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await openAndDescribe(page, "Chyba", "Rozepsané hlášení");
    await expect(bug(page)).toHaveCount(0);
    await dialog(page).getByRole("button", { name: "Zavřít" }).first().click();
    const confirm = page.getByRole("alertdialog", { name: "Neuložené změny" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Pokračovat v úpravách" }).click();
    await expect(dialog(page).getByLabel("Co se stalo?")).toHaveValue("Rozepsané hlášení");

    await dialog(page).getByRole("button", { name: "Zavřít" }).first().click();
    await confirm.getByRole("button", { name: "Zahodit změny" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(bug(page)).toBeVisible();
    // Zahozené hlášení začne znovu od výběru typu.
    await bug(page).click();
    await expect(dialog(page).getByText("Co chcete nahlásit?")).toBeVisible();
  });

  test("označení místa: prvek, odebrání, Esc vrátí do okna s rozepsaným textem", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await openAndDescribe(page, "Vzhled", "Nadpis je moc malý");
    await dialog(page).getByRole("button", { name: "Označit místo" }).click();
    await expect(dialog(page)).toHaveCount(0);
    const layer = page.getByTestId("vrstva-oznaceni");
    await expect(layer).toBeVisible();

    const heading = (await page.locator("main h1").first().boundingBox())!;
    await page.mouse.click(heading.x + 10, heading.y + heading.height / 2);
    await expect(layer.locator(".mark-done")).toHaveCount(1);
    await expect(layer.locator(".mark-list li").first()).toContainText("nadpis");
    // Tažením obdélník.
    await page.mouse.move(400, 300);
    await page.mouse.down();
    await page.mouse.move(520, 380, { steps: 4 });
    await page.mouse.up();
    await expect(layer.locator(".mark-done")).toHaveCount(2);
    await layer.getByRole("button", { name: "Odebrat označení 1" }).click();
    await expect(layer.locator(".mark-list li").first()).toContainText("vyznačená oblast");

    await page.keyboard.press("Escape");
    await expect(layer).toHaveCount(0);
    await expect(dialog(page).getByLabel("Popis")).toHaveValue("Nadpis je moc malý");
    await expect(dialog(page).getByText("Označeno míst: 1")).toBeVisible();
  });

  test("na Správě se snímek nenabízí", async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile("spravce") });
    const page = await context.newPage();
    await page.goto("/sprava");
    await settle(page);
    await openAndDescribe(page, "Ostatní", "Poznámka ke správě");
    await dialog(page).getByRole("button", { name: "Pokračovat" }).click();
    await expect(dialog(page).getByText("Na této stránce se snímek obrazovky nepořizuje.")).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Pořídit snímek" })).toHaveCount(0);
    await context.close();
  });

  test("odeslání se snímkem a označením dorazí do webhooku bez jména a hodnot polí", async ({ page }, testInfo) => {
    skipUnlessSending(testInfo);
    const text = `Snímek a označení ${testInfo.project.name} ${Date.now()}`;
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await openAndDescribe(page, "Chyba", text);
    await dialog(page).getByLabel("Co by mělo fungovat jinak? (nepovinné)").fill("Má se uložit.");
    await dialog(page).getByRole("button", { name: "Označit místo" }).click();
    const heading = (await page.locator("main h1").first().boundingBox())!;
    await page.mouse.click(heading.x + 10, heading.y + heading.height / 2);
    await page.getByTestId("vrstva-oznaceni").getByRole("button", { name: "Hotovo" }).click();
    await dialog(page).getByRole("button", { name: "Pokračovat" }).click();

    await expect(dialog(page)).toContainText(text);
    await dialog(page).getByRole("button", { name: "Pořídit snímek" }).click();
    await expect(dialog(page).getByRole("img", { name: "Náhled snímku, který se odešle" })).toBeVisible({ timeout: 20_000 });
    await dialog(page).getByRole("button", { name: "Odeslat" }).click();
    await expect(dialog(page).getByText("Děkujeme, hlášení jsme přijali.")).toBeVisible({ timeout: 15_000 });

    const report = (await reportWith(text))!;
    expect(report).toBeTruthy();
    expect(report.type).toBe("bug");
    expect(report.marks).toHaveLength(1);
    expect(report.screenshot?.base64.length).toBeGreaterThan(1000);
    expect(["image/webp", "image/jpeg"]).toContain(report.screenshot?.mime);
    expect(report.context).toMatchObject({ path: "/vzdelavani/harmonogram", wikiMode: "demo" });
    expect(report.reporter.role).toBe("member");
    expect(JSON.stringify(report)).not.toMatch(/demo-ucastnik|Účastník|@example/);

    await dialog(page).getByRole("button", { name: "Hotovo" }).click();
    await expect(bug(page)).toBeVisible();
  });

  test("chyba doručení: text zůstane a opakování projde, úspěch až po potvrzení serveru", async ({ browser }, testInfo) => {
    skipUnlessSending(testInfo);
    const context = await browser.newContext({ storageState: authFile("vedouci") });
    const page = await context.newPage();
    const text = `SIMULOVAT-CHYBU ${testInfo.project.name} ${Date.now()}`;
    await page.goto("/");
    await settle(page);
    await openAndDescribe(page, "Nápad", text);
    await dialog(page).getByRole("button", { name: "Pokračovat" }).click();
    await dialog(page).getByRole("button", { name: "Odeslat" }).click();
    await expect(dialog(page).getByRole("alert")).toContainText("Hlášení se nepodařilo odeslat");
    await expect(dialog(page).getByText("Děkujeme")).toHaveCount(0);
    expect(await reportWith(text)).toBeUndefined();

    await dialog(page).getByRole("button", { name: "Zpět" }).click();
    await expect(dialog(page).getByLabel("Popis")).toHaveValue(text);
    await dialog(page).getByRole("button", { name: "Pokračovat" }).click();
    await dialog(page).getByRole("button", { name: "Odeslat" }).click();
    await expect(dialog(page).getByText("Děkujeme, hlášení jsme přijali.")).toBeVisible({ timeout: 15_000 });
    expect((await reportWith(text))?.screenshot).toBeNull();
    await context.close();
  });
});

test.describe("brouček na telefonu", () => {
  test.use({ storageState: authFile("ucastnikFp") });

  test("na telefonu není brouček ani položka v menu", async ({ page, isMobile }) => {
    test.skip(!isMobile, "jen telefon");
    await page.goto("/");
    await settle(page);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(bug(page)).toHaveCount(0);
    await expect(page.locator(".sidebar").getByRole("button", { name: "Zpětná vazba" })).toBeHidden();
  });
});
