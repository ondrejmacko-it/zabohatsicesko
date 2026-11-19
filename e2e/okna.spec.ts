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

  test("Vybrat návrhy: checkboxy přímo v Plánu, klik kartu označí a Zpět nic neodešle", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await page.getByRole("button", { name: "Vybrat návrhy" }).click();
    const bar = page.getByRole("region", { name: "Hromadný výběr návrhů" });
    await expect(bar).toContainText("Vybráno 0");
    await expect(bar.getByRole("button", { name: "Smazat vybrané" })).toBeDisabled();
    // Klik na kartu návrhu ji označí místo otevření okna.
    await page.locator("a[data-pick-id]:visible").first().click();
    await expect(page).not.toHaveURL(/akce=/);
    await expect(bar).toContainText("Vybráno 1");
    // Klávesnice: mezerník na checkboxu.
    await page.locator("input.pick-box:visible").nth(1).focus();
    await page.keyboard.press("Space");
    await expect(bar).toContainText("Vybráno 2");
    // První krok jen ptá v samostatném okně, nic neodešle. Lišta výběru pod ním zůstane beze změny.
    await bar.getByRole("button", { name: "Zveřejnit vybrané" }).click();
    const ask = page.getByRole("dialog", { name: /Zveřejnit \d+ akc/ });
    await expect(ask).toBeVisible();
    await expect(ask.getByRole("button", { name: "Zpět" })).toBeFocused();
    await ask.getByRole("button", { name: "Zpět" }).click();
    await expect(ask).toHaveCount(0);
    await expect(bar).toContainText("Vybráno 2");
    await expect(bar.getByRole("button", { name: "Zveřejnit vybrané" })).toBeFocused();
    // Esc v potvrzení zavře jen potvrzení, výběr zůstane.
    await bar.getByRole("button", { name: "Zveřejnit vybrané" }).click();
    await expect(ask).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(ask).toHaveCount(0);
    await expect(bar).toContainText("Vybráno 2");
    // Esc výběr ukončí, nic se nezměnilo.
    await page.keyboard.press("Escape");
    await expect(bar).toHaveCount(0);
    await expect(page.locator("input.pick-box")).toHaveCount(0);
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
    await page.getByRole("checkbox", { name: `Vybrat: ${label}` }).filter({ visible: true }).check();
    const bar = page.getByRole("region", { name: "Hromadný výběr návrhů" });
    await expect(bar).toContainText("Vybráno 1");
    await bar.getByRole("button", { name: "Smazat vybrané" }).click();
    const ask = page.getByRole("alertdialog", { name: "Smazat 1 návrh?" });
    await expect(ask).toContainText("Nic se neodešle a nejde to vrátit.");
    await ask.getByRole("button", { name: "Potvrdit smazání" }).click();
    await expect(bar).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: /Smazán/ })).toBeVisible();
    await expect(page.getByText(label)).toHaveCount(0);
  });

  test("Nastavit pravidelný rozvrh z okna Připravit měsíc", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await page.getByRole("button", { name: /^Připravit měsíc/ }).click();
    await dialog(page, /^Připravit měsíc/).getByRole("button", { name: "Nastavit pravidelný rozvrh" }).click();
    await expect(dialog(page, "Nastavit pravidelný rozvrh")).toBeVisible();
    await expect(dialog(page, "Nastavit pravidelný rozvrh")).toContainText("Podle nich se připraví návrhy na měsíc");
  });

  // Bez zápisu: potvrzení se jen otevře a vrátí zpět. Rozhodnutí je samostatné okno nad formulářem, ne lišta v něm.
  test("Zveřejnit bez tématu a vedoucího: samostatné potvrzení, Zpět k úpravám nic nezmění", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await page.getByRole("button", { name: "Přidat akci" }).click();
    const add = dialog(page, "Přidat akci");
    await add.getByLabel("Typ").selectOption({ label: "Portfolio tým" });
    await add.getByLabel("Datum").fill("2027-09-15");
    await add.getByRole("button", { name: "Zveřejnit", exact: true }).click();
    const ask = page.getByRole("dialog", { name: "Zveřejnit bez tématu a vedoucího?" });
    await expect(ask).toContainText("Kolegové uvidí obecný název");
    await expect(ask.getByRole("button", { name: "Zpět k úpravám" })).toBeFocused();
    await expectNoHorizontalScroll(page);
    await ask.getByRole("button", { name: "Zpět k úpravám" }).click();
    await expect(ask).toHaveCount(0);
    await expect(add).toBeVisible();
    await expect(add.getByLabel("Datum")).toHaveValue("2027-09-15");
    await expect(add.getByRole("button", { name: "Zveřejnit", exact: true })).toBeFocused();
    // Esc zavře jen potvrzení, okno akce zůstane otevřené.
    await add.getByRole("button", { name: "Zveřejnit", exact: true }).click();
    await expect(ask).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(ask).toHaveCount(0);
    await expect(add).toBeVisible();
  });

  test("Zveřejnit změny termínu: dopad v samostatném potvrzení @desktop", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?akce=ev-11-18");
    await settle(page);
    const win = dialog(page, "Portfolio tým");
    await expect(win).toBeVisible();
    // A-07, A-13: bez změny patička jen oznámí „Beze změn“, Zveřejnit změny není primární ani aktivní.
    const publish = win.getByRole("button", { name: "Zveřejnit změny" });
    await expect(win.getByText("Beze změn", { exact: true })).toBeVisible();
    await expect(publish).toBeDisabled();
    await expect(publish).not.toHaveClass(/btn-primary/);
    await win.getByLabel("Od", { exact: true }).fill("09:00");
    await expect(win.getByText("Beze změn", { exact: true })).toHaveCount(0);
    await expect(publish).toHaveClass(/btn-primary/);
    await publish.click();
    const ask = page.getByRole("dialog", { name: "Zveřejnit změny?" });
    await expect(ask).toContainText("Změníte termín");
    await expect(ask.getByRole("button", { name: "Potvrdit zveřejnění" })).toBeVisible();
    await ask.getByRole("button", { name: "Zpět k úpravám" }).click();
    await expect(ask).toHaveCount(0);
    await expect(win.getByLabel(/^Od/)).toHaveValue("09:00");
    await expect(win.getByRole("button", { name: "Zveřejnit změny" })).toBeFocused();
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

  test("Zápisy k dokončení s odpovědnou osobou", async ({ page }) => {
    await page.goto("/vzdelavani/zapisy");
    await settle(page);
    await page.getByRole("link", { name: /Zápisy k dokončení/ }).click();
    const picker = dialog(page, "Zápisy k dokončení");
    await expect(picker).toBeVisible();
    await expect(picker.getByText(/Vede: |Vedoucí neurčen/).first()).toBeVisible();
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
    // Pořadí položek: úprava přístupu nahoře, odebrání dole za oddělovačem.
    const items = page.locator(".menu-list:not([hidden]) .btn");
    await expect(items.first()).toHaveText("Upravit přístup…");
    await expect(items.last()).toHaveText("Odebrat přístup…");
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

test.describe("nabídka tématu v okně akce", () => {
  test.use({ storageState: authFile("spravce") });

  // Bez zápisu. Combobox: skupiny, filtr bez diakritiky, šipky + Enter, Esc zavře jen nabídku, ruční text platí.
  test("garantovaná a doporučená nahoře, klávesnice i ruční text", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await page.getByRole("button", { name: "Přidat akci" }).click();
    const add = dialog(page, "Přidat akci");
    const topic = add.getByRole("combobox", { name: /^Téma/ });
    await topic.click();
    const list = add.getByRole("listbox", { name: "Nabídka témat" });
    await expect(list).toBeVisible();
    await expect(topic).toHaveAttribute("aria-expanded", "true");
    const groups = list.getByRole("group");
    await expect(groups.first()).toHaveAccessibleName(/^Doporučená pro /);
    await expect(groups.first().getByRole("option").first()).toContainText(/Garantované|Doporučené/);
    await expectNoHorizontalScroll(page);
    // Esc zavře jen nabídku, okno zůstane.
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
    await expect(add).toBeVisible();
    // Psaní filtruje bez ohledu na diakritiku, šipka a Enter vyberou, formulář se neodešle.
    await topic.fill("uvodni");
    await expect(list.getByRole("option").first()).toContainText(/úvodní/i);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(list).toBeHidden();
    await expect(topic).toHaveValue(/úvodní/i);
    await expect(add).toBeVisible();
    // Klik na možnost.
    await topic.fill("");
    await topic.click();
    const first = list.getByRole("option").first();
    const name = (await first.locator(".combobox-option-name").textContent()) ?? "";
    await first.click();
    await expect(topic).toHaveValue(name);
    // Ruční text: nabídka se schová, hodnota zůstane.
    await topic.fill("Úplně nové téma e2e");
    await expect(list).toBeHidden();
    await expect(topic).toHaveAttribute("aria-expanded", "false");
    await expect(topic).toHaveValue("Úplně nové téma e2e");
  });
});

test.describe("technické informace jen pro správu", () => {
  // A-10: stav Kalendáře a technické údaje vidí jen správce, vedoucí ani účastník je nedostanou.
  for (const role of ["vedouci", "ucastnikRm"] as const) {
    test.describe(role, () => {
      test.use({ storageState: authFile(role) });
      test("okno ani detail akce technické informace neukazují", async ({ page }) => {
        await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=tr-rm-1112");
        await settle(page);
        await expect(page.getByRole("dialog").first()).toBeVisible();
        await expect(page.getByText("Technické informace")).toHaveCount(0);
        await page.goto("/vzdelavani/akce/tr-rm-1112");
        await settle(page);
        await expect(page.getByRole("heading", { name: /Vzdělávání/ })).toBeVisible();
        await expect(page.getByText("Technické informace")).toHaveCount(0);
        await expect(page.getByText(/Kalendář/).filter({ hasText: /synchroniz|ID události|Google/ })).toHaveCount(0);
      });
    });
  }

  test.describe("správce", () => {
    test.use({ storageState: authFile("spravce") });
    test("detail akce technické informace má", async ({ page }) => {
      await page.goto("/vzdelavani/akce/tr-rm-1112");
      await settle(page);
      await expect(page.getByText("Technické informace").first()).toBeVisible();
    });

    test("nabídka okna akce: každá položka s ikonou, destruktivní pod čarou (A-09)", async ({ page }) => {
      await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-18");
      await settle(page);
      const win = page.getByRole("dialog").first();
      await win.getByRole("button", { name: "Další možnosti" }).click();
      const list = win.locator(".menu-list:not([hidden])");
      const items = list.locator(":scope > .btn, :scope > a, form .btn");
      const count = await items.count();
      expect(count).toBeGreaterThan(1);
      for (let i = 0; i < count; i++) await expect(items.nth(i).locator("svg")).toHaveCount(1);
      await expect(list.getByRole("link", { name: "Technické informace" })).toBeVisible();
      // Zrušení akce je až za oddělovačem, na konci nabídky.
      await expect(list.locator(".menu-divider + .menu-danger")).toContainText("Zrušit akci");
    });
  });
});
