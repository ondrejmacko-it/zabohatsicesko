import type { Page } from "@playwright/test";
import { authFile, chooseOption, expect, expectNoHorizontalScroll, settle, test } from "./support";

const dialog = (page: Page, title: string | RegExp) => page.getByRole("dialog", { name: title });

async function openPrepare(page: Page) {
  await page.goto("/vzdelavani/harmonogram");
  await settle(page);
  await page.getByRole("button", { name: /^Připravit měsíc/ }).click();
  return dialog(page, /Připravit měsíc:/);
}

// Bez zápisu do databáze: nic se neukládá, okno se zavře bez uložení.
test.describe("Připravit měsíc: přehled a hromadné doplnění vedoucího", () => {
  test.use({ storageState: authFile("spravce") });

  test("přehled stavu ukáže počty a přejde na první dotčený řádek", async ({ page }) => {
    const prepare = await openPrepare(page);
    const overview = prepare.getByRole("list", { name: "Stav návrhů" });
    await expect(overview.getByRole("button")).toHaveCount(5);
    for (const label of ["Připraveno", "Chybí vedoucí", "Chybí téma", "Kolize", "Vybráno"]) {
      await expect(overview.getByRole("button", { name: new RegExp(`^${label}: \\d+`) })).toBeVisible();
    }
    // Kolize říká, s jakou akcí a kdy se návrh kryje, a co s tím (ne jen „jinou akci“).
    const clashes = prepare.locator(".publish-clash");
    for (const text of await clashes.allTextContents()) expect(text).toMatch(/„.+“ \(.+\d{1,2}:\d{2}.*\)\. /);

    // Prvnímu řádku vedoucího vyprázdníme: přehled to započítá živě a přechod skočí právě na jeho pole.
    const firstLead = prepare.getByLabel(/^Vedoucí: /).first();
    const leadName = (await firstLead.getAttribute("name"))!;
    await firstLead.selectOption("");
    const missingLead = overview.getByRole("button", { name: /^Chybí vedoucí: [1-9]/ });
    await missingLead.click();
    await expect(page.locator(":focus")).toHaveAttribute("name", leadName);

    // Vybráno: fokus na zaškrtávací pole prvního vybraného řádku.
    const picked = overview.getByRole("button", { name: /^Vybráno: / });
    if (await picked.isEnabled()) {
      await picked.click();
      await expect(page.locator(":focus")).toHaveAttribute("name", "pick");
    }
    await expectNoHorizontalScroll(page);
  });

  test("téma řádku: stejná nabídka jako v okně akce, přehled se aktualizuje", async ({ page }) => {
    const prepare = await openPrepare(page);
    const overview = prepare.getByRole("list", { name: "Stav návrhů" });
    const missingTopic = async () => Number((await overview.getByRole("button", { name: /^Chybí téma: / }).textContent())?.match(/\d+/)?.[0]);
    const topic = prepare.getByRole("combobox", { name: /^Téma: / }).first();
    const list = prepare.getByRole("listbox", { name: "Témata" }).first();
    await expect(prepare.locator("datalist")).toHaveCount(0);

    await topic.fill("");
    const before = await missingTopic();
    // Diakritika se při hledání nerozlišuje, Enter vybere první shodu a formulář se neodešle.
    await topic.fill("uvodni");
    await expect(list).toBeVisible();
    await expect(list.getByRole("option").first()).toContainText(/úvodní/i);
    await page.keyboard.press("Enter");
    await expect(list).toBeHidden();
    await expect(topic).toHaveValue(/úvodní/i);
    await expect(prepare).toBeVisible();
    await expect.poll(missingTopic).toBe(before - 1);

    // Esc zavře jen nabídku, okno Připravit měsíc zůstane.
    await topic.click();
    await expect(list).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
    await expect(prepare).toBeVisible();
    // Ruční text bez shody: nabídka se schová, hodnota zůstane. Tab nabídku zavře.
    await topic.fill("Vlastní téma e2e");
    await expect(topic).toHaveAttribute("aria-expanded", "false");
    await expect(topic).toHaveValue("Vlastní téma e2e");
    await page.keyboard.press("Tab");

    // Poslední řádek: zvýrazněná možnost je vidět, nabídka se neořízne.
    const last = prepare.getByRole("combobox", { name: /^Téma: / }).last();
    await last.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(prepare.locator(".combobox-option[aria-selected=true]")).toBeInViewport();
    await page.keyboard.press("Escape");
    await expectNoHorizontalScroll(page);

    // Výběr se počítá jako rozepsaná změna: zavření se zeptá.
    await prepare.getByRole("button", { name: "Zavřít" }).first().click();
    await expect(page.getByRole("alertdialog", { name: "Neuložené změny" })).toBeVisible();
  });

  test("doplnění vedoucího jen do prázdných polí, vyplněná zůstanou", async ({ page }) => {
    const prepare = await openPrepare(page);
    const leads = prepare.getByLabel(/^Vedoucí: /);
    const count = await leads.count();
    expect(count).toBeGreaterThanOrEqual(2);
    const options = await leads.first().locator("option").evaluateAll((list) => list.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    expect(options.length).toBeGreaterThanOrEqual(2);
    const [kept, bulk] = options as [string, string];

    // Výchozí stav: první řádek prázdný, druhý s jiným vedoucím, než se bude doplňovat.
    await leads.nth(0).selectOption("");
    await leads.nth(1).selectOption(kept);
    const before = await leads.evaluateAll((list) => list.map((s) => (s as HTMLSelectElement).value));
    const empty = before.filter((value) => !value).length;

    const fill = prepare.getByRole("button", { name: /^Doplnit do \d+ řádk/ });
    await expect(prepare.getByText(/vyplněné vedoucí se nepřepíšou/)).toBeVisible();
    await prepare.getByLabel("Vedoucí do prázdných polí").selectOption(bulk);
    await expect(fill).toHaveText(new RegExp(`Doplnit do ${empty} řádk`));
    await fill.click();

    const after = await leads.evaluateAll((list) => list.map((s) => (s as HTMLSelectElement).value));
    after.forEach((value, i) => expect(value).toBe(before[i] || bulk));
    await expect(leads.nth(1)).toHaveValue(kept);
    await expect(prepare.getByRole("status").filter({ hasText: /doplněn do \d+ řádk/ })).toBeVisible();
    await expect(prepare.getByRole("list", { name: "Stav návrhů" }).getByRole("button", { name: /^Chybí vedoucí: 0/ })).toBeDisabled();

    // Doplnění je rozepsaná změna: zavření se zeptá a bez uložení nic nezmění.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog", { name: "Neuložené změny" })).toBeVisible();
    await page.getByRole("button", { name: "Zahodit změny" }).click();
    await expect(prepare).toBeHidden();
  });

  test("samotná volba pro hromadné doplnění není rozepsaná změna", async ({ page }) => {
    const prepare = await openPrepare(page);
    const options = prepare.getByLabel("Vedoucí do prázdných polí").locator("option");
    const value = await options.nth(1).getAttribute("value");
    await prepare.getByLabel("Vedoucí do prázdných polí").selectOption(value!);
    await page.keyboard.press("Escape");
    await expect(prepare).toBeHidden();
  });
});

// Reprodukce chyby z Preview: skutečná volba v prohlížeči pošle `input` a `change` zvlášť (klávesnice,
// myš v nabídce). `selectOption` je pošle naráz, a proto chybu dřív neodhalil. Tady se vybírá klávesnicí.
test.describe("Připravit měsíc: vedoucí vybraný klávesnicí se doplní a uloží @desktop", () => {
  test.use({ storageState: authFile("spravce") });
  // Vlastní měsíc, zápis nepotká ostatní testy nad sdílenými daty ukázky.
  const PLAN = "/vzdelavani/harmonogram?mesic=2027-05";

  test("hromadný i řádkový výběr, opakovaná změna, uložení a obnovení", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "windows-1280", "zápis jen jednou");
    await page.goto(PLAN);
    await settle(page);
    await page.getByRole("button", { name: /^Připravit měsíc/ }).click();
    const prepare = dialog(page, /Připravit měsíc:/);
    await prepare.getByRole("button", { name: "Doplnit chybějící termíny" }).click();
    const leads = prepare.getByLabel(/^Vedoucí: /);
    await expect.poll(() => leads.count()).toBeGreaterThanOrEqual(3);
    const values = () => leads.evaluateAll((list) => list.map((s) => (s as HTMLSelectElement).value));
    expect((await values()).every((v) => v === "")).toBe(true);
    const count = (await values()).length;
    const missing = prepare.getByRole("list", { name: "Stav návrhů" }).getByRole("button", { name: /^Chybí vedoucí: / });
    await expect(missing).toHaveAccessibleName(new RegExp(`^Chybí vedoucí: ${count}`));

    // Jeden řádek ručně klávesnicí: první osoba v seznamu.
    await leads.nth(0).focus();
    await page.keyboard.press("ArrowDown");
    const first = await leads.nth(0).inputValue();
    expect(first).not.toBe("");
    await expect(missing).toHaveAccessibleName(new RegExp(`^Chybí vedoucí: ${count - 1}`));

    // Hromadný výběr klávesnicí: druhá osoba. Výběr musí zůstat vidět a aktivovat tlačítko.
    const bulk = prepare.getByLabel("Vedoucí do prázdných polí");
    await bulk.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    const second = await bulk.inputValue();
    expect(second).not.toBe("");
    expect(second).not.toBe(first);
    const fill = prepare.getByRole("button", { name: new RegExp(`^Doplnit do ${count - 1} řádk`) });
    await expect(fill).toBeEnabled();
    await fill.click();
    expect(await values()).toEqual([first, ...Array(count - 1).fill(second)]);
    await expect(missing).toHaveAccessibleName(/^Chybí vedoucí: 0/);

    // Opakovaná změna: poslední řádek vyprázdnit, hromadně zvolit jinou osobu a doplnit znovu.
    await leads.last().focus();
    await page.keyboard.press("Home");
    await expect(leads.last()).toHaveValue("");
    await bulk.focus();
    await page.keyboard.press("ArrowUp");
    const third = await bulk.inputValue();
    expect(third).not.toBe(second);
    expect(third).not.toBe("");
    await prepare.getByRole("button", { name: /^Doplnit do 1 řádku/ }).click();
    const expected = [first, ...Array(count - 2).fill(second), third];
    expect(await values()).toEqual(expected);

    // Téma tu není předmětem testu. Doplnění předvyplní i garantované téma, které čtecí testy Témat čekají
    // „bez termínu“ (seed), proto se návrhy ukládají bez tématu.
    const topics = prepare.getByRole("combobox", { name: /^Téma: / });
    for (let i = 0; i < (await topics.count()); i++) await topics.nth(i).fill("");

    await prepare.getByRole("button", { name: "Uložit změny" }).click();
    await expect(prepare.getByText(new RegExp(`^Uloženo: ${count} návrh`))).toBeVisible();

    // Po obnovení stránky zůstali vedoucí uložení, nic se nezveřejnilo.
    await page.reload();
    await settle(page);
    await page.getByRole("button", { name: /^Připravit měsíc/ }).click();
    await expect.poll(values).toEqual(expected);
    await expect(prepare.getByRole("button", { name: /^Zveřejnit/ })).toBeVisible();
  });
});

test.describe("okno akce: ochrana neuložených změn", () => {
  test.use({ storageState: authFile("spravce") });

  test("Přidat akci: bez změny zavře hned, se změnou se zeptá, po vrácení hodnoty už ne", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
    await settle(page);
    const open = page.getByRole("button", { name: "Přidat akci", exact: true });
    const add = dialog(page, "Přidat akci");
    const confirm = page.getByRole("alertdialog", { name: "Neuložené změny" });

    await open.click();
    await page.keyboard.press("Escape");
    await expect(add).toBeHidden();
    await expect(confirm).toHaveCount(0);

    await open.click();
    const topic = add.getByLabel(/^Téma/);
    const original = await topic.inputValue();
    await topic.fill("Rozepsané téma");
    await add.getByRole("button", { name: "Zavřít", exact: true }).click();
    await expect(confirm).toBeVisible();
    // Bez názvu nejde uložit: potvrzení uložení nenabídne a formulář pod ním nehlásí chyby (uživatel nic neukládal).
    await expect(confirm.getByRole("button", { name: "Uložit jako návrh" })).toHaveCount(0);
    await expect(add.getByText("Akci zatím nejde uložit")).toHaveCount(0);
    await confirm.getByRole("button", { name: "Pokračovat v úpravách" }).click();
    await expect(add).toBeVisible();
    await expect(topic).toHaveValue("Rozepsané téma");
    await expect(confirm).toHaveCount(0);

    // Porovnávají se hodnoty: vrácené pole už za změnu nestojí.
    await topic.fill(original);
    // Psaní otevře nabídku témat; první Esc zavře jen ji, druhý okno.
    await page.keyboard.press("Escape");
    await expect(add.getByRole("listbox")).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(add).toBeHidden();
  });

  test("okno akce s předvyplněným tématem se při zavření bez úprav neptá", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-24&tema=topic-priority");
    await settle(page);
    const window = page.getByRole("dialog").filter({ hasText: "je předvyplněné" });
    await expect(window.getByLabel(/^Téma/)).toHaveValue("Týmové priority");
    await page.keyboard.press("Escape");
    await expect(window).toBeHidden();
    await expect(page.getByRole("alertdialog", { name: "Neuložené změny" })).toHaveCount(0);
  });

  test("okno akce: změna se při zavření ohlásí, Zahodit změny je zahodí", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-24");
    await settle(page);
    const window = page.getByRole("dialog").filter({ has: page.getByLabel(/^Téma/) });
    await window.getByLabel(/^Téma/).fill("Neuložená změna");
    await page.keyboard.press("Escape");
    const confirm = page.getByRole("alertdialog", { name: "Neuložené změny" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Zahodit změny" }).click();
    await expect(window).toBeHidden();
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-24");
    await settle(page);
    await expect(page.getByRole("dialog").getByLabel(/^Téma/)).toHaveValue("");
  });
});

test.describe("okno akce: zahození neveřejných změn se potvrzuje @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  test("Zahodit změny se nejdřív zeptá, Zpět nic nezahodí, potvrzení vrátí zveřejněnou verzi", async ({ page }, info) => {
    test.skip(info.project.name !== "windows-1280", "Zapisuje do sdílených dat ukázky, stačí jeden projekt.");
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-26");
    await settle(page);
    const window = page.getByRole("dialog").filter({ has: page.getByLabel(/^Vede/) });
    await chooseOption(window, /^Vede/, { label: "Správce ZBC ukázky" });
    await window.getByRole("button", { name: "Uložit jako návrh" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Návrh změny je uložený" })).toBeVisible();
    // Mřížka: okrový návrh leží na zveřejněné verzi, z níž vykukuje pruh. Najetí myší originál vysune dopředu
    // (vráceno po PR #91, kde stoh omylem zmizel). Karta návrhu dál říká slovy, co mění.
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
    await settle(page);
    const draftCard = page.locator('a[data-move-id="ev-11-26"]');
    await expect(draftCard).toContainText("Návrh změny");
    await expect(draftCard).toContainText("Mění vedoucí");
    const original = page.locator('[data-original-of="ev-11-26"]');
    await expect(original).toContainText("Zveřejněná verze");
    await expect(original).toContainText("Vedoucí akce");
    await expect(original).toHaveAttribute("aria-hidden", "true");
    await draftCard.scrollIntoViewIfNeeded();
    const box = (await original.boundingBox())!;
    const cell = (await page.locator("td").filter({ has: draftCard }).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(cell.x);
    expect(box.x + box.width).toBeLessThanOrEqual(cell.x + cell.width + 0.5);
    await page.mouse.move(box.x + box.width / 2, box.y + 6);
    await expect(original).toHaveCSS("z-index", "2");
    await expect(draftCard).toHaveCSS("opacity", "0.35");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(original).toHaveCSS("transition-duration", "0s");
    await page.emulateMedia({ reducedMotion: null });
    await page.mouse.move(0, 0);
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-26");
    await settle(page);
    const notice = window.getByText("Kolegové a Kalendář zatím vidí zveřejněnou verzi.");
    await expect(notice).toBeVisible();
    // Panel návrhu změny říká, co se mění, a rozbalí zveřejněnou verzi (originál).
    await expect(window.getByText(/Mění vedoucí\./)).toBeVisible();
    await window.getByText("Zveřejněná verze", { exact: true }).click();
    await expect(window.locator(".change-original-facts")).toContainText("Vedoucí akce");

    await window.getByRole("button", { name: "Zrušit návrh" }).click();
    const confirm = page.getByRole("dialog", { name: "Zrušit návrh změny?" });
    await expect(confirm).toBeVisible();
    // Sdílené potvrzení: bezpečná volba má fokus, pracovní okno pod ním zůstane vidět a Esc zavře jen potvrzení.
    await expect(confirm.getByRole("button", { name: "Zpět" })).toBeFocused();
    await expect(notice).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(confirm).toBeHidden();
    await expect(notice).toBeVisible();
    await window.getByRole("button", { name: "Zrušit návrh" }).click();
    await confirm.getByRole("button", { name: "Zpět" }).click();
    await expect(confirm).toBeHidden();
    await expect(notice).toBeVisible();

    await window.getByRole("button", { name: "Zrušit návrh" }).click();
    await confirm.getByRole("button", { name: "Zrušit návrh" }).click();
    await expect(notice).toBeHidden();
    // Otevřené okno ukáže zveřejněnou verzi hned, bez nového načtení.
    await expect(window.getByRole("combobox", { name: /^Vede/ })).toHaveValue("Vedoucí akce");
    await page.reload();
    await settle(page);
    await expect(window.getByRole("combobox", { name: /^Vede/ })).toHaveValue("Vedoucí akce");
  });
});

// Audit P0 §7: smazaný návrh z rozvrhu se běžným doplněním nevrací, vrátí ho výslovné Obnovit smazané návrhy.
// Únor 2028 je v ukázce prázdný a žádný jiný test do něj nezapisuje. Na konci se návrhy zase smažou.
test.describe("Připravit měsíc: obnova smazaných návrhů", () => {
  test.use({ storageState: authFile("spravce") });
  const MONTH_PLAN = "/vzdelavani/harmonogram?mesic=2028-02";

  async function deleteDrafts(page: Page, all: boolean) {
    await page.getByRole("button", { name: "Vybrat návrhy" }).click();
    const bar = page.getByRole("region", { name: "Hromadný výběr návrhů" });
    if (all) {
      await page.getByRole("checkbox", { name: /^Vybrat: / }).filter({ visible: true }).first().check();
      const everything = bar.getByRole("button", { name: "Vybrat všechny dostupné" });
      if (await everything.isVisible()) await everything.click();
    } else {
      await page.getByRole("checkbox", { name: /^Vybrat: / }).filter({ visible: true }).first().check();
      await expect(bar).toContainText("Vybráno 1");
    }
    await bar.getByRole("button", { name: "Smazat vybrané" }).click();
    const ask = page.getByRole("alertdialog", { name: /^Smazat / });
    await expect(ask).toContainText("termíny z rozvrhu obnoví Připravit měsíc");
    await ask.getByRole("button", { name: "Potvrdit smazání" }).click();
    // Hláška z předchozího mazání může být ještě vidět, stačí aspoň jedna.
    await expect(page.getByRole("status").filter({ hasText: /Smazán/ }).first()).toBeVisible();
    await settle(page);
  }

  test("smazaný návrh: doplnění řekne proč nic nevzniklo, obnova ho vrátí právě jednou", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "windows-1280", "zápis jen jednou");
    await page.goto(MONTH_PLAN);
    await settle(page);
    await page.getByRole("button", { name: /^Připravit měsíc/ }).click();
    const prepare = dialog(page, /Připravit měsíc:/);
    await prepare.getByRole("button", { name: "Doplnit chybějící termíny" }).click();
    await expect(prepare.getByText(/^Doplněno \d+ termín/)).toBeVisible();
    const rows = prepare.locator(".publish-row");
    await expect.poll(() => rows.count()).toBeGreaterThan(10);
    const total = await rows.count();
    // Po doplnění nikdo nic nepsal: zavření se nesmí ptát na neuložené změny (dřív se ptalo).
    await prepare.getByRole("button", { name: "Zavřít" }).click();
    await expect(page.getByRole("alertdialog", { name: "Neuložené změny" })).toHaveCount(0);
    await expect(prepare).toBeHidden();

    await deleteDrafts(page, false);
    await deleteDrafts(page, false);
    await page.getByRole("button", { name: /^Připravit měsíc/ }).click();
    await expect(rows).toHaveCount(total - 2);
    await expect(prepare.getByRole("button", { name: "Obnovit smazané návrhy (2)" })).toBeVisible();
    await expect(prepare.getByText("Smazané termíny z rozvrhu: 2. Doplnění je nevrací.")).toBeVisible();

    // Běžné doplnění smazaný termín nevrátí a řekne proč (dřív: „Všechny pravidelné termíny už v plánu jsou“).
    await prepare.getByRole("button", { name: "Doplnit chybějící termíny" }).click();
    await expect(prepare.getByText(/Nic nového k doplnění\. Dřív smazané termíny \(2\) se nevrací/)).toBeVisible();
    await expect(rows).toHaveCount(total - 2);

    // O4: rozepsaná úprava řádku. Doplnit se nejdřív zeptá, Zpět úpravu nechá, vrácená hodnota už ne.
    const lead = prepare.getByLabel(/^Vedoucí: /).first();
    const person = await lead.locator("option").nth(1).getAttribute("value");
    await lead.selectOption(person!);
    await prepare.getByRole("button", { name: "Doplnit chybějící termíny" }).click();
    const keep = page.getByRole("dialog", { name: "Neuložené úpravy" });
    await expect(keep).toContainText("Máš neuložené úpravy návrhů, doplněním se zahodí.");
    await keep.getByRole("button", { name: "Zpět" }).click();
    await expect(keep).toBeHidden();
    await expect(lead).toHaveValue(person!);
    await lead.selectOption("");
    await expect(prepare.getByRole("button", { name: "Doplnit chybějící termíny" })).toBeVisible();

    // O3: obnova jednoho termínu ze seznamu smazaných.
    await prepare.getByText("Obnovit jednotlivě (2)").click();
    const deletedList = prepare.getByRole("list", { name: "Smazané termíny" });
    await expect(deletedList.getByRole("listitem")).toHaveCount(2);
    await page.setViewportSize({ width: 320, height: 760 });
    await deletedList.scrollIntoViewIfNeeded();
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: testInfo.outputPath("priprava-mesice-jednotlive-320.png") });
    await page.setViewportSize({ width: 1280, height: 800 });
    await deletedList.getByRole("listitem").first().getByRole("button", { name: "Obnovit" }).click();
    await expect(rows).toHaveCount(total - 1);
    const restore = prepare.getByRole("button", { name: "Obnovit smazané návrhy (1)" });
    await expect(restore).toBeVisible();
    await expect(prepare.getByText("Obnovit jednotlivě (1)")).toBeVisible();

    await restore.click();
    await expect(prepare.getByText(/^Doplněno 1 termín jako návrh, nic se nezveřejnilo\. Z toho obnovené smazané termíny: 1\./)).toBeVisible();
    await expect(rows).toHaveCount(total);
    await expect(prepare.getByRole("button", { name: "Obnovit smazané návrhy", exact: true })).toBeVisible();
    await expect(prepare.getByText(/^Smazané termíny z rozvrhu:/)).toHaveCount(0);
    await expect(prepare.getByText(/se nevrací/)).toHaveCount(0);

    // Dialog s celým měsícem návrhů: bez vodorovného posunu od telefonu po široký monitor.
    for (const width of [320, 390, 1280, 1920]) {
      await page.setViewportSize({ width, height: width < 768 ? 760 : 900 });
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: testInfo.outputPath(`priprava-mesice-obnova-${width}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepare.getByRole("button", { name: "Zavřít" }).click();
    await expect(prepare).toBeHidden();

    // Úklid: návrhy s doporučenými tématy by měnily stav Témat pro čtecí testy.
    await deleteDrafts(page, true);
  });
});
