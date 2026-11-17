# Bezpečnost závislostí: dočasná výjimka v CI

Stav k 18. 11. 2026. Výjimku schválil vlastník repa. Platí jen pro níže uvedenou zranitelnost.

## Co se změnilo v CI (`.github/workflows/ci.yml`)

| Kontrola | Příkaz | Režim |
| --- | --- | --- |
| Audit produkčních závislostí (job „Lint, typy, testy a build“) | `npm audit --omit=dev --audit-level=moderate` | **blokuje merge** |
| Bezpečnostní report – všechny závislosti (samostatný job) | `npm audit --audit-level=moderate` | neblokující: nález ukáže varování v PR a výpis v souhrnu běhu |

Nepoužívá se plošné ignorování zranitelností, `npm audit fix --force` ani zvýšení prahu na `critical`.

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

## Kdy se plný audit vrátí do blokujícího režimu

Jakmile platí kterákoli z podmínek:

1. Vyjde opravená verze `picomatch` (nebo advisory upraví rozsah) a `npm audit --audit-level=moderate` po
   `npm update` / aktualizaci `eslint-config-next` a `vitest` projde bez nálezu.
2. Plný audit najde **jinou** zranitelnost než GHSA-fc5q-39xc-vjpf. Tu je potřeba řešit hned, výjimka se na ni nevztahuje.
3. Nejpozději k 31. 12. 2026 výjimku znovu posoudit, i když oprava nevyjde.

Návrat: v `ci.yml` vrátit do jobu „Lint, typy, testy a build“ krok `npm audit --audit-level=moderate`
(produkční krok může zůstat) a smazat job „Bezpečnostní report – všechny závislosti“. Pak aktualizovat tento soubor.

## Jak to ověřit ručně

```bash
npm ci
npm audit --omit=dev --audit-level=moderate   # musí projít
npm ls picomatch --omit=dev --all             # musí být prázdné
npm audit --audit-level=moderate              # dočasně hlásí jen GHSA-fc5q-39xc-vjpf
```
