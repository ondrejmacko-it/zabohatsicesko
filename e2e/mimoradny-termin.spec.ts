import { authFile, expect, settle, test } from "./support";

// Screenshoty vlastníka 27. 11. 2026: „V pondělí se vzdělávání běžně nekoná“ svítilo červeně jako chyba.
// Mimořádný den je dovolený, upozornění má tón informace. Nic se neukládá.
test.use({ storageState: authFile("spravce") });

test("mimořádný den v okně akce je informace, ne chyba", async ({ page }) => {
  // Budoucí akce: proběhlé mají termín jen ke čtení.
  await page.goto("/vzdelavani/harmonogram?akce=ev-11-27");
  await settle(page);
  const dialog = page.locator("dialog[open]");
  await dialog.getByLabel("Datum", { exact: true }).fill("2026-11-23");
  const notice = dialog.locator(".notice", { hasText: "běžně nekoná" });
  await expect(notice).toBeVisible();
  await expect(notice).not.toHaveClass(/notice-danger/);
  await expect(notice).toHaveAttribute("role", "status");
});
