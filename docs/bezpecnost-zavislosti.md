# Bezpečnost závislostí: dočasná výjimka v CI

Stav k 18. 11. 2026. Výjimku schválil vlastník repa. Platí jen pro níže uvedenou zranitelnost.

## Co se změnilo v CI (`.github/workflows/ci.yml`)

Obě kontroly jsou v povinném jobu „Lint, typy, testy a build“ a **obě blokují merge**:

| Kontrola | Příkaz | Co projde |
| --- | --- | --- |
| Audit produkčních závislostí | `npm audit --omit=dev --audit-level=moderate` | jen 0 nálezů, bez výjimek |
| Plný audit se schválenými výjimkami | `npx tsx scripts/audit-plny.ts` | jen nálezy kryté platnou výjimkou ze `scripts/audit-vyjimky.json` |

Pravidla plného auditu (`scripts/audit-vyjimky.ts`, testy `tests/audit-vyjimky.test.ts`):

* Výjimka platí jen pro konkrétní advisory **a** balíček (GHSA-fc5q-39xc-vjpf v `picomatch`) a jen do data `platiDo`
  (31. 12. 2026). Tolerovaný nález se ukáže jako varování v PR a v souhrnu běhu.
* Každý jiný advisory od úrovně moderate CI zastaví, dokud ho někdo neposoudí a nepřidá jako samostatnou výjimku
  (advisory, balíček, datum, issue, důvod).
* Chyba samotného auditu (nedostupný registr, neplatný nebo neznámý výstup) CI zastaví, nikdy se nebere jako povolený nález.
* Po datu `platiDo` výjimka přestane platit a CI zastaví.

Nepoužívá se `continue-on-error`, plošné ignorování zranitelností, `npm audit fix --force` ani zvýšení prahu na `critical`.

## Známá zranitelnost

* **GHSA-fc5q-39xc-vjpf**, `picomatch` ≤ 4.0.7, ReDoS při opakovaných extglob vzorech (CWE-1333, CVSS 7,5, high).
  Zveřejněná 17. 11. 2026 kolem 17:10 UTC, opravená verze zatím neexistuje (nejnovější 4.0.7).
* Kudy vede do projektu (jen `devDependencies`, ověřeno `npm ls picomatch --all`):
  * `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `picomatch@2.3.2`
  * `vitest` → `vite`, `tinyglobby` → `picomatch@4.0.7`
* Produkční strom (`npm ls picomatch --omit=dev --all`) je prázdný a `npm audit --omit=dev` hlásí 0 zranitelností.
* Next.js má vlastní přibalenou kopii (`next/dist/compiled/picomatch`), kterou `npm audit` nevidí. Používá ji jen
  ke kontrole vzorů `images.localPatterns` / `remotePatterns` u `next/image`. Projekt `next/image` nepoužívá a vzory
  obrázků nemá, takže se za běhu nepoužije. Vzory by stejně určoval jen kód projektu, ne uživatel.

Dopad: zranitelnost se týká lintu a testů na vývojářském počítači a v CI, ne nasazené aplikace.

## Kdy výjimku odebrat

1. Vyjde opravená verze `picomatch` (nebo advisory upraví rozsah) a `npm audit --audit-level=moderate` po
   aktualizaci `eslint-config-next` a `vitest` projde bez nálezu: smazat výjimku ze `scripts/audit-vyjimky.json`
   a zavřít issue #66.
2. Nejpozději 31. 12. 2026 výjimka sama vyprší a CI zastaví. Pak ji znovu posoudit (prodloužit datum jen se
   souhlasem vlastníka repa).

## Jak to ověřit ručně

```bash
npm ci
npm audit --omit=dev --audit-level=moderate   # musí projít
npm ls picomatch --omit=dev --all             # musí být prázdné
npm audit --audit-level=moderate              # dočasně hlásí jen GHSA-fc5q-39xc-vjpf
npx tsx scripts/audit-plny.ts                 # musí projít a ukázat jen známou výjimku
```
