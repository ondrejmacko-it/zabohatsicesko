// Screenshoty závěrečného auditu: role × šířky × klíčové stránky, plus kontrola vodorovného posunu.
import { chromium } from 'playwright';
const [,, repo, out] = process.argv;
const roles = ['spravce', 'vedouci', 'ucastnikFp', 'ucastnikRm'];
const widths = [[1280, 800], [390, 844], [360, 740], [320, 640]];
const pages = [['uvod', '/'], ['plan', '/vzdelavani/harmonogram?mesic=2026-11'], ['plan-seznam', '/vzdelavani/harmonogram?mesic=2026-11&pohled=seznam'], ['akce', '/vzdelavani/akce/ev-11-5'], ['zapisy', '/vzdelavani/zapisy'], ['temata', '/vzdelavani/temata'], ['moje-cesta', '/vzdelavani/moje-cesta']];
(async () => {
  const b = await chromium.launch();
  const issues = [];
  for (const role of roles) {
    const list = role === 'spravce' ? [...pages, ['sprava', '/sprava'], ['integrace', '/vzdelavani/integrace']] : pages;
    for (const [w, h] of widths) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, storageState: `${repo}/e2e/.auth/${role}.json` });
      const p = await ctx.newPage();
      for (const [name, path] of list) {
        await p.goto('http://localhost:3310' + path, { waitUntil: 'networkidle' });
        const sw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (sw > 1) issues.push(`${role} ${w} ${name}: posun ${sw}px`);
        await p.screenshot({ path: `${out}/${role}/${w}-${name}.jpg`, fullPage: true, type: 'jpeg', quality: 60 });
      }
      await ctx.close();
    }
  }
  for (const [w, h] of widths) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    for (const [name, url] of [['vstup-ukazka', 'http://localhost:3310/vstup'], ['vstup-ostra', 'http://localhost:3311/vstup'], ['vstup-ostra-spravce', 'http://localhost:3311/vstup?spravce=1']]) {
      await p.goto(url, { waitUntil: 'networkidle' });
      const sw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (sw > 1) issues.push(`host ${w} ${name}: posun ${sw}px`);
      await p.screenshot({ path: `${out}/host/${w}-${name}.jpg`, fullPage: true, type: 'jpeg', quality: 60 });
    }
    await p.close();
  }
  console.log(issues.length ? issues.join('\n') : 'bez vodorovného posunu');
  await b.close();
})();
