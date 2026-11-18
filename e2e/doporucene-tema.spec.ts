import type { Page } from "@playwright/test";
import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Vlastní měsíc, aby zápis nepotkal ostatní testy nad sdílenými daty ukázky.
const PLAN = "/vzdelavani/harmonogram?mesic=2027-01";

async function openPrepare(page: Page) {
  await page.goto(PLAN);
  await settle(page);
  await page.getByRole("button", { name: /^Připravit měsíc/ }).click();
  return page.getByRole("dialog", { name: /Připravit měsíc:/ });
}

const suggestedRows = (page: Page) => page.locator(".publish-row:has(.topic-suggestion)");

test.describe("doporučená témata při přípravě měsíce @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  test("Přijmout, Změnit, Odmítnout: rozhodnutí přežije obnovení i nové doplnění", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "windows-1280", "zápis jen jednou");
    let prepare = await openPrepare(page);
    await prepare.getByRole("button", { name: "Doplnit chybějící termíny" }).click();
    await expect(prepare.getByText(/předvyplněné doporučené téma/)).toBeVisible();
    await expect(suggestedRows(page).first()).toBeVisible();
    expect(await suggestedRows(page).count()).toBeGreaterThanOrEqual(3);
    await expect(suggestedRows(page).first().locator(".topic-suggestion")).toContainText(/✦ Doporučeno .+ · \d+ zájem/);

    // Telefon: doporučení i tlačítka se vejdou bez posunu do strany.
    const desktopSize = page.viewportSize()!;
    await page.setViewportSize({ width: 390, height: 760 });
    await expect(suggestedRows(page).first().getByRole("button", { name: /^Přijmout/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.setViewportSize(desktopSize);

    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await suggestedRows(page).nth(i).getAttribute("data-draft"))!);
    const row = (id: string) => prepare.locator(`.publish-row[data-draft="${id}"]`);
    const topic = (id: string) => row(id).locator(`[name="topic-${id}"]`);
    const accepted = await topic(ids[0]!).inputValue();

    // Přijmout: uloží se hned, téma zůstane, štítek zmizí, okno zůstane otevřené.
    await row(ids[0]!).getByRole("button", { name: /^Přijmout/ }).click();
    await expect(prepare.getByText(/Doporučené téma přijato.*nic se neodeslalo/)).toBeVisible();
    await expect(row(ids[0]!).locator(".topic-suggestion")).toHaveCount(0);
    await expect(topic(ids[0]!)).toHaveValue(accepted);
    await expect(topic(ids[0]!)).not.toHaveAttribute("data-suggested", /.*/);

    // Odmítnout: téma prázdné, řádek ukáže chybějící téma.
    await row(ids[1]!).getByRole("button", { name: /^Odmítnout/ }).click();
    await expect(prepare.getByText(/Doporučení odmítnuto/)).toBeVisible();
    await expect(topic(ids[1]!)).toHaveValue("");
    await expect(row(ids[1]!).locator(".publish-gap")).toContainText("téma");

    // Změnit: vyprázdní pole pro jiné nebo vlastní téma, uloží se běžným Uložit změny.
    await row(ids[2]!).getByRole("button", { name: /^Změnit/ }).click();
    await expect(topic(ids[2]!)).toBeFocused();
    await expect(row(ids[2]!).locator(".topic-suggestion")).toHaveCount(0);
    await topic(ids[2]!).fill("Vlastní téma z e2e");
    await prepare.getByRole("button", { name: "Uložit změny" }).click();
    await expect(prepare.getByText(/^Uloženo: /)).toBeVisible();

    // Po obnovení a novém doplnění zůstává vše rozhodnuté, odmítnuté se nevrací, nic se nezveřejnilo.
    await page.reload();
    prepare = await openPrepare(page);
    await prepare.getByRole("button", { name: "Doplnit chybějící termíny" }).click();
    await expect(prepare.getByText(/Nic nového k doplnění/)).toBeVisible();
    await expect(topic(ids[0]!)).toHaveValue(accepted);
    await expect(topic(ids[1]!)).toHaveValue("");
    await expect(topic(ids[2]!)).toHaveValue("Vlastní téma z e2e");
    for (const id of ids) await expect(row(id).locator(".topic-suggestion")).toHaveCount(0);
    await expect(prepare.getByRole("button", { name: /^Zveřejnit/ })).toBeVisible();

  });
});

test.describe("doporučená témata: účastník @desktop", () => {
  test.use({ storageState: authFile("ucastnikFp") });

  test("účastník nevidí návrhy ani interní doporučení", async ({ page }) => {
    await page.goto(PLAN);
    await settle(page);
    await expect(page.getByRole("button", { name: /^Připravit měsíc/ })).toHaveCount(0);
    await expect(page.getByText("✦ Doporučeno")).toHaveCount(0);
  });
});
