import { LIVE_PORT } from "./constants.mjs";
import { expect, expectNoHorizontalScroll, settle, test } from "./support";

// Ostrá Wiki (WIKI_MODE=production) s falešnými hodnotami Google. Google se nevolá, ověřuje se jen
// to, co se stane před ním: vstup, soukromí a přesměrování.
const live = `http://localhost:${LIVE_PORT}`;

test.describe("ostrá Wiki", () => {
  test("vstup bez pozvánky: žádné role ukázky ani kód", async ({ page }) => {
    await page.goto(`${live}/vstup`);
    await settle(page);
    await expect(page.locator("label.persona")).toHaveCount(0);
    await expect(page.locator("input[name=code]")).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test("vstup správce nabídne přihlášení Googlem", async ({ page }) => {
    await page.goto(`${live}/vstup?spravce=1`);
    await settle(page);
    await expect(page.getByRole("link", { name: /Google/ }).or(page.getByRole("button", { name: /Google/ })).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("ochrana soukromí je veřejná a běží bez chyb", async ({ page }) => {
    const response = await page.goto(`${live}/soukromi`);
    expect(response?.status()).toBe(200);
    await settle(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ochrana soukromí");
    await expectNoHorizontalScroll(page);
  });

  test("chráněné stránky přesměrují na vstup", async ({ page }) => {
    for (const path of ["/", "/vzdelavani/harmonogram", "/vzdelavani/akce/ev-11-5", "/sprava", "/vzdelavani/integrace"]) {
      await page.goto(`${live}${path}`);
      await expect(page, path).toHaveURL(/\/vstup/);
    }
  });

  test("přihlášení Googlem bez zařízení vede zpět na vstup", async ({ request }) => {
    const response = await request.get(`${live}/api/google/prihlaseni`, { maxRedirects: 0 });
    expect([302, 303, 307]).toContain(response.status());
    expect(response.headers().location).toContain("/vstup");
  });

  test("neplatný odkaz pozvánky nezaloží zařízení ani cookie pozvánky", async ({ request }) => {
    const response = await request.post(`${live}/api/pozvanka`, {
      headers: { origin: live, "content-type": "application/json" },
      data: { token: "A".repeat(43) },
    });
    expect(response.status()).toBe(400);
    const cookies = response.headers()["set-cookie"] ?? "";
    expect(cookies).not.toContain("zbc_device");
    expect(cookies).not.toContain("zbc_invite");
  });

  test("ukázkový vstup nejde obejít ani přes formulář", async ({ request }) => {
    const response = await request.get(`${live}/vstup/pozvanka?pozvanka=e2e-pristupovy-kod`, { maxRedirects: 0 });
    expect(response.headers()["set-cookie"] ?? "").not.toContain("zbc_gate");
  });
});
