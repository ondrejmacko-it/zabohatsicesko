import type { Locator } from "@playwright/test";
import { authFile, chooseOption, expect, settle, test } from "./support";

/** Textové řádky dvou různých karet se nesmí překrývat (dřív se přes návrh změny kreslila zveřejněná verze). */
async function expectNoTextOverlap(cards: Locator) {
  const boxes = await cards.evaluateAll((links) =>
    links.flatMap((link, card) =>
      [...link.querySelectorAll("span")]
        .filter((span) => span.children.length === 0 && span.textContent?.trim())
        .map((span) => {
          const r = span.getBoundingClientRect();
          return { card, text: span.textContent!.trim(), x: r.x, y: r.y, w: r.width, h: r.height };
        }),
    ),
  );
  for (const a of boxes) {
    for (const b of boxes) {
      if (a.card >= b.card || !a.w || !b.w) continue;
      const overlap = a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
      expect(overlap, `„${a.text}“ překrývá „${b.text}“`).toBe(false);
    }
  }
}

test.describe("Plán: hromadný výběr návrhů s návrhem změny zveřejněné akce @desktop @zapis-temat", () => {
  test.use({ storageState: authFile("spravce") });

  test("karty zůstanou čitelné, klik dělá jednu věc a zrušení výběru vrátí běžné chování", async ({ page }, info) => {
    // Mění sdílenou akci ev-11-26 (jako test v priprava-mesice), proto běží v sériovém projektu zápisů po ostatních.
    test.skip(info.project.name !== "zapis-temat", "Zapisuje do sdílených dat ukázky, běží jen v projektu zápisů.");
    // 1. Návrh změny zveřejněné akce (vedoucí).
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-26");
    await settle(page);
    const window = page.getByRole("dialog").filter({ has: page.getByLabel(/^Vede/) });
    await chooseOption(window, /^Vede/, { label: "Správce ZBC ukázky" });
    await window.getByRole("button", { name: "Uložit jako návrh" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Návrh změny je uložený" })).toBeVisible();

    try {
      await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
      await settle(page);
      const changeCard = page.locator('a[data-move-id="ev-11-26"]');
      await expect(changeCard).toContainText("Návrh změny");

      // 2. Režim výběru: karty mají plnou neprůhlednost a texty se nepřekrývají.
      await page.getByRole("button", { name: "Vybrat návrhy" }).click();
      const bar = page.getByRole("region", { name: "Hromadný výběr návrhů" });
      await expect(bar).toBeVisible();
      // Zveřejněná verze ve stohu leží pod kartou návrhu záměrně (vykukuje jen pruh), překryv se u ní nekontroluje.
      const cards = page.locator("table a[data-pick-id], table a[data-pick-reason]:not([data-original-of])");
      for (const card of await cards.all()) await expect(card).toHaveCSS("opacity", "1");
      await expectNoTextOverlap(cards);

      // 3. Klik na návrh změny (nejde vybrat) okno neotevře, jen řekne proč.
      await changeCard.click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page).not.toHaveURL(/akce=/);
      await expect(bar.getByTestId("duvod-vyberu")).toHaveText("Návrh změny zveřejněné akce se zveřejňuje v okně akce.");

      // 4. Klik na vybíratelný návrh ho označí (checkbox i rámeček), okno se neotevře.
      const pickable = page.locator("table a[data-pick-id]").first();
      const id = await pickable.getAttribute("data-pick-id");
      await pickable.click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator(`table a[data-pick-id="${id}"] ~ .pick-box`)).toBeChecked();
      await expect(bar).toContainText("Vybráno 1");
      await expect(bar.getByRole("button", { name: "Smazat vybrané" })).toBeEnabled();
      // Klávesnice: mezerník na checkboxu výběr zruší.
      await page.locator(`table a[data-pick-id="${id}"] ~ .pick-box`).focus();
      await page.keyboard.press("Space");
      await expect(bar).toContainText("Vybráno 0");

      // 5. Lišta je celá ve viewportu a nepřesahuje šířku obsahu.
      const barBox = (await bar.boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(barBox.x).toBeGreaterThanOrEqual(0);
      expect(barBox.x + barBox.width).toBeLessThanOrEqual(viewport.width);

      // 6. Zrušení výběru: lišta zmizí a klik na kartu zase otevře okno akce.
      await bar.getByRole("button", { name: "Zrušit výběr" }).click();
      await expect(bar).toBeHidden();
      await expect(page.locator("[data-selecting]")).toHaveCount(0);
      await changeCard.click();
      await expect(page).toHaveURL(/akce=ev-11-26/);
      await expect(page.getByRole("dialog").getByText(/Mění vedoucí\./)).toBeVisible();
    } finally {
      // Úklid: zrušit návrh změny, ať ostatní testy vidí seed.
      await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-26");
      await settle(page);
      const editor = page.getByRole("dialog").filter({ has: page.getByLabel(/^Vede/) });
      await editor.getByRole("button", { name: "Zrušit návrh" }).click();
      const confirm = page.getByRole("dialog", { name: "Zrušit návrh změny?" });
      await confirm.getByRole("button", { name: "Zrušit návrh" }).click();
      await expect(confirm).toBeHidden();
    }
  });
});
