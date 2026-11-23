import { authFile, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Globální „Zobrazit jako“ v horní liště: správce vidí Domů, Plán, Témata a Zápisy očima skupiny, jen ke čtení.
// Náhled drží HttpOnly cookie `zbc_nahled` (`id účtu|klíč`), server ji při každém požadavku znovu ověří.

const bar = (page: import("@playwright/test").Page) => page.getByTestId("pruh-nahledu");
const cookie = (value: string) => ({ name: "zbc_nahled", value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" as const });

test.describe("správce: pohled skupiny", () => {
  test.use({ storageState: authFile("spravce") });

  test("pohled FP platí na Domů, Plánu, Tématech a Zápisech, jen ke čtení", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await expect(page.getByRole("button", { name: "Přidat akci" }).first()).toBeVisible();
    await page.getByLabel("Pohled").selectOption("skupina-fp");
    await expect(bar(page)).toContainText("jen ke čtení");
    await expect(bar(page)).toContainText("Finanční poradci");
    // Vrátí na stejnou stránku a bez ovládání správce.
    await expect(page).toHaveURL(/\/vzdelavani\/harmonogram/);
    await expect(page.getByRole("button", { name: "Přidat akci" })).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    await page.goto("/");
    await expect(bar(page)).toContainText("jen ke čtení");
    await expect(page.getByRole("heading", { name: "Nejbližší akce" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Čeká na tebe" })).toHaveCount(0);
    // F16: pozdrav nepatří správci a navigace odpovídá pohledu poradce (bez Správy systému).
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ahoj.");
    const nav = page.getByRole("complementary", { name: "Hlavní navigace" });
    await expect(nav.getByRole("link", { name: "Domů" })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Správa/ })).toHaveCount(0);

    await page.goto("/vzdelavani/temata");
    await expect(bar(page)).toContainText("jen ke čtení");
    await expect(page.locator(".topic-row").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Navrhnout téma" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Mám zájem/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Možnosti tématu/ }).or(page.locator(".topic-handle"))).toHaveCount(0);
    await expect(page.getByText(/Archivovaná témata/)).toHaveCount(0);

    await page.goto("/vzdelavani/zapisy");
    await expect(bar(page)).toContainText("jen ke čtení");
    await expect(page.getByRole("link", { name: /K dokončení/ })).toHaveCount(0);
    // Zápis akce RM skupina FP nevidí ani přímou adresou.
    await page.goto("/vzdelavani/zapisy?zapis=tr-rm-1112");
    await expect(page.getByRole("dialog", { name: "Zápis není dostupný" })).toBeVisible();

    // Správa náhled nepoužívá: pruh to řekne a stránka ukazuje skutečný účet.
    await page.goto("/sprava");
    await expect(bar(page)).toContainText("tu neplatí");
    await expect(page.getByRole("heading", { name: "Správa systému" })).toBeVisible();

    await page.goto("/vzdelavani/harmonogram");
    await bar(page).getByRole("button", { name: "Ukončit pohled" }).click();
    await expect(bar(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Přidat akci" }).first()).toBeVisible();
    await expect(page.getByLabel("Pohled")).toHaveValue("");
    await expect(page.getByRole("complementary", { name: "Hlavní navigace" }).getByRole("link", { name: /Správa/ })).toBeVisible();
  });

  test("pohled kolegy: úvod nezdraví správce a Správa systému v navigaci chybí (F16)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ahoj.");
    await expect(page.getByRole("heading", { name: "Co tě čeká" })).toBeVisible();
    await page.getByLabel("Pohled").selectOption("kolega-demo-ucastnik");
    await expect(bar(page)).toContainText("Účastník – finanční poradce");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ahoj.");
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText("Správce");
    await expect(page.getByRole("complementary", { name: "Hlavní navigace" }).getByRole("link", { name: /Správa/ })).toHaveCount(0);
    await bar(page).getByRole("button", { name: "Ukončit pohled" }).click();
    await expect(page.getByRole("complementary", { name: "Hlavní navigace" }).getByRole("link", { name: /Správa/ })).toBeVisible();
  });

  test("cookie jiného účtu nebo neplatný klíč náhled nezapne", async ({ page, context }) => {
    await context.addCookies([cookie("demo-vedouci|skupina-rm")]);
    await page.goto("/vzdelavani/harmonogram");
    await expect(page.getByRole("button", { name: "Přidat akci" }).first()).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
    await context.clearCookies({ name: "zbc_nahled" });
    await context.addCookies([cookie("demo-spravce|skupina-neexistuje")]);
    await page.reload();
    await expect(bar(page)).toHaveCount(0);
  });
});

test.describe("účastník: podvržená cookie náhledu", () => {
  test.use({ storageState: authFile("ucastnikFp") });

  test("cookie pohledu RM nic nezmění ani neodhalí", async ({ page, context }) => {
    await context.addCookies([cookie("demo-ucastnik|skupina-rm")]);
    for (const path of ["/", "/vzdelavani/harmonogram", "/vzdelavani/temata", "/vzdelavani/zapisy"]) {
      await page.goto(path);
      await expect(bar(page)).toHaveCount(0);
      await expect(page.getByLabel("Pohled")).toHaveCount(0);
    }
    // Zveřejněná RM akce je od PR #86 vidět všem (`all-published`), ale cookie z ní neudělá pohled RM:
    // bez pruhu náhledu a bez panelu účasti, který by v pohledu RM hlásil povinnost.
    await page.goto("/vzdelavani/harmonogram?akce=tr-rm-1112");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Akce není dostupná" })).toHaveCount(0);
    await expect(bar(page)).toHaveCount(0);
    await expect(page.locator("[data-ucast-panel]")).toHaveCount(0);
    // Nezveřejněný návrh pro RM neodhalí ani přímý odkaz, ani stránka akce.
    await page.goto("/vzdelavani/harmonogram?akce=ev-11-19");
    await expect(page.getByRole("dialog", { name: "Akce není dostupná" })).toBeVisible();
    const detail = await page.request.get("/vzdelavani/akce/ev-11-19");
    expect(detail.status()).toBe(404);
  });
});

test.describe("lišta s pohledem na telefonu", () => {
  test.use({ storageState: authFile("spravce") });

  test("Pohled, účet a pruh se vejdou bez vodorovného posunu", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await expect(page.getByLabel("Pohled")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByLabel("Pohled").selectOption("skupina-rm");
    await expect(bar(page)).toBeVisible();
    await expectNoHorizontalScroll(page);
    // Prvky lišty se nepřekrývají.
    const boxes = await page.evaluate(() =>
      [".brand", ".view-switch", ".account"].map((s) => {
        const r = document.querySelector(s)!.getBoundingClientRect();
        return { s, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      }),
    );
    boxes.forEach((a, i) =>
      boxes.slice(i + 1).forEach((b) => {
        const overlap = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        expect(overlap, `${a.s} × ${b.s}`).toBe(false);
      }),
    );
  });
});
