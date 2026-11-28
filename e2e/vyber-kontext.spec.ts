import type { Page } from "@playwright/test";
import { authFile, chooseOption, expect, settle, test } from "./support";

const bar = (page: Page) => page.getByRole("region", { name: "Hromadný výběr návrhů" });

async function pickFirst(page: Page) {
  await page.getByRole("button", { name: "Vybrat návrhy" }).click();
  await page.locator("a[data-pick-id]:visible").first().click();
  await expect(bar(page)).toContainText(/Vybráno 1 z \d+ nov(ého návrhu|ých návrhů)/);
}

test.describe("Plán: výběr návrhů drží jen v jednom kontextu", () => {
  test.use({ storageState: authFile("spravce") });

  test("pohled výběr zachová, filtr, měsíc, obnovení stránky a Esc ho zruší @desktop", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
    await settle(page);
    await pickFirst(page);
    await expect(bar(page).getByTestId("rozpad-vyberu")).toContainText("Zveřejnit jde");

    // Měsíc ↔ Seznam ukazují stejné karty, výběr zůstane.
    await page.getByRole("link", { name: "Seznam" }).click();
    await expect(page).toHaveURL(/pohled=seznam/);
    await expect(bar(page)).toContainText("Vybráno 1");
    await page.getByRole("link", { name: "Měsíc", exact: true }).click();
    await expect(page).not.toHaveURL(/pohled=/);
    await expect(bar(page)).toContainText("Vybráno 1");

    // Jiný filtr = jiné karty, výběr se zruší (nic skrytého nezůstane vybrané).
    await page.getByRole("navigation", { name: "Účast v harmonogramu" }).getByRole("link", { name: "Dobrovolné" }).click();
    await expect(page).toHaveURL(/ucast=dobrovolne/);
    await expect(bar(page)).toHaveCount(0);

    // Jiný měsíc.
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
    await settle(page);
    await pickFirst(page);
    await page.getByRole("link", { name: "Další měsíc" }).click();
    await expect(page).toHaveURL(/mesic=2026-12/);
    await expect(bar(page)).toHaveCount(0);

    // Obnovení stránky.
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
    await settle(page);
    await pickFirst(page);
    await page.reload();
    await settle(page);
    await expect(bar(page)).toHaveCount(0);

    // Esc.
    await pickFirst(page);
    await page.keyboard.press("Escape");
    await expect(bar(page)).toHaveCount(0);
  });

  test("na telefonu lišta nepřekryje poslední kartu ani tlačítko hlášení chyby", async ({ page }, info) => {
    test.skip(info.project.name !== "telefon-390", "Rozložení stačí ověřit na 390 px.");
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&pohled=seznam");
    await settle(page);
    await pickFirst(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    const barBox = (await bar(page).boundingBox())!;
    const cards = page.locator("a[data-pick-id]:visible, a[data-pick-reason]:visible");
    const last = (await cards.last().boundingBox())!;
    expect(last.y + last.height, "poslední karta končí nad lištou").toBeLessThanOrEqual(barBox.y + 1);
    const dock = page.locator(".bug-dock");
    if (await dock.isVisible()) {
      const d = (await dock.boundingBox())!;
      const overlap = d.x < barBox.x + barBox.width && barBox.x < d.x + d.width && d.y < barBox.y + barBox.height && barBox.y < d.y + d.height;
      expect(overlap, ".bug-dock překrývá lištu výběru").toBe(false);
    }
  });

  test("souběžná změna vybraného návrhu: smazání ho vynechá a výběr ho vyřadí @desktop @zapis-temat", async ({ page, context }, info) => {
    test.skip(info.project.name !== "zapis-temat", "Zapisuje do sdílených dat ukázky, běží jen v projektu zápisů.");
    const title = "Souběh výběru e2e";
    const other = await context.newPage();
    // Vlastní návrh v prázdném měsíci, ať test nemění sdílená data jiných testů.
    await other.goto("/vzdelavani/harmonogram?mesic=2027-09");
    await settle(other);
    await other.getByRole("button", { name: "Přidat akci" }).click();
    const add = other.getByRole("dialog", { name: "Přidat akci" });
    await chooseOption(add, "Typ", { value: "other" });
    await add.getByLabel("Název akce", { exact: true }).fill(title);
    await add.getByLabel("Datum").fill("2027-09-14");
    await add.getByRole("button", { name: "Uložit jako návrh" }).click();
    await other.waitForURL(/mesic=2027-09/);
    await expect(add).toBeHidden();

    await page.goto("/vzdelavani/harmonogram?mesic=2027-09&pohled=seznam");
    await settle(page);
    await page.getByRole("button", { name: "Vybrat návrhy" }).click();
    const card = page.locator("a[data-pick-id]:visible").filter({ hasText: title });
    await card.click();
    await expect(bar(page)).toContainText("Vybráno 1");

    // Jiná karta prohlížeče návrh mezitím upraví.
    await other.goto("/vzdelavani/harmonogram?mesic=2027-09&pohled=seznam");
    await settle(other);
    await other.locator("a[data-pick-id]").filter({ hasText: title }).click();
    await other.getByRole("dialog").getByRole("link", { name: "Upravit akci" }).click();
    const edit = other.getByRole("dialog").filter({ has: other.getByLabel("Název akce", { exact: true }) });
    await edit.getByLabel("Název akce", { exact: true }).fill(`${title} 2`);
    await edit.getByRole("button", { name: "Uložit jako návrh" }).click();
    await expect(edit).toBeHidden();

    await bar(page).getByRole("button", { name: "Smazat vybrané" }).click();
    await page.getByRole("alertdialog", { name: /Smazat 1 návrh/ }).getByRole("button", { name: "Potvrdit smazání" }).click();
    await expect(bar(page)).toContainText("mezitím někdo změnil");
    await expect(bar(page).getByTestId("duvod-vyberu")).toHaveText("1 vybraný návrh se mezitím změnil, z výběru zmizel.");
    await expect(bar(page)).toContainText("Vybráno 0");

    // Úklid: novou verzi jde vybrat a smazat.
    await page.locator("a[data-pick-id]:visible").filter({ hasText: `${title} 2` }).click();
    await bar(page).getByRole("button", { name: "Smazat vybrané" }).click();
    await page.getByRole("alertdialog", { name: /Smazat 1 návrh/ }).getByRole("button", { name: "Potvrdit smazání" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Smazáno: 1" })).toBeVisible();
    await expect(page.locator("a[data-pick-id]").filter({ hasText: title })).toHaveCount(0);
  });
});
