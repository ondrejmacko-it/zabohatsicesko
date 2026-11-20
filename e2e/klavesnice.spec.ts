import type { Page } from "@playwright/test";
import { authFile, expect, settle, test } from "./support";

const isMac = (projectName: string) => projectName.startsWith("macos") || projectName.startsWith("webkit");

/** Prvek s fokusem: jeho popis a jestli je fokus vidět (obrys nebo stín). */
async function focused(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return null;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      label: (element.getAttribute("aria-label") || element.innerText || `${element.tagName} ${element.getAttribute("type") ?? ""} ${element.className}`).replace(/\s+/g, " ").trim().slice(0, 50),
      visible: rect.width > 0 && rect.height > 0,
      ring: (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none",
      outline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
    };
  });
}

test.describe("klávesnice @desktop", () => {
  test.use({ storageState: authFile("spravce") });

  test("Tab prochází viditelné prvky s viditelným fokusem", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    const seen: string[] = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const current = await focused(page);
      expect(current, `fokus po ${i + 1}. Tab`).not.toBeNull();
      expect(current!.visible, `neviditelný fokus: ${current!.label}`).toBe(true);
      expect(current!.ring, `fokus bez obrysu: ${current!.label}`).toBe(true);
      seen.push(current!.label);
    }
    expect(seen).toContain("Plán");
    expect(seen).toContain("Přidat akci");
  });

  test("focus ring je všude stejný, Shift+Tab vrací fokus zpět (A-14)", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    const ring = "2px solid rgb(157, 98, 25)";
    const labels: string[] = [];
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const current = (await focused(page))!;
      expect(current.outline, `jiný focus ring: ${current.label}`).toBe(ring);
      labels.push(current.label);
    }
    for (let i = 18; i >= 15; i--) {
      await page.keyboard.press("Shift+Tab");
      expect((await focused(page))!.label).toBe(labels[i]);
    }

    // V okně: stejný ring u tlačítek i polí, Tab zůstane v okně, Esc zavře a vrátí fokus.
    const trigger = page.getByRole("button", { name: "Přidat akci" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const opened = page.getByRole("dialog", { name: "Přidat akci" });
    await expect(opened).toBeVisible();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await opened.evaluate((node) => node.contains(document.activeElement))).toBe(true);
      const current = (await focused(page))!;
      expect(current.outline, `jiný focus ring v okně: ${current.label}`).toBe(ring);
    }
    await page.keyboard.press("Shift+Tab");
    expect(await opened.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    // Rozepsané pole by se zeptalo; Tab nic nevyplnil, okno se zavře hned.
    await expect(opened).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("Enter otevře okno, Esc zavře a fokus se vrátí", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram");
    await settle(page);
    const trigger = page.getByRole("button", { name: "Přidat akci" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const opened = page.getByRole("dialog", { name: "Přidat akci" });
    await expect(opened).toBeVisible();
    expect(await opened.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(opened).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("menu: Enter otevře, Esc zavře a vrátí fokus", async ({ page }) => {
    await page.goto("/vzdelavani/temata");
    await settle(page);
    const trigger = page.getByRole("button", { name: /^Možnosti tématu/ }).first();
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });

  test("okno z menu: po zavření se fokus vrátí na tlačítko menu", async ({ page }) => {
    await page.goto("/vzdelavani/temata");
    await settle(page);
    const trigger = page.getByRole("button", { name: /^Možnosti tématu/ }).first();
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Upravit téma" }).first().focus();
    await page.keyboard.press("Enter");
    const opened = page.getByRole("dialog", { name: "Upravit téma" });
    await expect(opened).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(opened).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("okno řízené adresou: Esc zavře a fokus zůstane na stránce", async ({ page }) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&pohled=seznam");
    await settle(page);
    const link = page.getByRole("link", { name: /Setkání týmu/ }).first();
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Setkání týmu" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/akce=/);
    await expect(await focused(page)).not.toBeNull();
  });

  test("Cmd/Ctrl + klik na akci nechá prohlížeči (nová karta), stránka se nezmění", async ({ page }, testInfo) => {
    await page.goto("/vzdelavani/harmonogram?mesic=2026-11&pohled=seznam");
    await settle(page);
    const before = page.url();
    const modifier = isMac(testInfo.project.name) ? "Meta" : "Control";
    // Posluchač na window běží po Reactu: zaznamená, jestli aplikace klik převzala, a sám zabrání
    // navigaci. Co prohlížeč s klikem udělá (nová karta), závisí na systému, Cmd na skutečném Macu
    // ověřuje ruční postup v docs/overeni-mac.md.
    await page.evaluate(() => {
      window.addEventListener("click", (event) => {
        (window as unknown as { appPrevented: boolean }).appPrevented = event.defaultPrevented;
        event.preventDefault();
      }, { once: true });
    });
    await page.getByRole("link", { name: /Setkání týmu/ }).first().click({ modifiers: [modifier] });
    expect(await page.evaluate(() => (window as unknown as { appPrevented: boolean }).appPrevented), "aplikace převzala klik s modifikátorem").toBe(false);
    await page.waitForTimeout(300);
    expect(page.url()).toBe(before);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

});
