import { authFile, choosePreview, expect, expectNoHorizontalScroll, settle, test } from "./support";

// Globální „Zobrazit jako“ v horní liště: správce vidí Domů, Plán, Témata a Zápisy očima skupiny, jen ke čtení.
// Náhled drží HttpOnly cookie `zbc_nahled` (`id účtu|klíč`), server ji při každém požadavku znovu ověří.

const bar = (page: import("@playwright/test").Page) => page.getByTestId("pruh-nahledu");
const cookie = (value: string) => ({ name: "zbc_nahled", value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" as const });

test.describe("správce: pohled skupiny", () => {
  test.use({ storageState: authFile("spravce") });

  test("pohled FP platí na Domů, Plánu, Tématech a Zápisech, jen ke čtení @smoke", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    await expect(page.getByRole("button", { name: "Přidat akci" }).first()).toBeVisible();
    await choosePreview(page, "skupina-fp");
    await expect(bar(page)).toContainText("jen ke čtení");
    await expect(bar(page)).toContainText("Finanční poradci");
    // Vrátí na stejnou stránku a bez ovládání správce.
    await expect(page).toHaveURL(/\/vzdelavani\/harmonogram/);
    await expect(page.getByRole("button", { name: "Přidat akci" })).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    await page.goto("/");
    await expect(bar(page)).toContainText("jen ke čtení");
    await expect(page.getByRole("heading", { name: "Co tě čeká" })).toBeVisible();
    // F16: pozdrav nepatří správci a navigace odpovídá pohledu poradce (bez Správy systému).
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ahoj.");
    const nav = page.getByRole("complementary", { name: "Hlavní navigace" });
    await expect(nav.getByRole("link", { name: "Domů" })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Správa/ })).toHaveCount(0);

    await page.goto("/vzdelavani/temata");
    await expect(bar(page)).toContainText("jen ke čtení");
    await expect(page.locator(".topic-row").first()).toBeVisible();
    // Stejné ovládání jako u člena skupiny, jen zamčené s vysvětlením.
    await expect(page.getByRole("button", { name: "Navrhnout téma" })).toBeDisabled();
    await expect(page.getByText("Náhled je jen ke čtení. Tady se navrhují témata")).toBeVisible();
    const interest = page.getByRole("button", { name: /Mám zájem/ });
    expect(await interest.count()).toBeGreaterThan(0);
    for (const button of await interest.all()) await expect(button).toBeDisabled();
    await expect(page.getByRole("button", { name: /^Možnosti tématu/ }).or(page.locator(".topic-handle"))).toHaveCount(0);
    await expect(page.getByText(/Archivovaná témata/)).toHaveCount(0);

    await page.goto("/vzdelavani/zapisy");
    await expect(bar(page)).toContainText("jen ke čtení");
    await expect(page.getByRole("link", { name: /K dokončení/ })).toHaveCount(0);
    // Zápis akce RM skupina FP nevidí ani přímou adresou.
    await page.goto("/vzdelavani/zapisy?zapis=tr-rm-1112");
    await expect(page.getByRole("dialog", { name: "Zápis není dostupný" })).toBeVisible();

    // Správa platí podle oprávnění zobrazeného: skupina FP Správu nemá, ukáže se zástupný stav bez účtů.
    await page.goto("/sprava");
    await expect(bar(page)).toContainText("jen ke čtení");
    await expect(page.getByTestId("sprava-nahled")).toBeVisible();
    await expect(page.locator("[data-account-id], .account-row")).toHaveCount(0);

    await page.goto("/vzdelavani/harmonogram");
    await bar(page).getByRole("button", { name: "Ukončit náhled" }).click();
    await expect(bar(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Přidat akci" }).first()).toBeVisible();
    await expect(page.getByLabel("Pohled", { exact: true })).toHaveValue("Můj pohled");
    await expect(page.getByRole("complementary", { name: "Hlavní navigace" }).getByRole("link", { name: /Správa/ })).toBeVisible();
  });

  test("pohled kolegy 1:1: Témata, Zápisy a Domů mají stejné ovládání jako skutečný vedoucí, jen zamčené", async ({ browser, page, context }, info) => {
    // Ovládání stránky: výzva nahoře, zájem u témat a tlačítka úkolů. Jen názvy, ne stav (ten se v čase mění).
    const controls = async (target: import("@playwright/test").Page, path: string) => {
      await target.goto(path);
      await settle(target);
      return target.locator(".page-call-action, .topic-actions, .tasks-card").getByRole("button").or(
        target.locator(".page-call-action, .topic-actions, .tasks-card").getByRole("link"),
      );
    };
    const real = await browser.newContext({ storageState: authFile("vedouci") });
    const lead = await real.newPage();
    await context.addCookies([cookie("demo-spravce|kolega-demo-vedouci")]);
    for (const path of ["/vzdelavani/temata", "/vzdelavani/zapisy"]) {
      const own = await controls(lead, path);
      const ownNames = (await own.allTextContents()).map((t) => t.trim());
      const viewed = await controls(page, path);
      expect((await viewed.allTextContents()).map((t) => t.trim()), path).toEqual(ownNames);
      // Akční tlačítka jsou zamčená; odkazy (např. K dokončení) jen otevírají informační přehled.
      for (const control of await viewed.all()) {
        if ((await control.evaluate((el) => el.tagName)) === "BUTTON") await expect(control, path).toBeDisabled();
      }
      if (ownNames.length) await expect(page.getByText(/Náhled je jen ke čtení/).first(), path).toBeVisible();
    }
    // Domů: stejné úkoly (i skryté pod Další úkoly) kromě osobních pozvánek z Kalendáře kolegy, ty náhled nenačítá.
    const tasks = async (target: import("@playwright/test").Page) => {
      await target.goto("/");
      await settle(target);
      return (await target.locator(".tasks-card .brief-row .item-title").allTextContents()).filter((t) => !t.startsWith("Odpověz na pozvánk"));
    };
    expect(await tasks(page)).toEqual(await tasks(lead));
    for (const button of await page.locator(".tasks-card .brief-row").getByRole("button").all()) await expect(button).toBeDisabled();
    await page.screenshot({ path: info.outputPath("nahled-kolegy-zamceno.png"), fullPage: true });
    await real.close();
  });

  test("pohled kolegy: úvod nezdraví správce a Správa systému v navigaci chybí (F16)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ahoj.");
    await expect(page.getByRole("heading", { name: "Co tě čeká" })).toBeVisible();
    await choosePreview(page, "kolega-demo-ucastnik");
    await expect(bar(page)).toContainText("Účastník – finanční poradce");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ahoj.");
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText("Správce");
    await expect(page.getByRole("complementary", { name: "Hlavní navigace" }).getByRole("link", { name: /Správa/ })).toHaveCount(0);
    await bar(page).getByRole("button", { name: "Ukončit náhled" }).click();
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

test.describe("správce: náhled kolegy-správce 1:1", () => {
  test.use({ storageState: authFile("spravce") });

  test("Plán očima druhého správce: stejné stavy a „— doplnit“, ovládání zápisu zamčené", async ({ page, context }, info) => {
    const plan = "/vzdelavani/harmonogram?mesic=2026-11&pohled=seznam";
    const snapshot = async () => {
      await page.goto(plan);
      await settle(page);
      return {
        chips: (await page.locator(".pill-count").filter({ visible: true }).allTextContents()).map((t) => t.replace(/\s+/g, " ").trim()),
        todo: await page.getByText("— doplnit").filter({ visible: true }).count(),
        drafts: await page.getByText("Návrh", { exact: true }).filter({ visible: true }).count(),
      };
    };
    const own = await snapshot();
    expect(own.todo + own.drafts + own.chips.length).toBeGreaterThan(0);

    await context.addCookies([cookie("demo-spravce|kolega-demo-organizator")]);
    expect(await snapshot()).toEqual(own);
    await expect(bar(page)).toContainText("jen ke čtení");
    // Zápisové prvky správce jsou na stejném místě, ale zamčené; přesouvat akce v náhledu nejde.
    for (const name of ["Přidat akci", "Připravit měsíc"]) {
      for (const button of await page.getByRole("button", { name, exact: true }).all()) await expect(button).toBeDisabled();
    }
    await expect(page.locator("[data-handle-label]")).toHaveCount(0);

    // Okno akce: stav a rady jako u správce, uložení úprav zamčené.
    await page.locator("a[href*='akce=']").filter({ visible: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".status-band")).not.toContainText("jen ke čtení"); // říká to jen pruh náhledu
    for (const submit of await dialog.locator("button[type=submit]").all()) await expect(submit).toBeDisabled();
    await page.screenshot({ path: info.outputPath("nahled-kolegy-spravce.png"), fullPage: true });
  });
});

test.describe("účastník: podvržená cookie náhledu", () => {
  test.use({ storageState: authFile("ucastnikFp") });

  test("cookie pohledu RM nic nezmění ani neodhalí @smoke", async ({ page, context }) => {
    await context.addCookies([cookie("demo-ucastnik|skupina-rm")]);
    for (const path of ["/", "/vzdelavani/harmonogram", "/vzdelavani/temata", "/vzdelavani/zapisy"]) {
      await page.goto(path);
      await expect(bar(page)).toHaveCount(0);
      await expect(page.getByLabel("Pohled", { exact: true })).toHaveCount(0);
    }
    // Zveřejněná RM akce je od PR #86 vidět všem (`all-published`), ale cookie z ní neudělá pohled RM:
    // bez pruhu náhledu a panel účasti ukazuje vlastní stav FP (Dobrovolné), ne povinnost z pohledu RM.
    await page.goto("/vzdelavani/harmonogram?akce=tr-rm-1112");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Akce není dostupná" })).toHaveCount(0);
    await expect(bar(page)).toHaveCount(0);
    const panel = page.locator("[data-ucast-panel]");
    await expect(panel).toHaveAttribute("data-ucast-panel", "optional");
    await expect(panel).toContainText("Dobrovolné");
    await expect(panel).not.toContainText("Povinné pro tebe");
    await expect(panel).not.toContainText("Účast v náhledu");
    await expect(panel.getByRole("button")).toHaveCount(0);
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
    await expect(page.getByLabel("Pohled", { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await choosePreview(page, "skupina-rm");
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

test.describe("lišta s pohledem na počítači @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  test("značka, Pohled a účet bez překryvu; od 1000 px na jednom řádku", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    for (const width of [768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const boxes = await page.evaluate(() =>
        [".brand", ".view-switch", ".account"].map((s) => {
          const r = document.querySelector(s)!.getBoundingClientRect();
          return { s, left: r.left, right: r.right, top: r.top, bottom: r.bottom, mid: r.top + r.height / 2 };
        }),
      );
      boxes.forEach((a, i) =>
        boxes.slice(i + 1).forEach((b) => {
          const overlap = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
          expect(overlap, `${width}px: ${a.s} × ${b.s}`).toBe(false);
        }),
      );
      if (width >= 1000) {
        const mids = boxes.map((b) => b.mid);
        expect(Math.max(...mids) - Math.min(...mids), `${width}px: jeden řádek`).toBeLessThan(12);
      }
      await expectNoHorizontalScroll(page);
    }
  });
});
