import type { Page, TestInfo } from "@playwright/test";
import { FEEDBACK_HOOK_PORT } from "./constants.mjs";
import { authFile, expect, settle, test } from "./support";

// Zpětná vazba (brouček). Ukázka posílá na falešný webhook Make.com z e2e/server.mjs, který hlášení vrací
// přes GET /hlaseni. Živý Make.com se v testech nevolá.

const bug = (page: Page) => page.getByTestId("broucek");
const dialog = (page: Page) => page.getByRole("dialog", { name: "Zpětná vazba" });

// Odeslání jen v jednom projektu na jádro prohlížeče: limit 10 hlášení za hodinu platí na účet a projekty sdílí DB.
const SENDING_PROJECTS = ["windows-1280", "webkit-1440", "firefox-1280"];
const PHONE_SENDING_PROJECTS = ["telefon-390", "webkit-390", "firefox-390"];
const skipUnlessSending = (testInfo: TestInfo) => test.skip(!SENDING_PROJECTS.includes(testInfo.project.name), "odeslání jen jednou na prohlížeč");

type Report = { text: string; type: string; marks: unknown[]; screenshot: { mime: string; base64: string } | null; context: Record<string, unknown>; reporter: Record<string, unknown> };

async function reportsWith(text: string): Promise<Report[]> {
  const response = await fetch(`http://127.0.0.1:${FEEDBACK_HOOK_PORT}/hlaseni`);
  return ((await response.json()) as Report[]).filter((report) => report.text === text);
}

async function reportWith(text: string): Promise<Report | undefined> {
  return (await reportsWith(text))[0];
}

/** Fiktivní citlivé řetězce. Žádný z nich nesmí do hlášení: ani do popisu, selektoru, ani do kontextu. */
const SECRETS = ["Jan Tajný", "Tajného", "4111 1111", "800101", "heslo-Tajne", "tajne-id", "tajna-trida", "Klient-X"];

/** Vloží na začátek <main> kartu, tabulku, dynamický nadpis, tlačítko s popiskem, pole a vnořený prvek. */
async function insertSensitiveFixture(page: Page) {
  await page.evaluate(() => {
    const section = document.createElement("section");
    section.id = "tajne-id";
    section.className = "tajna-trida";
    section.dataset.client = "Klient-X";
    section.style.cssText = "position:relative;z-index:1;background:#fff;padding:12px";
    section.innerHTML = `
      <h2 title="Jan Tajný" aria-label="Klient Jan Tajný">Klient Jan Tajný</h2>
      <table><tbody><tr>
        <td><a href="/vzdelavani/akce/tajne-id" aria-label="Akce Jan Tajný" data-testid="tajna-karta"><span><b>Karta Jan Tajný</b></span></a></td>
        <td title="RČ 800101/1234" data-testid="tajna-bunka">Karta 4111 1111 1111 1111</td>
      </tr></tbody></table>
      <form><input id="tajne-id-pole" aria-label="Pole Jan Tajný" value="heslo-Tajne-123" data-testid="tajne-pole">
      <button type="button" aria-label="Smazat Jana Tajného" title="Smazat Jana Tajného" data-testid="tajne-tlacitko">Smazat Jana Tajného</button></form>
      <div data-feedback-redact="" data-testid="tajny-blok" style="width:240px;height:80px;background:#00ff00;color:#000">Jan Tajný 4111 1111 1111 1111</div>`;
    document.querySelector("main")!.prepend(section);
    window.scrollTo(0, 0);
  });
}

async function clickCenter(page: Page, testId: string) {
  const box = (await page.getByTestId(testId).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** Barva pixelu v náhledu snímku na místě středu prvku (přepočet z CSS px okna na pixely obrázku). */
async function previewPixelAt(page: Page, testId: string): Promise<[number, number, number]> {
  const box = (await page.getByTestId(testId).boundingBox())!;
  return page.evaluate(async ({ x, y }) => {
    const img = document.querySelector<HTMLImageElement>("img.feedback-shot-preview")!;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const ratio = img.naturalWidth / window.innerWidth;
    const data = ctx.getImageData(Math.round(x * ratio), Math.round(y * ratio), 1, 1).data;
    return [data[0]!, data[1]!, data[2]!] as [number, number, number];
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
}

/** Přetření #4a4642 (74, 70, 66), s tolerancí na ztrátovou kompresi. */
function expectRedacted([r, g, b]: [number, number, number]) {
  expect(Math.abs(r - 74) + Math.abs(g - 70) + Math.abs(b - 66)).toBeLessThan(30);
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
    await expect(layer.locator(".mark-list li").first()).toContainText("Nadpis stránky");
    // Tažením obdélník.
    await page.mouse.move(400, 300);
    await page.mouse.down();
    await page.mouse.move(520, 380, { steps: 4 });
    await page.mouse.up();
    await expect(layer.locator(".mark-done")).toHaveCount(2);
    await layer.getByRole("button", { name: "Odebrat označení 1" }).click();
    await expect(layer.locator(".mark-list li").first()).toContainText("Označená oblast");

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

test.describe("zpětná vazba: citlivý obsah, snímek a odesílání", () => {
  test.use({ storageState: authFile("ucastnikFp") });
  test.beforeEach(({ isMobile, viewport }) => test.skip(isMobile || (viewport?.width ?? 0) < 900, "počítač"));

  test("citlivé texty stránky nejdou do popisu, selektoru ani hlášení a snímek je přetře", async ({ page }, testInfo) => {
    const text = `Citlivá fixture ${testInfo.project.name} ${Date.now()}`;
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await insertSensitiveFixture(page);
    await openAndDescribe(page, "Chyba", text);
    await dialog(page).getByRole("button", { name: "Označit místo" }).click();
    const layer = page.getByTestId("vrstva-oznaceni");
    await expect(layer).toBeVisible();
    for (const testId of ["tajna-karta", "tajna-bunka", "tajne-pole", "tajne-tlacitko"]) await clickCenter(page, testId);
    const heading = (await page.locator("#tajne-id h2").boundingBox())!;
    await page.mouse.click(heading.x + 20, heading.y + heading.height / 2);
    await expect(layer.locator(".mark-done")).toHaveCount(5);
    // Vrstva nic pod sebou nespustila: tlačítko ani odkaz karty.
    await expect(page).toHaveURL(/\/vzdelavani\/harmonogram$/);
    const listed = await layer.locator(".mark-list").innerText();
    for (const secret of SECRETS) expect(listed).not.toContain(secret);
    expect(listed).toContain("Karta v harmonogramu");
    expect(listed).toContain("Tlačítko ve formuláři");
    expect(listed).toContain("Nadpis sekce");
    await layer.getByRole("button", { name: "Hotovo" }).click();
    await dialog(page).getByRole("button", { name: "Pokračovat" }).click();
    const summary = await dialog(page).locator(".feedback-summary").innerText();
    for (const secret of SECRETS) expect(summary).not.toContain(secret);

    const started = Date.now();
    await dialog(page).getByRole("button", { name: "Pořídit snímek" }).click();
    await expect(dialog(page).getByRole("img", { name: "Náhled snímku, který se odešle" })).toBeVisible({ timeout: 20_000 });
    testInfo.annotations.push({ type: "snímek", description: `${Date.now() - started} ms` });
    // Okno zpětné vazby leží přes stránku, pro měření pixelů ho schovat nemusíme: bodBox je v souřadnicích okna.
    expectRedacted(await previewPixelAt(page, "tajny-blok"));
    expectRedacted(await previewPixelAt(page, "tajne-pole"));

    if (!SENDING_PROJECTS.includes(testInfo.project.name)) return;
    await dialog(page).getByRole("button", { name: "Odeslat" }).click();
    await expect(dialog(page).getByText("Děkujeme, hlášení jsme přijali.")).toBeVisible({ timeout: 15_000 });
    const report = (await reportWith(text))!;
    const json = JSON.stringify({ ...report, screenshot: null });
    for (const secret of SECRETS) expect(json).not.toContain(secret);
    expect(report.marks).toHaveLength(5);
  });

  test("dlouhá a posunutá stránka: snímek viditelné části bez selhání, nejvýš 2000 px", async ({ page }, testInfo) => {
    await page.goto("/vzdelavani/temata");
    await settle(page);
    await page.evaluate(() => {
      const tall = document.createElement("div");
      tall.style.height = "30000px";
      tall.style.background = "linear-gradient(#fff, #ccc)";
      document.querySelector("main")!.append(tall);
      window.scrollTo(0, 12_000);
    });
    await openAndDescribe(page, "Ostatní", "Dlouhá stránka");
    await dialog(page).getByRole("button", { name: "Pokračovat" }).click();
    const started = Date.now();
    await dialog(page).getByRole("button", { name: "Pořídit snímek" }).click();
    const preview = dialog(page).getByRole("img", { name: "Náhled snímku, který se odešle" });
    await expect(preview.or(dialog(page).getByText("Snímek se nepodařilo pořídit."))).toBeVisible({ timeout: 25_000 });
    testInfo.annotations.push({ type: "snímek dlouhé stránky", description: `${Date.now() - started} ms` });
    await expect(preview).toBeVisible();
    const size = await preview.evaluate((img: HTMLImageElement) => ({ width: img.naturalWidth, height: img.naturalHeight }));
    const viewport = page.viewportSize()!;
    expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(2000);
    expect(Math.abs(size.width / size.height - viewport.width / viewport.height)).toBeLessThan(0.02);
  });

  test("Úvod: jméno přihlášeného je ve snímku přetřené", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await page.evaluate(() => document.querySelector("main h1 [data-feedback-redact]")?.setAttribute("data-testid", "jmeno"));
    await openAndDescribe(page, "Ostatní", "Úvod");
    await dialog(page).getByRole("button", { name: "Pokračovat" }).click();
    await dialog(page).getByRole("button", { name: "Pořídit snímek" }).click();
    await expect(dialog(page).getByRole("img", { name: "Náhled snímku, který se odešle" })).toBeVisible({ timeout: 20_000 });
    expectRedacted(await previewPixelAt(page, "jmeno"));
  });

  test("podvržené povolení snímku na zakázané stránce server odmítne, text bez snímku projde", async ({ browser }, testInfo) => {
    skipUnlessSending(testInfo);
    const context = await browser.newContext({ storageState: authFile("spravce") });
    const page = await context.newPage();
    const text = `Podvrh ${testInfo.project.name} ${Date.now()}`;
    await page.goto("/sprava");
    await settle(page);
    await page.evaluate(() => {
      const fake = document.createElement("span");
      fake.hidden = true;
      fake.setAttribute("data-feedback-shot-grant", `/vzdelavani/harmonogram|${Math.floor(Date.now() / 1000) + 3600}|podvrh`);
      document.body.append(fake);
    });
    await openAndDescribe(page, "Ostatní", text);
    await dialog(page).getByRole("button", { name: "Pokračovat" }).click();
    await dialog(page).getByRole("button", { name: "Pořídit snímek" }).click();
    await expect(dialog(page).getByRole("img", { name: "Náhled snímku, který se odešle" })).toBeVisible({ timeout: 20_000 });
    await dialog(page).getByRole("button", { name: "Odeslat" }).click();
    await expect(dialog(page).getByRole("alert")).toContainText("Hlášení se nepodařilo zpracovat");
    expect(await reportWith(text)).toBeUndefined();
    await dialog(page).getByRole("button", { name: "Odebrat snímek" }).click();
    await dialog(page).getByRole("button", { name: "Odeslat" }).click();
    await expect(dialog(page).getByText("Děkujeme, hlášení jsme přijali.")).toBeVisible({ timeout: 15_000 });
    expect((await reportWith(text))?.screenshot).toBeNull();
    await context.close();
  });

  test("dvojklik a zavření během pomalého odeslání: jedno hlášení, úspěch až po potvrzení", async ({ page }, testInfo) => {
    skipUnlessSending(testInfo);
    const text = `SIMULOVAT-POMALU ${testInfo.project.name} ${Date.now()}`;
    await page.goto("/");
    await settle(page);
    await openAndDescribe(page, "Nápad", text);
    await dialog(page).getByRole("button", { name: "Pokračovat" }).click();
    await dialog(page).getByRole("button", { name: "Odeslat" }).dblclick();
    await expect(dialog(page).getByText("Děkujeme")).toHaveCount(0);
    // Zavření během odesílání okno jen schová, bez dotazu na neuložené změny.
    await dialog(page).getByRole("button", { name: "Zavřít" }).first().click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(dialog(page)).toHaveCount(0);
    await bug(page).click();
    await expect(dialog(page).getByText("Děkujeme, hlášení jsme přijali.")).toBeVisible({ timeout: 15_000 });
    expect(await reportsWith(text)).toHaveLength(1);
  });

  test("vypršení času po přijetí webhookem: žádný falešný úspěch, text zůstane, opakování neposílá znovu", async ({ browser }, testInfo) => {
    skipUnlessSending(testInfo);
    test.setTimeout(60_000);
    const context = await browser.newContext({ storageState: authFile("vedouci") });
    const page = await context.newPage();
    const text = `SIMULOVAT-TIMEOUT ${testInfo.project.name} ${Date.now()}`;
    await page.goto("/");
    await settle(page);
    await openAndDescribe(page, "Ostatní", text);
    await dialog(page).getByRole("button", { name: "Pokračovat" }).click();
    await dialog(page).getByRole("button", { name: "Odeslat" }).click();
    await expect(dialog(page).getByRole("alert")).toContainText("nejspíš dorazilo", { timeout: 20_000 });
    await expect(dialog(page).getByText("Děkujeme")).toHaveCount(0);
    await expect(dialog(page)).toContainText(text);
    await dialog(page).getByRole("button", { name: "Odeslat" }).click();
    await expect(dialog(page).getByRole("alert")).toContainText("už bylo odesláno");
    expect(await reportsWith(text)).toHaveLength(1);
    await context.close();
  });

  test("Escape zavře jen nejvyšší okno a Skrýt broučka neztratí rozepsaný text", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await openAndDescribe(page, "Chyba", "Rozepsáno před skrytím");
    await page.keyboard.press("Escape");
    const confirm = page.getByRole("alertdialog", { name: "Neuložené změny" });
    await expect(confirm).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(confirm).toHaveCount(0);
    await expect(dialog(page).getByLabel("Co se stalo?")).toHaveValue("Rozepsáno před skrytím");

    // „Skrýt broučka“ je v prvním kroku.
    await dialog(page).getByRole("button", { name: "Zpět" }).click();
    await dialog(page).getByRole("button", { name: "Skrýt broučka" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await page.locator(".sidebar").getByRole("button", { name: "Zpětná vazba" }).click();
    await dialog(page).getByRole("button", { name: "Pokračovat" }).click();
    await expect(dialog(page).getByLabel("Co se stalo?")).toHaveValue("Rozepsáno před skrytím");
  });
});

test.describe("brouček na telefonu", () => {
  test.use({ storageState: authFile("ucastnikFp") });
  test.beforeEach(({ isMobile, viewport }) => test.skip(!isMobile && (viewport?.width ?? 0) >= 900, "jen telefon a úzké okno"));

  test("brouček i položka v menu jsou vidět a nezakrývají hlavní akce", async ({ page }) => {
    for (const path of ["/", "/vzdelavani/harmonogram", "/vzdelavani/temata"]) {
      await page.goto(path);
      await settle(page);
      await expect(bug(page)).toBeVisible();
      const box = (await bug(page).boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      for (const action of await page.locator(".quick-actions a, .quick-actions button").all()) {
        if (!(await action.isVisible())) continue;
        const other = (await action.boundingBox())!;
        const overlaps = box.x < other.x + other.width && other.x < box.x + box.width && box.y < other.y + other.height && other.y < box.y + box.height;
        expect(overlaps, `brouček zakrývá rychlou akci na ${path}`).toBe(false);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await expect(page.locator(".sidebar").getByRole("button", { name: "Zpětná vazba" })).toBeVisible();
  });

  test("telefon: otevře, vyplní, vrací se mezi kroky, bezpečně zavře a odešle", async ({ page }, testInfo) => {
    const text = `Telefon ${testInfo.project.name} ${Date.now()}`;
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await bug(page).tap();
    await expect(dialog(page)).toBeVisible();
    const box = (await dialog(page).boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await dialog(page).getByLabel(/^Chyba/).check();
    await dialog(page).getByRole("button", { name: "Pokračovat" }).tap();
    await dialog(page).getByLabel("Co se stalo?").fill(text);
    await dialog(page).getByRole("button", { name: "Zpět" }).tap();
    await expect(dialog(page).getByLabel(/^Chyba/)).toBeChecked();
    await dialog(page).getByRole("button", { name: "Pokračovat" }).tap();
    await expect(dialog(page).getByLabel("Co se stalo?")).toHaveValue(text);

    // Zavření s rozepsaným textem se zeptá a „Pokračovat v úpravách“ nic neztratí.
    await dialog(page).getByRole("button", { name: "Zavřít" }).first().tap();
    const confirm = page.getByRole("alertdialog", { name: "Neuložené změny" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Pokračovat v úpravách" }).tap();
    await expect(dialog(page).getByLabel("Co se stalo?")).toHaveValue(text);

    // Zavřít a znovu otevřít z menu: koncept zůstane po „Pokračovat v úpravách“ i po skrytí broučka.
    await dialog(page).getByRole("button", { name: "Zpět" }).tap();
    await dialog(page).getByRole("button", { name: "Skrýt broučka" }).tap();
    await expect(dialog(page)).toHaveCount(0);
    await page.locator(".sidebar").getByRole("button", { name: "Zpětná vazba" }).tap();
    await dialog(page).getByRole("button", { name: "Pokračovat" }).tap();
    await expect(dialog(page).getByLabel("Co se stalo?")).toHaveValue(text);

    await dialog(page).getByRole("button", { name: "Pokračovat" }).tap();
    await expect(dialog(page)).toContainText(text);
    if (!PHONE_SENDING_PROJECTS.includes(testInfo.project.name)) return;
    await dialog(page).getByRole("button", { name: "Odeslat" }).tap();
    await expect(dialog(page).getByText("Děkujeme, hlášení jsme přijali.")).toBeVisible({ timeout: 15_000 });
    expect((await reportWith(text))?.context).toMatchObject({ path: "/vzdelavani/harmonogram" });
  });
});
