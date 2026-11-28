import { authFile, expect, settle, test } from "./support";

// Screenshot vlastníka 27. 11. 2026 (Android 347 px): pole Téma v okně akce mělo jen 80 % šířky okna
// (okraj těla 16 + rámeček formuláře 16 px) a dlouhý název tématu se nevešel.
test.use({ storageState: authFile("spravce") });

for (const width of [320, 347]) {
  test(`telefon ${width} px: pole Téma v okně akce má skoro celou šířku těla okna`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "telefon-390",
      "šířky prochází jeden telefonní projekt",
    );
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&akce=ev-11-26&upravit=1");
    await settle(page);
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: /^Téma/ })).toBeVisible();
    const topicId = await dialog
      .getByRole("combobox", { name: /^Téma/ })
      .getAttribute("id");
    const sizes = await dialog.evaluate((el, id) => {
      const body = el.querySelector(".dialog-body") as HTMLElement;
      const topic = el.ownerDocument.getElementById(id!) as HTMLElement;
      const head = el.querySelector(".dialog-head") as HTMLElement | null;
      return {
        body: body.clientWidth,
        bodyScroll: body.scrollWidth,
        topic: topic.getBoundingClientRect().width,
        head: head ? head.getBoundingClientRect().width : body.clientWidth,
      };
    }, topicId);
    expect(sizes.topic).toBeGreaterThanOrEqual(sizes.body * 0.85);
    expect(sizes.bodyScroll).toBeLessThanOrEqual(sizes.body);
    // Hlavička okna dál sahá od kraje ke kraji.
    expect(sizes.head).toBeGreaterThanOrEqual(width - 1);
  });
}
