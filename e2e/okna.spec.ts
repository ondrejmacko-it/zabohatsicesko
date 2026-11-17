import type { Locator, Page } from "@playwright/test";
import { authFile, expect, expectNoHorizontalScroll, ROLES, settle, test, type Role } from "./support";

const dialog = (page: Page, title: string | RegExp) => page.getByRole("dialog", { name: title });

/** Okno je vidět, nejde posunout do strany a Esc ho zavře. */
async function checkDialog(page: Page, title: string | RegExp) {
  const opened = dialog(page, title);
  await expect(opened).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.keyboard.press("Escape");
  await expect(opened).toBeHidden();
}

async function openMenuItem(page: Page, menu: Locator, item: string | RegExp) {
  await menu.click();
  await page.getByRole("button", { name: item }).click();
}

test.describe("okna správce", () => {
  test.use({ storageState: authFile("spravce") });

  test("Přidat akci", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await page.getByRole("button", { name: "Přidat akci" }).click();
    await checkDialog(page, "Přidat akci");
  });

  test("Připravit měsíc", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await page.getByRole("button", { name: /^Připravit měsíc/ }).click();
    await checkDialog(page, /Připravit měsíc:/);
  });

  // Bez zápisu do databáze: e2e projekty běží souběžně nad jedním serverem.
  test("Připravit měsíc: kroky, sloupce, mezery a uložení bez změn @desktop", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await page.getByRole("button", { name: /^Připravit měsíc/ }).click();
    const prepare = dialog(page, /Připravit měsíc:/);
    // Tři kroky v pořadí, bez diagnostiky Kalendáře.
    await expect(prepare.getByRole("heading", { level: 3 })).toHaveText(["1. Doplnit termíny", "2. Zkontrolovat", "3. Zveřejnit"]);
    await expect(prepare.getByRole("button", { name: "Doplnit chybějící termíny" })).toBeVisible();
    await expect(prepare.getByText(/Párování|spárováno/)).toHaveCount(0);

    const date = prepare.getByLabel(/^Datum: /).first();
    const value = await date.inputValue();
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await date.getAttribute("min")).toBeTruthy();
    expect((await date.getAttribute("max"))?.slice(0, 7)).toBe(value.slice(0, 7));
    await expect(prepare.getByLabel(/^Skupina: /).first()).toBeVisible();

    // Mezery se počítají živě z rozepsaného formuláře.
    const id = (await date.getAttribute("name"))!.replace("date-", "");
    const topic = prepare.locator(`[name="topic-${id}"]`);
    const gap = prepare.locator(`.publish-row[data-draft="${id}"] .publish-gap`);
    await topic.fill("");
    await expect(gap).toContainText("téma");
    await topic.fill("Téma z e2e testu");
    await expect(gap.filter({ hasText: "téma" })).toHaveCount(0);

    // Vrátit původní hodnotu a uložit: bez změny server nic nezapíše a okno zůstane otevřené.
    await page.reload();
    await settle(page);
    await page.getByRole("button", { name: /^Připravit měsíc/ }).click();
    await prepare.getByRole("button", { name: "Uložit změny" }).click();
    await expect(prepare.getByText("Žádné změny k uložení.")).toBeVisible();
    await expect(prepare.getByRole("button", { name: /^Zveřejnit/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("Připravit měsíc: Enter v poli nic nezveřejní @desktop", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await page.getByRole("button", { name: /^Připravit měsíc/ }).click();
    const prepare = dialog(page, /Připravit měsíc:/);
    const topic = prepare.getByLabel(/^Téma: /).first();
    await topic.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await expect(prepare).toBeVisible();
    await expect(prepare.getByText(/Zveřejněno|Nic se nezveřejnilo/)).toHaveCount(0);
  });

  test("Uložený návrh akce potvrdí, co se stalo, i po zavření okna @desktop", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await page.getByRole("button", { name: "Přidat akci" }).click();
    const opened = dialog(page, "Přidat akci");
    await opened.getByLabel("Typ").selectOption("other");
    await opened.getByLabel("Název akce", { exact: true }).fill("Návštěva partnera z e2e");
    await opened.getByLabel("Datum").fill("2027-06-15");
    await opened.getByRole("button", { name: "Uložit jako návrh" }).click();
    // Nová akce se ukáže v Plánu v měsíci, kam patří. Žádná mezistránka.
    await page.waitForURL(/\/vzdelavani\/harmonogram\?mesic=2027-06/);
    await expect(opened).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Návrh je uložený. Kolegové ho zatím nevidí, nic se neodeslalo." })).toBeVisible();
  });

  test("Vybrat návrhy: otevřít, výběr a zavřít bez změn", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await page.getByRole("button", { name: "Vybrat návrhy" }).click();
    const picker = dialog(page, /^Návrhy: /);
    await expect(picker.getByText("Vybráno: 0")).toBeVisible();
    await expect(picker.getByRole("button", { name: "Smazat vybrané" })).toBeDisabled();
    await picker.getByRole("checkbox", { name: /^Vybrat vše/ }).check();
    await expect(picker.getByRole("button", { name: "Zveřejnit vybrané" })).toBeEnabled();
    // První krok jen ptá, nic neodešle.
    await picker.getByRole("button", { name: "Zveřejnit vybrané" }).click();
    await expect(picker.getByRole("alertdialog")).toContainText(/Zveřejnit \d+ návrh/);
    await picker.getByRole("button", { name: "Zpět" }).click();
    await expect(picker.getByRole("alertdialog")).toHaveCount(0);
    await expect(picker.getByRole("button", { name: "Zveřejnit vybrané" })).toBeFocused();
    // Výběr není rozepsaná práce: Esc zavře okno bez otázky.
    await checkDialog(page, /^Návrhy: /);
  });

  test("Vybrat návrhy: smazání vybraného návrhu s potvrzením", async ({ page }, testInfo) => {
    // Zápis do sdílených dat ukázky jen v jednom projektu. Návrh si test založí sám ve vzdáleném měsíci.
    test.skip(testInfo.project.name !== "windows-1280", "zápis jen jednou");
    const label = `Hromadné smazání e2e ${Date.now()}`;
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await page.getByRole("button", { name: "Přidat akci" }).click();
    const add = dialog(page, "Přidat akci");
    await add.getByLabel("Typ").selectOption("other");
    await add.getByLabel("Název akce", { exact: true }).fill(label);
    await add.getByLabel("Datum").fill("2027-09-14");
    await add.getByRole("button", { name: "Uložit jako návrh" }).click();
    await page.waitForURL(/mesic=2027-09/);
    await settle(page);

    await page.getByRole("button", { name: "Vybrat návrhy" }).click();
    const picker = dialog(page, /Návrhy: září 2027/i);
    await picker.getByRole("checkbox", { name: new RegExp(label) }).check();
    await expect(picker.getByText("Vybráno: 1")).toBeVisible();
    await picker.getByRole("button", { name: "Smazat vybrané" }).click();
    await expect(picker.getByRole("alertdialog")).toContainText("Smazat 1 návrh?");
    await picker.getByRole("button", { name: "Potvrdit smazání" }).click();
    await expect(picker).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: /Smazán/ })).toBeVisible();
    await expect(page.getByText(label)).toHaveCount(0);
  });

  test("Pravidelný týden z Nástrojů správce", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await openMenuItem(page, page.getByRole("button", { name: "Nástroje správce" }), "Pravidelný týden");
    await checkDialog(page, "Pravidelný týden");
  });

  test("Upravit akci z detailu otevře okno akce v Plánu", async ({ page }) => {
    await page.goto("/vzdelavani/akce/ev-11-5");
    await settle(page);
    await page.getByRole("link", { name: "Upravit akci", exact: true }).click();
    await expect(page).toHaveURL(/harmonogram\?mesic=2026-11&akce=ev-11-5/);
    const win = dialog(page, "Setkání týmu");
    await expect(win).toBeVisible();
    // Proběhlá akce: údaje jdou opravit, termín zůstává.
    await expect(win.getByLabel("Datum", { exact: true })).toHaveAttribute("readonly", "");
    await expect(win.getByRole("button", { name: "Zveřejnit změny" })).toBeDisabled();
    await expect(win.getByText("Podrobnosti akce")).toHaveCount(0);
    await checkDialog(page, "Setkání týmu");
  });

  test("Zrušit akci z Dalších možností", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?akce=ev-11-5");
    await settle(page);
    await openMenuItem(page, dialog(page, "Setkání týmu").getByRole("button", { name: "Další možnosti", exact: true }), "Zrušit akci…");
    await checkDialog(page, "Zrušit akci");
  });

  test("Nedokončené zápisy s odpovědnou osobou", async ({ page }) => {
    await page.goto("/vzdelavani/zapisy");
    await settle(page);
    await page.getByRole("link", { name: /Nedokončené zápisy/ }).click();
    const picker = dialog(page, "Nedokončené zápisy");
    await expect(picker).toBeVisible();
    await expect(picker.getByText(/Odpovědný: /).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/vzdelavani\/zapisy$/);
  });

  test("Správa: Přidat přístup a menu účtu", async ({ page }) => {
    await page.goto("/sprava");
    await settle(page);
    await page.getByRole("button", { name: "Přidat přístup" }).click();
    await checkDialog(page, /./);
    await page.getByRole("button", { name: /Možnosti účtu Vedoucí akce/ }).click();
    await expectNoHorizontalScroll(page);
    await page.keyboard.press("Escape");
  });
});

for (const role of Object.keys(ROLES) as Role[]) {
  test.describe(`okna a odkazy: ${ROLES[role]}`, () => {
    test.use({ storageState: authFile(role) });

    test("náhled akce z Plánu", async ({ page }) => {
      await page.goto("/vzdelavani/harmonogram?mesic=2026-11&pohled=seznam");
      await settle(page);
      await page.getByRole("link", { name: /Setkání týmu/ }).first().click();
      await expect(dialog(page, "Setkání týmu")).toBeVisible();
      await expectNoHorizontalScroll(page);
      await page.keyboard.press("Escape");
      await expect(page).not.toHaveURL(/akce=/);
      await expect(page).toHaveURL(/pohled=seznam/);
    });

    test("neplatné ?akce= zachová měsíc a pohled", async ({ page }) => {
      await page.goto("/vzdelavani/harmonogram?mesic=2026-12&pohled=seznam&akce=neexistuje");
      await settle(page);
      const opened = dialog(page, "Akce není dostupná");
      await expect(opened).toBeVisible();
      await expectNoHorizontalScroll(page);
      await opened.getByRole("button", { name: "Zpět na plán" }).click();
      await expect(page).toHaveURL(/mesic=2026-12/);
      await expect(page).toHaveURL(/pohled=seznam/);
      await expect(page).not.toHaveURL(/akce=/);
    });

    test("neplatné ?zapis=", async ({ page }) => {
      await page.goto("/vzdelavani/zapisy?zapis=neexistuje");
      await settle(page);
      await expect(dialog(page, "Zápis není dostupný")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page).not.toHaveURL(/zapis=/);
    });

    test("menu tématu", async ({ page }) => {
      await page.goto("/vzdelavani/temata");
      await settle(page);
      const trigger = page.getByRole("button", { name: /Možnosti tématu/ }).first();
      // Člen týmu menu u témat nemá (jen „Mám zájem“), stačí ověřit tlačítko zájmu.
      if ((await trigger.count()) === 0) {
        await expect(page.getByRole("button", { name: /zájem/i }).first()).toBeVisible();
        return;
      }
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expectNoHorizontalScroll(page);
      await page.keyboard.press("Escape");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  });
}

test.describe("cizí akce neprozradí obsah", () => {
  test.use({ storageState: authFile("ucastnikFp") });

  test("akce RM v náhledu vypadá jako neexistující", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?akce=tr-rm-1112");
    await settle(page);
    const opened = dialog(page, "Akce není dostupná");
    await expect(opened).toBeVisible();
    await expect(opened).not.toContainText("Rozbor");
    await page.goto("/vzdelavani/zapisy?zapis=tr-rm-1112");
    await expect(dialog(page, "Zápis není dostupný")).toBeVisible();
  });
});
