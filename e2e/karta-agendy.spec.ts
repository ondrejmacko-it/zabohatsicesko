import { authFile, expect, settle, test } from "./support";

// Screenshoty vlastníka 27. 11. 2026 (Android, ~347 px): čas „09:00–10:30“ se vedle dvou štítků lámal po znacích,
// „12:30 – 15:00“ na tři řádky a štítky uvnitř. Test měří geometrii karet agendy, ne třídy.
const WIDTHS = [320, 347, 360, 390];

test.describe("Plán na telefonu: karta agendy", () => {
  for (const role of ["spravce", "ucastnikFp"] as const) {
    test.describe(role, () => {
      test.use({ storageState: authFile(role) });

      for (const width of WIDTHS) {
        test(`šířka ${width} px: čas i štítky na jednom řádku, nic nepřesahuje kartu`, async ({ page }, info) => {
          test.skip(info.project.name !== "telefon-390", "šířky prochází jeden telefonní projekt");
          await page.setViewportSize({ width, height: 800 });
          await page.goto("/vzdelavani/harmonogram?mesic=2026-11");
          await settle(page);
          const times = page.locator("[class*=\"agendaTime\"]").filter({ visible: true });
          await expect(times.first()).toBeVisible();
          const report = await page.evaluate(() => {
            const oneLine = (el: Element) => {
              const style = getComputedStyle(el);
              const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
              const pad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
              return el.getBoundingClientRect().height - pad <= line * 1.5;
            };
            const cards = [...document.querySelectorAll("[class*=\"agendaEvent\"]")].filter((c) => c.getBoundingClientRect().width > 0);
            const problems: string[] = [];
            let withTwoBadges = 0;
            for (const card of cards) {
              const c = card.getBoundingClientRect();
              const time = card.querySelector("[class*=\"agendaTime\"]");
              // Jednodenní čas („09:00 – 10:30“) vždy na řádek; vícedenní s daty se smí zalomit jen u mezery.
              const multiDay = /\d\.\s/.test(time?.textContent ?? "");
              if (time && !multiDay && !oneLine(time)) problems.push(`čas víc řádků: ${time.textContent}`);
              if (time && time.scrollWidth > time.clientWidth + 1) problems.push(`čas přetéká: ${time.textContent}`);
              const badges = [...card.querySelectorAll(".badge")];
              if (badges.length > 1) withTwoBadges++;
              for (const badge of badges) {
                const b = badge.getBoundingClientRect();
                if (!oneLine(badge)) problems.push(`štítek zalomený: ${badge.textContent}`);
                if (b.right > c.right + 1 || b.left < c.left - 1) problems.push(`štítek přesahuje: ${badge.textContent}`);
              }
              if (card.scrollWidth > card.clientWidth + 1) problems.push(`karta přetéká: ${card.textContent?.slice(0, 40)}`);
            }
            return { problems, cards: cards.length, withTwoBadges };
          });
          expect(report.problems).toEqual([]);
          expect(report.cards).toBeGreaterThan(3);
          if (role === "ucastnikFp") expect(report.withTwoBadges, "seed má kartu se dvěma štítky").toBeGreaterThan(0);
        });
      }
    });
  }
});
