// Vizuální sada PR #97: prohlížeč × role × šířka × stránka, automatické kontroly + JPEG.
// Nad běžícím `E2E_WEBKIT=1 node e2e/server.mjs`: node scripts/vizualni-sada.mjs . <výstup mimo repo>; zúžení: PROHLIZEC, ROLE, SIRKY, STRANKY (čárkami).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import { createRequire } from 'node:module';
const [,, repo, out] = process.argv;
const { chromium, firefox, webkit } = createRequire(repo + '/package.json')('playwright');
const pick = (env, all, key = (x) => x) => (process.env[env] ? all.filter((x) => process.env[env].split(',').includes(String(key(x)))) : all);
const PERSONAS = { spravce: 'Správce ZBC ukázky', ucastnikFp: 'Účastník – finanční poradce' };
const browsers = pick('PROHLIZEC', [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]], (b) => b[0]);
const roles = pick('ROLE', ['spravce', 'ucastnikFp', 'host']);
const widths = pick('SIRKY', [[320, 640], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [3440, 1440]], (w) => w[0]);
// [název, port (demo|ucast|live), cesta]
const common = [['uvod', 'demo', '/'], ['plan', 'demo', '/vzdelavani/harmonogram'], ['plan-seznam', 'ucast', '/vzdelavani/harmonogram?mesic=2026-11&pohled=seznam'],
  ['akce-ucast', 'ucast', '/vzdelavani/akce/ev-11-18'], ['zapisy', 'demo', '/vzdelavani/zapisy'], ['moje-cesta', 'demo', '/vzdelavani/moje-cesta']];
const admin = [['ucast', 'ucast', '/vzdelavani/ucast'], ['ucast-lide', 'ucast', '/vzdelavani/ucast?pohled=lide'], ['sprava', 'ucast', '/sprava'], ['integrace', 'demo', '/vzdelavani/integrace'], ['okno-akce', 'ucast', '/vzdelavani/harmonogram?akce=ev-11-18']];
const host = [['vstup-ukazka', 'demo', '/vstup'], ['vstup-ostra', 'live', '/vstup?spravce=1'], ['neexistuje', 'demo', '/neexistuje']];
const PORTS = { demo: 3310, ucast: 3313, live: 3311 };
// WebKit neposílá Secure cookie přes http://localhost: TLS proxy 3410→3310 (e2e/server.mjs), tady navíc 3413→3313 a 3411→3311.
const tls = { key: readFileSync(repo + '/.data/e2e-tls/key.pem'), cert: readFileSync(repo + '/.data/e2e-tls/cert.pem') };
for (const [from, to] of [[3413, 3313], [3411, 3311]]) {
  https.createServer(tls, (req, res) => {
    const up = http.request({ host: '127.0.0.1', port: to, method: req.method, path: req.url, headers: { ...req.headers, 'x-forwarded-proto': 'https' } },
      (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', () => res.destroy()); req.pipe(up);
  }).listen(from);
}
const base = (bn, port) => (bn === 'webkit' ? `https://localhost:${PORTS[port] + 100}` : `http://localhost:${PORTS[port]}`);
const issues = [];
let ip = 0;
for (const [bn, bt] of browsers) {
  const b = await bt.launch();
  for (const role of roles) {
    const dir = `${out}/${bn}/${role}`; mkdirSync(dir, { recursive: true });
    const list = pick('STRANKY', role === 'host' ? host : role === 'spravce' ? [...common, ...admin] : common, (x) => x[0]);
    let state;
    if (role !== 'host') {
      const ctx = await b.newContext({ ignoreHTTPSErrors: true, extraHTTPHeaders: { 'x-forwarded-for': `10.98.0.${++ip}` } });
      const p = await ctx.newPage();
      await p.goto(base(bn, 'demo') + '/vstup');
      const code = p.locator('input[name=code]');
      if (await code.count()) await code.fill('e2e-pristupovy-kod');
      await p.locator('label.persona', { hasText: PERSONAS[role] }).click();
      await p.getByRole('button', { name: 'Vstoupit do ukázky' }).click();
      await p.waitForURL((u) => !u.pathname.startsWith('/vstup'));
      state = await ctx.storageState(); await ctx.close();
    }
    for (const [w, h] of widths) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, storageState: state, locale: 'cs-CZ', timezoneId: 'Europe/Prague', ignoreHTTPSErrors: true });
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
      p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 120)));
      for (const [name, port, path] of list) {
        errs.length = 0;
        const resp = await p.goto(base(bn, port) + path, { waitUntil: 'networkidle' });
        const r = await p.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const scroll = document.documentElement.scrollWidth - vw;
          // Viditelné prvky, které přetékají viewport a nejsou uvnitř vodorovně posuvného kontejneru.
          const clipped = (el) => { for (let a = el.parentElement; a; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true; } return false; };
          const over = [];
          for (const el of document.querySelectorAll('body *')) {
            const b = el.getBoundingClientRect();
            if (!b.width || !b.height || getComputedStyle(el).visibility === 'hidden') continue;
            if ((b.right > vw + 1 || b.left < -1) && !clipped(el)) over.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
          }
          // Text uříznutý v prvku bez vlastního posuvu (scrollWidth > clientWidth u inline textových prvků).
          const cut = [];
          for (const el of document.querySelectorAll('button, a, .badge, .chip, h1, h2, h3, label, th, td')) {
            const s = getComputedStyle(el);
            if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && !/(auto|scroll)/.test(s.overflowX) && s.textOverflow !== 'ellipsis') cut.push(`${el.tagName.toLowerCase()}:${el.textContent.trim().slice(0, 30)}`);
          }
          return { scroll, over: [...new Set(over)].slice(0, 5), cut: [...new Set(cut)].slice(0, 5), h: document.documentElement.scrollHeight };
        });
        const tag = `${bn} ${role} ${w} ${name}`;
        if (!resp || resp.status() >= 400 && name !== 'neexistuje') issues.push(`${tag}: HTTP ${resp?.status()}`);
        if (r.scroll > 1) issues.push(`${tag}: vodorovný posun ${r.scroll}px`);
        if (r.over.length) issues.push(`${tag}: přetéká ${r.over.join(', ')}`);
        if (r.cut.length) issues.push(`${tag}: uříznutý text ${r.cut.join(' | ')}`);
        if (errs.length) issues.push(`${tag}: konzole ${[...new Set(errs)].join(' | ')}`);
        await p.screenshot({ path: `${dir}/${String(w).padStart(4, '0')}-${name}.jpg`, fullPage: true, type: 'jpeg', quality: 55 });
      }
      await ctx.close();
    }
  }
  await b.close();
}
writeFileSync(`${out}/nalezy.txt`, issues.join('\n') + '\n');
console.log(`${issues.length} nálezů → ${out}/nalezy.txt`);
process.exit(0);
