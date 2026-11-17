// Screenshoty vizuálního auditu: role × šířky × stránky, plus kontrola vodorovného posunu.
// Spuštění nad běžícím `node e2e/server.mjs`: node scripts/audit-screenshoty.mjs . <výstup mimo repo>
// Výběr zúží proměnné ROLE, SIRKY a STRANKY (čárkami), např. ROLE=spravce SIRKY=390,1280 STRANKY=uvod,plan.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const [,, , out] = process.argv;
const pick = (env, all, key = (x) => x) => (process.env[env] ? all.filter((x) => process.env[env].split(',').includes(String(key(x)))) : all);
const PERSONAS = { spravce: 'Správce ZBC ukázky', vedouci: 'Vedoucí akce', ucastnikFp: 'Účastník – finanční poradce', ucastnikRm: 'Účastník – relationship manažer' };
const roles = pick('ROLE', [...Object.keys(PERSONAS), 'host']);
const widths = pick('SIRKY', [[320, 640], [360, 740], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080]], (w) => w[0]);
const allPages = [['uvod', '/'], ['plan', '/vzdelavani/harmonogram'], ['plan-seznam', '/vzdelavani/harmonogram?pohled=seznam'], ['akce', '/vzdelavani/harmonogram?akce=ev-11-5'], ['zapisy', '/vzdelavani/zapisy'], ['temata', '/vzdelavani/temata'], ['moje-cesta', '/vzdelavani/moje-cesta'], ['cizi-akce', '/vzdelavani/akce/ev-11-5']];
const adminPages = [['sprava', '/sprava'], ['integrace', '/vzdelavani/integrace']];
const hostPages = [['vstup-ukazka', 'http://localhost:3310/vstup'], ['vstup-ostra', 'http://localhost:3311/vstup'], ['vstup-ostra-spravce', 'http://localhost:3311/vstup?spravce=1'], ['vstup-chyba', 'http://localhost:3311/vstup?chyba=google'], ['neexistuje', 'http://localhost:3310/neexistuje']];
(async () => {
  const b = await chromium.launch();
  const issues = [];
  let ip = 0;
  for (const role of roles) {
    mkdirSync(`${out}/${role}`, { recursive: true });
    const list = pick('STRANKY', role === 'host' ? hostPages : role === 'spravce' ? [...allPages, ...adminPages] : allPages, (x) => x[0]);
    // Jedno přihlášení na roli, session se pak sdílí mezi šířkami.
    let state;
    if (role !== 'host') {
      const ctx = await b.newContext({ extraHTTPHeaders: { 'x-forwarded-for': `10.99.0.${++ip}` } });
      const p = await ctx.newPage();
      await p.goto('http://localhost:3310/vstup');
      const code = p.locator('input[name=code]');
      if (await code.count()) await code.fill('e2e-pristupovy-kod');
      await p.locator('label.persona', { hasText: PERSONAS[role] }).click();
      await p.getByRole('button', { name: 'Vstoupit do ukázky' }).click();
      await p.waitForURL((url) => !url.pathname.startsWith('/vstup'));
      state = await ctx.storageState();
      await ctx.close();
    }
    for (const [w, h] of widths) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, storageState: state });
      const p = await ctx.newPage();
      for (const [name, path] of list) {
        await p.goto(path.startsWith('http') ? path : 'http://localhost:3310' + path, { waitUntil: 'networkidle' });
        const sw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (sw > 1) issues.push(`${role} ${w} ${name}: posun ${sw}px`);
        await p.screenshot({ path: `${out}/${role}/${w}-${name}.jpg`, fullPage: true, type: 'jpeg', quality: 60 });
      }
      await ctx.close();
    }
  }
  console.log(issues.length ? issues.join('\n') : 'bez vodorovného posunu');
  await b.close();
})();
