import { authFile, expect, ROLES, test, type Role } from "./support";

// Únik dat do klienta: HTML i data pro React (RSC) nesmí nést tokeny, tajemství ani cizí e-maily.
// Pravé tlačítko, výběr textu ani kopírování se neblokují, ochrana je na serveru.

const PATHS = ["/", "/vzdelavani", "/vzdelavani/harmonogram", "/vzdelavani/harmonogram?pohled=seznam", "/vzdelavani/zapisy", "/vzdelavani/temata", "/vzdelavani/moje-cesta", "/vzdelavani/akce/ev-11-5", "/sprava", "/vzdelavani/integrace"];
const SECRETS = /ya29\.|refresh_?token|encrypted_?refresh|GOCSPX|client_?secret|e2e-only-session-secret|TOKEN_ENCRYPTION|SESSION_SECRET|DATABASE_URL|access_token/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

for (const role of Object.keys(ROLES) as Role[]) {
  test.describe(`únik dat: ${ROLES[role]}`, () => {
    test.use({ storageState: authFile(role) });

    test("HTML ani RSC nenese tajemství, člen nevidí cizí e-maily", async ({ page }) => {
      const found = new Set<string>();
      for (const path of PATHS) {
        for (const rsc of [false, true]) {
          const response = await page.request.get(path, { headers: rsc ? { RSC: "1" } : {} });
          const body = await response.text();
          expect(body, `${path}${rsc ? " (RSC)" : ""}`).not.toMatch(SECRETS);
          for (const email of body.match(EMAIL) ?? []) found.add(email);
          const headers = response.headers();
          expect(headers["x-powered-by"]).toBeUndefined();
          if (response.ok()) expect(headers["cache-control"] ?? "", path).not.toMatch(/public/);
        }
      }
      // Člen týmu smí v datech stránky mít nanejvýš vlastní adresu. Adresy ostatních má jen správce.
      if (role !== "spravce") expect(found.size, [...found].join(", ")).toBeLessThanOrEqual(1);
    });

    test("pravé tlačítko a výběr textu fungují", async ({ page }) => {
      await page.goto("/");
      const blocked = await page.evaluate(() => {
        const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
        document.body.dispatchEvent(event);
        return event.defaultPrevented || getComputedStyle(document.body).userSelect === "none";
      });
      expect(blocked).toBe(false);
    });
  });
}
