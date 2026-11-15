import { test as setup } from "@playwright/test";
import { authFile, enterDemo, ROLES, type Role } from "./support";

// Každá role se přihlásí jednou, ostatní testy použijí uloženou session.
for (const role of Object.keys(ROLES) as Role[]) {
  setup(`přihlášení: ${ROLES[role]}`, async ({ page }) => {
    await enterDemo(page, role);
    await page.context().storageState({ path: authFile(role) });
  });
}
