import type { CDPSession, Locator, Page } from "@playwright/test";
import { authFile, chooseOption, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Ukázka běží s referenčním časem 12. 11. 2026 9:00. Garantovaná témata ze seedu: 1. Otevřené otázky na schůzce,
// 2. Návaznost po konzultaci. Zápisy do garantovaných témat a pořadí (@zapis-temat) běží jen v projektu zapis-temat
// až po všech ostatních projektech (playwright.config.ts). Čtecí testy proto vidí vždy seed.

const TOPICS = "/vzdelavani/temata";
const menuOf = (page: Page, name: string) => page.getByRole("button", { name: `Možnosti tématu ${name}`, exact: true });
const openMenu = (page: Page) => page.locator(".menu-list:not([hidden])");
const rowOf = (scope: Locator, name: string) => scope.locator(".topic-row").filter({ hasText: name });

async function openTopics(page: Page) {
  await page.goto(TOPICS);
  await settle(page);
}

async function chooseInMenu(page: Page, topic: string, item: string) {
  await menuOf(page, topic).click();
  await openMenu(page).getByRole("button", { name: item, exact: true }).click();
}

// ——— Přetažení témat ———
const SEED_GUARANTEED = ["Otevřené otázky na schůzce", "Návaznost po konzultaci"];
const guaranteedOf = (page: Page) => page.locator(".topic-group-guaranteed");
const othersOf = (page: Page) => page.locator(".topic-group").filter({ has: page.getByRole("heading", { name: "Ostatní témata" }) });
const names = (scope: Locator) => scope.locator(".item-title > span[id]").allTextContents();
const handleOf = (page: Page, name: string) => page.getByRole("button", { name: `Změnit pořadí: ${name}`, exact: true });
const moved = (list: string[], from: number, to: number) => {
  const next = list.filter((_, i) => i !== from);
  next.splice(to, 0, list[from]!);
  return next;
};

async function pressHandle(page: Page, name: string) {
  const box = (await handleOf(page, name).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
}

/** Jedno tažení myší na cílové místo `to` ve skupině (počítáno bez taženého tématu), puštění až nad cílem. */
async function dragTo(page: Page, name: string, section: "guaranteed" | "other", to: number, waitForSave = true) {
  const scope = section === "guaranteed" ? guaranteedOf(page) : othersOf(page);
  const rest = scope.locator(".topic-row").filter({ hasNot: page.getByText(name, { exact: true }) });
  await handleOf(page, name).scrollIntoViewIfNeeded();
  const count = await rest.count();
  const over = rest.nth(Math.min(to, count - 1));
  // Úchyt i cíl musí být v okně už před stiskem, mimo pás autoscrollu (ten testuje zvlášť): střed mezi nimi do středu okna.
  const handleBox = (await handleOf(page, name).boundingBox())!;
  const overBox = (await over.boundingBox())!;
  await page.evaluate((mid) => window.scrollBy(0, mid - window.innerHeight / 2), (handleBox.y + overBox.y + overBox.height) / 2);
  await pressHandle(page, name);
  const box = (await over.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + box.height * (to < count ? 0.25 : 0.8), { steps: 10 });
  await page.mouse.up();
  if (waitForSave) await expect(page.locator(".topic-board[aria-busy=true]")).toHaveCount(0);
}

/** Pořadí se ukázalo hned a po obnovení stránky platí i ze serveru. */
async function expectSaved(page: Page, expected: { guaranteed?: string[]; others?: string[] }) {
  const check = async () => {
    if (expected.guaranteed) await expect.poll(() => names(guaranteedOf(page))).toEqual(expected.guaranteed);
    if (expected.others) await expect.poll(() => names(othersOf(page))).toEqual(expected.others);
  };
  await check();
  await page.waitForLoadState("networkidle");
  await page.reload();
  await settle(page);
  await check();
}

test.describe("Témata: garantovaná a ostatní", () => {
  test.use({ storageState: authFile("spravce") });

  test("garantovaná jsou nahoře v pořadí, Nejžádanější zůstává podle zájmu, menu má všechny volby", async ({ page }) => {
    await openTopics(page);
    const guaranteed = page.locator(".topic-group").filter({ has: page.getByRole("heading", { name: "Garantovaná témata" }) });
    await expect(guaranteed.locator(".topic-row .item-title > span[id]")).toHaveText(["Otevřené otázky na schůzce", "Návaznost po konzultaci"]);
    await expect(page.getByRole("heading", { name: "Ostatní témata" })).toBeVisible();
    await expect(rowOf(guaranteed, "Otevřené otázky na schůzce").getByText("Nejžádanější")).toBeVisible();
    // Rozhodnutí vlastníka (audit P1): Nejžádanější (zájem kolegů) a garance (priorita správce) jsou oddělené.
    await expect(page.getByTestId("nejzadanejsi-vysvetleni")).toContainText("S garancí nesouvisí");
    // Bez počítadla „ze 3“. Garantované téma ze seedu nemá budoucí termín ani návrh (zápisy běží až po čtení).
    await expect(guaranteed.getByText(/ze 3/)).toHaveCount(0);
    const first = rowOf(guaranteed, "Otevřené otázky na schůzce");
    await expect(first.locator(".topic-unscheduled")).toHaveText(" · bez termínu");
    await expect(first.locator(".topic-in-draft")).toHaveCount(0);

    await menuOf(page, "Otevřené otázky na schůzce").click();
    await expect(openMenu(page).locator("a, button")).toHaveText(["Naplánovat téma", "Upravit téma", "Zrušit prioritu", "Posunout níž", "Archivovat…"]);
    await expectNoHorizontalScroll(page);
    await page.keyboard.press("Escape");
    // Garantovaná jsou dvě, třetí jde přidat.
    await menuOf(page, "Týmové priority").click();
    await expect(openMenu(page).getByRole("button", { name: "Nastavit prioritu" })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("F10–F12: vysvětlení garantovaných, filtr Pro mou roli / Všechna, úchyty jen nad celým seznamem, bez „zatím neproběhlo“", async ({ page }) => {
    await openTopics(page);
    await expect(guaranteedOf(page).getByText("Správce je plánuje přednostně.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Všechna", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".topic-handle").first()).toBeVisible();
    await expect(page.locator(".topic-guaranteed .topic-rank")).toHaveText(["1", "2"]);
    await expect(page.getByText("zatím neproběhlo")).toHaveCount(0);
    await expect(page.getByText("Navrhni téma nebo podpoř návrh kolegů.")).toBeVisible();

    // Ve filtru pořadí měnit nejde: posun o jedno místo by přeskočil skrytá témata.
    await page.getByRole("link", { name: "Pro mou roli", exact: true }).click();
    await expect(page).toHaveURL(/filtr=role/);
    await expect(page.getByRole("link", { name: "Pro mou roli", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".topic-handle")).toHaveCount(0);
    await expect(page.locator(".topic-rank")).toHaveCount(0);
    await expect(page.getByText("Ve filtru Pro mou roli nejde měnit pořadí.", { exact: false })).toBeVisible();
    await menuOf(page, "Otevřené otázky na schůzce").click();
    await expect(openMenu(page).locator("a, button")).toHaveText(["Naplánovat téma", "Upravit téma", "Zrušit prioritu", "Archivovat…"]);
    await page.keyboard.press("Escape");
    await expectNoHorizontalScroll(page);
  });

  test("Navrhnout téma má jedno Zavřít, které hlídá rozepsaný návrh; Zrušit úpravy u úprav (C-03)", async ({ page }) => {
    await openTopics(page);
    const propose = page.getByRole("dialog", { name: "Navrhnout téma" });
    const closeButton = propose.getByRole("button", { name: "Zavřít", exact: true });
    await page.getByRole("button", { name: "Navrhnout téma" }).click();
    await expect(closeButton).toHaveCount(1);
    await closeButton.click();
    await expect(propose).toBeHidden();

    await page.getByRole("button", { name: "Navrhnout téma" }).click();
    await propose.getByLabel("Téma").fill("Rozepsané téma");
    await closeButton.click();
    const unsaved = page.getByRole("alertdialog", { name: "Neuložené změny" });
    await expect(unsaved).toBeVisible();
    await unsaved.getByRole("button", { name: "Pokračovat v úpravách" }).click();
    await expect(propose.getByLabel("Téma")).toHaveValue("Rozepsané téma");
    await closeButton.click();
    await unsaved.getByRole("button", { name: "Zahodit změny" }).click();
    await expect(propose).toBeHidden();

    await chooseInMenu(page, "Týmové priority", "Upravit téma");
    const edit = page.getByRole("dialog", { name: "Upravit téma" });
    await expect(edit.getByRole("button", { name: "Zrušit úpravy" })).toBeVisible();
    await edit.getByRole("button", { name: "Zrušit úpravy" }).click();
    await expect(edit).toBeHidden();
  });

  test("Naplánovat téma: termín tématu, vhodné návrhy s vysvětlením a nová akce s předvyplněným tématem", async ({ page }) => {
    await openTopics(page);
    await chooseInMenu(page, "Příprava na úvodní schůzku", "Naplánovat téma");
    const plan = page.getByRole("dialog", { name: "Naplánovat téma" });
    // Stávající termín je nahoře s hlavním odkazem, další termín je vedlejší volba (nejdřív nejvýš tři akce).
    await expect(plan.getByText(/^Naplánováno na 26\. 11\./)).toBeVisible();
    await expect(plan.getByRole("link", { name: "Otevřít stávající akci" })).toHaveClass(/btn-primary/);
    // Návrhy jsou první skupina, vysvětlení dopadu je jednou u nadpisu skupiny, ne pod kartou.
    const drafts = plan.getByRole("region", { name: "Návrhy bez tématu" });
    await expect(drafts.getByRole("heading", { name: /uloží se jen návrh/ })).toBeVisible();
    await expect(plan.getByRole("link", { name: "Vytvořit novou akci" })).not.toHaveClass(/btn-primary/);
    const items = plan.getByRole("listitem");
    expect(await items.count()).toBeLessThanOrEqual(3);
    await expect(items.first()).toContainText("Firemní vzdělávání FP · 13. 11.");
    // D-01: skupinu už říká typ „Firemní vzdělávání FP“, proto se neopakuje.
    await expect(drafts.getByRole("listitem").first()).toContainText("Firemní vzdělávání FP · 13. 11.");
    await expect(items.first()).not.toContainText("návrh");
    await expect(items.first()).not.toContainText("Finanční poradci");
    const more = plan.getByRole("button", { name: /^Zobrazit další/ });
    if (await more.isVisible()) {
      await more.click();
      expect(await items.count()).toBeGreaterThan(3);
    }
    await expectNoHorizontalScroll(page);

    await plan.getByRole("link", { name: "Vytvořit novou akci" }).click();
    const add = page.getByRole("dialog", { name: "Přidat akci" });
    await expect(add).toBeVisible();
    await expect(add.getByLabel(/^Téma/)).toHaveValue("Příprava na úvodní schůzku");
    await expect(add.locator('input[type="hidden"][name="type"]')).toHaveValue("education-fp");
    await expect(add.getByLabel(/^Datum/)).toHaveValue("2026-11-13");
    await page.keyboard.press("Escape");
    await expect(add).toBeHidden();
    await expect(page).not.toHaveURL(/tema=/);
  });

  test("zveřejněná akce se otevře s předvyplněným tématem, bez uložení se nic nezmění", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-24&tema=topic-priority");
    await settle(page);
    const window = page.getByRole("dialog").filter({ hasText: "je předvyplněné" });
    await expect(window.getByText("Téma „Týmové priority“ je předvyplněné, zatím nic není uložené ani zveřejněné.")).toBeVisible();
    await expect(window.getByLabel(/^Téma/)).toHaveValue("Týmové priority");
    await expect(window.getByRole("button", { name: "Uložit jako návrh" })).toBeEnabled();
    await page.keyboard.press("Escape");
    // Zavření okna odebere akci z adresy. Bez čekání by ji WebKit přepsal až po dalším goto.
    await expect(page).not.toHaveURL(/akce=/);
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-24&upravit=1");
    await settle(page);
    await expect(page.getByRole("dialog").getByLabel(/^Téma/)).toHaveValue("");
  });

  test("doporučení ve formuláři: garantované první se štítkem, upozornění při jiné skupině @desktop", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
    await settle(page);
    await page.getByRole("button", { name: "Přidat akci", exact: true }).click();
    const add = page.getByRole("dialog", { name: "Přidat akci" });
    await chooseOption(add, "Typ", { value: "education-fp" });
    const suggestions = add.getByLabel("Doporučená témata").getByRole("button");
    await expect(suggestions.first()).toContainText("Otevřené otázky na schůzce");
    await expect(suggestions.first()).toContainText("Garantované");
    await expect(suggestions.first()).toContainText("2 zájemci");
    await expect(suggestions.nth(1)).toContainText("Doporučené");
    await suggestions.first().click();
    await chooseOption(add, /^Pro koho/, { value: "rm" });
    await expect(add.getByText(/je pro skupinu Finanční poradci, akce je pro Relationship manažeři/)).toBeVisible();
    await page.keyboard.press("Escape");
  });
});

test.describe("Témata: zápis priority, pořadí a návrhu @desktop @zapis-temat", () => {
  test.use({ storageState: authFile("spravce") });
  // Oba testy mění stejné sdílené pořadí, nesmí běžet souběžně.
  test.describe.configure({ mode: "serial" });

  test("přetažení témat: dlouhý seznam, mezi skupinami, prázdná skupina, Esc, klávesnice, prst, souběh a archivace", async ({ page, browser }) => {
    test.setTimeout(240_000);
    await openTopics(page);
    const guaranteedRow = (name: string) => page.locator(".topic-guaranteed .topic-row").filter({ hasText: name });

    // Dlouhý seznam: 18 vlastních témat pro Tým A (nedostanou se do doporučení pro FP a RM), ostatních je pak 20.
    const own = Array.from({ length: 18 }, (_, i) => `DnD téma ${String(i + 1).padStart(2, "0")}`);
    const propose = page.getByRole("dialog", { name: "Navrhnout téma" });
    for (const name of own) {
      await page.getByRole("button", { name: "Navrhnout téma" }).click();
      await propose.getByLabel("Téma").fill(name);
      await propose.getByLabel("Pro koho").selectOption("tym-a");
      await propose.getByRole("button", { name: "Navrhnout téma" }).click();
      await expect(propose).toBeHidden();
    }
    await page.reload();
    await settle(page);
    expect((await names(othersOf(page))).length).toBeGreaterThanOrEqual(20);
    expect(await names(guaranteedOf(page))).toEqual(SEED_GUARANTEED);

    // Uvnitř ostatních: o 1, 3, 5 a více míst oběma směry, vždy jedním tažením a s uložením po obnovení.
    for (const [from, to] of [[2, 3], [4, 7], [12, 7], [3, 9], [14, 6]] as const) {
      const before = await names(othersOf(page));
      await dragTo(page, before[from]!, "other", to);
      await expectSaved(page, { others: moved(before, from, to) });
    }

    // Poslední → první: úchyt u spodní hrany, pak k horní hraně okna, stránka se sama posune nahoru.
    let before = await names(othersOf(page));
    const last = before.at(-1)!;
    await handleOf(page, last).scrollIntoViewIfNeeded();
    await pressHandle(page, last);
    await page.mouse.move(640, 300, { steps: 4 });
    await page.mouse.move(640, 4, { steps: 6 });
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBe(0);
    const firstBox = (await othersOf(page).locator(".topic-row").first().boundingBox())!;
    await page.mouse.move(640, firstBox.y + firstBox.height * 0.25, { steps: 4 });
    await expect(page.locator(".topic-drag-overlay")).toHaveText(last);
    await expect(page.locator(".topic-drop-line")).toBeVisible();
    await page.mouse.up();
    await expectSaved(page, { others: moved(before, before.length - 1, 0) });

    // První → poslední: k dolní hraně okna, stránka se posune dolů.
    before = await names(othersOf(page));
    await handleOf(page, before[0]!).scrollIntoViewIfNeeded();
    await pressHandle(page, before[0]!);
    await page.mouse.move(640, 400, { steps: 4 });
    await page.mouse.move(640, 796, { steps: 6 });
    await expect.poll(async () => (await othersOf(page).locator(".topic-row").last().boundingBox())!.y + 40 < 800, { timeout: 10_000 }).toBe(true);
    const lastBox = (await othersOf(page).locator(".topic-row").last().boundingBox())!;
    await page.mouse.move(640, lastBox.y + lastBox.height * 0.8, { steps: 4 });
    await page.mouse.up();
    await expectSaved(page, { others: moved(before, 0, before.length - 1) });

    // Esc během tažení: nic se neuloží ani nepřesune.
    before = await names(othersOf(page));
    await handleOf(page, before[1]!).scrollIntoViewIfNeeded();
    await pressHandle(page, before[1]!);
    const target = (await othersOf(page).locator(".topic-row").nth(5).boundingBox())!;
    await page.mouse.move(640, target.y + target.height * 0.8, { steps: 6 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.locator(".topic-drag-overlay")).toHaveCount(0);
    await expect(page.locator("[aria-live=polite]").filter({ hasText: "Přesun zrušen." })).toHaveCount(1);
    await expectSaved(page, { others: before });

    // Ostatní → garantovaná (na 1. místo), garantované → ostatní, garantované v rámci skupiny.
    const promoted = own[0]!;
    let others = await names(othersOf(page));
    await dragTo(page, promoted, "guaranteed", 0);
    await expectSaved(page, { guaranteed: [promoted, ...SEED_GUARANTEED], others: others.filter((n) => n !== promoted) });
    await expect(page.locator(".topic-guaranteed .topic-rank")).toHaveText(["1", "2", "3"]);
    await dragTo(page, promoted, "guaranteed", 2);
    await expectSaved(page, { guaranteed: [...SEED_GUARANTEED, promoted] });
    others = await names(othersOf(page));
    await dragTo(page, promoted, "other", 1);
    await expectSaved(page, { guaranteed: SEED_GUARANTEED, others: [others[0]!, promoted, ...others.slice(1)] });

    // Prázdná skupina: obě garantovaná mezi ostatní, prázdná plocha je cíl, pak zpět ve stejném pořadí.
    await dragTo(page, SEED_GUARANTEED[1]!, "other", 0);
    await dragTo(page, SEED_GUARANTEED[0]!, "other", 0);
    await expectSaved(page, { guaranteed: [] });
    const empty = page.locator(".topic-group-guaranteed .topic-drop-empty");
    await expect(empty).toBeVisible();
    await pressHandle(page, SEED_GUARANTEED[0]!);
    const zone = (await empty.boundingBox())!;
    await page.mouse.move(640, zone.y + zone.height / 2, { steps: 8 });
    await expect(empty).toHaveClass(/is-target/);
    await page.mouse.up();
    await expectSaved(page, { guaranteed: [SEED_GUARANTEED[0]!] });
    await dragTo(page, SEED_GUARANTEED[1]!, "guaranteed", 1);
    await expectSaved(page, { guaranteed: SEED_GUARANTEED });
    await expect(rowOf(guaranteedOf(page), SEED_GUARANTEED[0]!).getByText("Nejžádanější")).toBeVisible();

    // Klávesnice: šipka dolů u posledního garantovaného ho přesune mezi ostatní, šipka nahoru zpět. Fokus zůstává.
    const kb = handleOf(page, SEED_GUARANTEED[1]!);
    await kb.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("[aria-live=polite]").filter({ hasText: "už není garantované" })).toHaveCount(1);
    await expect(kb).toBeFocused();
    await expect(guaranteedRow(SEED_GUARANTEED[1]!)).toHaveCount(0);
    // Další přesun až po uložení předchozího (během ukládání seznam další přesun nepřijme).
    await expect(page.locator(".topic-board[aria-busy=true]")).toHaveCount(0);
    await page.keyboard.press("ArrowUp");
    await expect(guaranteedRow(SEED_GUARANTEED[1]!)).toHaveCount(1);
    await expect(kb).toBeFocused();
    await expectSaved(page, { guaranteed: SEED_GUARANTEED });

    // Souběh: druhé okno změní pořadí, první má staré a jeho přetažení server odmítne, okno vrátí a načte aktuální.
    const second = await page.context().newPage();
    await openTopics(second);
    before = await names(othersOf(page));
    await dragTo(second, before[0]!, "other", 2);
    await expectSaved(second, { others: moved(before, 0, 2) });
    await dragTo(page, before[3]!, "other", 0, false);
    await expect(page.getByRole("alert").filter({ hasText: "změnil někdo jiný" })).toBeVisible();
    await expect.poll(() => names(othersOf(page))).toEqual(moved(before, 0, 2));
    await second.close();

    // Po archivaci tématu se přetahuje v aktuálním seznamu.
    await chooseInMenu(page, own[17]!, "Archivovat…");
    await page.getByRole("dialog", { name: "Archivovat téma" }).getByRole("button", { name: "Archivovat téma" }).click();
    await expect(rowOf(othersOf(page), own[17]!)).toHaveCount(0);
    before = await names(othersOf(page));
    await dragTo(page, before.at(-1)!, "other", before.length - 6);
    await expectSaved(page, { others: moved(before, before.length - 1, before.length - 6) });

    // Prst na telefonu (390 px): úchyt o dva řádky dolů, stránka se pod prstem neposune.
    const phone = await browser.newContext({ storageState: authFile("spravce"), viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const mobile = await phone.newPage();
    await openTopics(mobile);
    before = await names(othersOf(mobile));
    const mobileHandle = handleOf(mobile, before[0]!);
    await mobileHandle.scrollIntoViewIfNeeded();
    const cdp: CDPSession = await phone.newCDPSession(mobile);
    const a = (await mobileHandle.boundingBox())!;
    const b = (await othersOf(mobile).locator(".topic-row").nth(2).boundingBox())!;
    const scrollBefore = await mobile.evaluate(() => window.scrollY);
    const x = a.x + a.width / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: a.y + a.height / 2 }] });
    for (let i = 1; i <= 10; i++) {
      const y = a.y + a.height / 2 + ((b.y + b.height * 0.8 - a.y - a.height / 2) * i) / 10;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
      await mobile.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    expect(await mobile.evaluate(() => window.scrollY)).toBe(scrollBefore);
    await expectSaved(mobile, { others: moved(before, 0, 2) });
    await expectNoHorizontalScroll(mobile);
    await phone.close();

    // Úklid: vlastní témata do archivu, ostatní zpět podle zájmu, garantovaná jako v seedu.
    await page.reload();
    await settle(page);
    for (const name of own.slice(0, 17)) {
      await chooseInMenu(page, name, "Archivovat…");
      await page.getByRole("dialog", { name: "Archivovat téma" }).getByRole("button", { name: "Archivovat téma" }).click();
      await expect(rowOf(othersOf(page), name)).toHaveCount(0);
    }
    await othersOf(page).getByRole("button", { name: "Seřadit podle zájmu" }).click();
    await expect(othersOf(page).getByText("Pořadí upravil správce.")).toBeHidden();
    expect(await names(guaranteedOf(page))).toEqual(SEED_GUARANTEED);
  });

  test("nastavit a zrušit prioritu, posunout a vrátit pořadí, přidat téma do návrhu", async ({ page }) => {
    await openTopics(page);
    const guaranteed = () => page.locator(".topic-guaranteed .item-title > span[id]");

    await chooseInMenu(page, "Týmové priority", "Nastavit prioritu");
    await expect(guaranteed()).toHaveText(["Otevřené otázky na schůzce", "Návaznost po konzultaci", "Týmové priority"]);
    await page.keyboard.press("Escape");
    await chooseInMenu(page, "Týmové priority", "Posunout výš");
    await expect(guaranteed()).toHaveText(["Otevřené otázky na schůzce", "Týmové priority", "Návaznost po konzultaci"]);
    await page.keyboard.press("Escape");
    await chooseInMenu(page, "Týmové priority", "Zrušit prioritu");
    await expect(guaranteed()).toHaveText(["Otevřené otázky na schůzce", "Návaznost po konzultaci"]);
    await page.keyboard.press("Escape");

    // Ruční pořadí ostatních: tichá poznámka nad seznamem, Seřadit podle zájmu ho vrátí.
    const others = page.locator(".topic-group").filter({ has: page.getByRole("heading", { name: "Ostatní témata" }) });
    const first = await others.locator(".item-title > span[id]").first().textContent();
    await chooseInMenu(page, first!, "Posunout níž");
    await expect(others.getByText("Pořadí upravil správce.")).toBeVisible();
    await expect(others.locator(".item-title > span[id]").nth(1)).toHaveText(first!);
    await page.keyboard.press("Escape");
    await others.getByRole("button", { name: "Seřadit podle zájmu" }).click();
    await expect(others.getByText("Pořadí upravil správce.")).toBeHidden();
    await expect(others.locator(".item-title > span[id]").first()).toHaveText(first!);

    // Vlastní návrh firemního vzdělávání FP bez tématu v prosinci.
    await page.goto("/vzdelavani/harmonogram?mesic=2026-12");
    await settle(page);
    await page.getByRole("button", { name: "Přidat akci", exact: true }).click();
    const add = page.getByRole("dialog", { name: "Přidat akci" });
    await chooseOption(add, "Typ", { value: "education-fp" });
    await add.getByLabel(/^Datum/).fill("2026-12-04");
    await add.getByRole("button", { name: "Uložit jako návrh" }).click();
    await expect(add).toBeHidden();

    await openTopics(page);
    await chooseInMenu(page, "Otevřené otázky na schůzce", "Naplánovat téma");
    const plan = page.getByRole("dialog", { name: "Naplánovat téma" });
    const more = plan.getByRole("button", { name: /^Zobrazit další/ });
    await expect(plan.getByRole("listitem").first()).toBeVisible();
    if (await more.isVisible()) await more.click();
    const item = plan.getByRole("listitem").filter({ hasText: "· 4. 12." });
    await item.getByRole("button", { name: /^Přiřadit k akci/ }).click();
    await expect(plan).toBeHidden();
    await expect(page.getByText(/Téma „Otevřené otázky na schůzce“ je v návrhu akce 4\. 12\. Termín se potvrzuje, kolegové ho uvidí po zveřejnění\./)).toBeVisible();
    await openTopics(page);
    // Garantované téma bez zveřejněného termínu: místo červeného „bez termínu“ oranžově termín návrhu.
    const planned = rowOf(page.locator("main"), "Otevřené otázky na schůzce");
    await expect(planned.locator(".topic-in-draft")).toHaveText("termín se potvrzuje");
    await expect(planned.locator(".topic-in-draft")).toHaveAttribute("title", "Návrh akce 4. 12.");
    await expect(planned.locator(".topic-unscheduled")).toHaveCount(0);

    // Návrh má téma a zůstal návrhem.
    await page.goto("/vzdelavani/harmonogram?mesic=2026-12");
    await settle(page);
    const card = page.locator("a[data-move-id]").filter({ hasText: "Otevřené otázky na schůzce" });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(/Návrh/);
  });

  test("garantovaných témat je neomezeně: 3. až 6. téma, pořadí, odebrání a přetrvání po obnovení (0015) @smoke", async ({ page }) => {
    await openTopics(page);
    const guaranteed = () => names(guaranteedOf(page));
    // Ostatních témat musí být aspoň čtyři: chybějící navrhne správce pro Tým A. Nové téma se může zařadit
    // i mezi Nejžádanější a vytlačit jiné do Ostatních, proto se počet ověřuje znovu po každém návrhu.
    const propose = page.getByRole("dialog", { name: "Navrhnout téma" });
    for (let i = 1; (await names(othersOf(page))).length < 4 && i <= 8; i++) {
      await page.getByRole("button", { name: "Navrhnout téma" }).click();
      await propose.getByLabel("Téma").fill(`Garance téma ${i}`);
      await propose.getByLabel("Pro koho").selectOption("tym-a");
      await propose.getByRole("button", { name: "Navrhnout téma" }).click();
      await expect(propose).toBeHidden();
      await expect(page.locator(".item-title > span[id]", { hasText: `Garance téma ${i}` })).toBeVisible();
    }
    const extra = (await names(othersOf(page))).slice(0, 4);
    expect(extra).toHaveLength(4);
    const [third, fourth, fifth, sixth] = extra as [string, string, string, string];
    // Bez horního limitu: každé další téma nabídne „Nastavit prioritu“ a zařadí se na konec.
    for (const [i, name] of extra.entries()) {
      await chooseInMenu(page, name, "Nastavit prioritu");
      await expect(guaranteedOf(page).locator(".item-title > span[id]")).toHaveText([...SEED_GUARANTEED, ...extra.slice(0, i + 1)]);
      await page.keyboard.press("Escape");
    }
    await expect(page.locator(".topic-guaranteed .topic-rank")).toHaveText(["1", "2", "3", "4", "5", "6"]);
    await page.reload();
    await settle(page);
    expect(await guaranteed()).toEqual([...SEED_GUARANTEED, ...extra]);

    // Pořadí: šesté téma o místo výš, pak odebrat garanci čtvrtému; obojí přetrvá po obnovení.
    await chooseInMenu(page, sixth, "Posunout výš");
    const reordered = [...SEED_GUARANTEED, third, fourth, sixth, fifth];
    await expect(guaranteedOf(page).locator(".item-title > span[id]")).toHaveText(reordered);
    await page.keyboard.press("Escape");
    await chooseInMenu(page, fourth, "Zrušit prioritu");
    await expect(guaranteedOf(page).locator(".item-title > span[id]")).toHaveText(reordered.filter((n) => n !== fourth));
    await page.keyboard.press("Escape");
    await page.reload();
    await settle(page);
    expect(await guaranteed()).toEqual(reordered.filter((n) => n !== fourth));
    // Garance nesouvisí s Nejžádanějšími: odebrané téma je zpět mezi ostatními.
    expect(await names(othersOf(page))).toContain(fourth);

    // Úklid: zpět na seed, aby další běhy začínaly stejně.
    for (const name of [third, sixth, fifth]) {
      await chooseInMenu(page, name, "Zrušit prioritu");
      await page.keyboard.press("Escape");
    }
    await expect(guaranteedOf(page).locator(".item-title > span[id]")).toHaveText(SEED_GUARANTEED);
  });
});

test.describe("Témata očima účastníka", () => {
  test.use({ storageState: authFile("ucastnikFp") });

  test("vidí garantovaná témata, správu ani výzvu ne", async ({ page }) => {
    await openTopics(page);
    await expect(page.getByRole("heading", { name: "Garantovaná témata" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Možnosti tématu/ })).toHaveCount(0);
    await expect(page.getByText(/Zatím nejsou nastavená garantovaná témata/)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test("F10–F12: vysvětlení ano, úchyty, čísla pořadí, správa pořadí ani „zatím neproběhlo“ ne", async ({ page }) => {
    await openTopics(page);
    await expect(guaranteedOf(page).getByText("Správce je plánuje přednostně.")).toBeVisible();
    await expect(page.locator(".topic-handle, .topic-rank, .topic-lead")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Změnit pořadí/ })).toHaveCount(0);
    await expect(page.getByText("Pořadí upravil správce.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Seřadit podle zájmu" })).toHaveCount(0);
    await expect(page.getByText("zatím neproběhlo")).toHaveCount(0);
    await expect(page.getByText(/termín se potvrzuje/i)).toHaveCount(0);
    // Všechna nearchivovaná témata jsou dostupná všem; „Pro mou roli“ (výchozí) ukáže jen témata FP.
    await expect(page.getByRole("link", { name: "Pro mou roli", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Návaznost po konzultaci")).toHaveCount(0);
    await page.getByRole("link", { name: "Všechna", exact: true }).click();
    await expect(page.getByText("Návaznost po konzultaci").first()).toBeVisible();
    // Jména zájemců ani správu kolega nevidí ani ve „Všechna“.
    await expect(page.getByRole("button", { name: /^Možnosti tématu/ })).toHaveCount(0);
  });
});
