# Finální vyladění UI PC + mobil – report

Větev `claude/finalni-vyladeni-ui-pc-mobil` z main `7e9b886`. Zadání vlastníka (body 0–12) se do repa nedává.
Nic nemergnuto, nic nenasazeno, produkční DB ani živý Google a Make se nepoužily. Kalendář běží v simulaci.

## Změny podle oblastí

| Oblast | Co se změnilo | Commity |
|---|---|---|
| Mobilní menu a horní lišta | Mřížka stejných položek včetně Zpětné vazby; přepínač osoby se na tabletu zúží, 641 px nepřetéká | `b3e1013`, `0269142` |
| Témata | Výzva text + CTA v řadě, filtr a hledání v jedné liště, čitelné ⋯, Mám zájem bez skoku šířky, řazení zamčené při filtru/hledání s resetem | `02b6e35`, `073c380`, `7ba2ba0`, `6cce1ce`, `6346b85` |
| Naplánovat téma | Návrhy a zveřejněné akce ve skupinách s jedním vysvětlením, Přiřadit k akci | `ce74be0` |
| Náhled role a účet | Jeden pruh „Náhled: … · jen ke čtení“, návrat na Domů/Plán; oslovení v menu Účet | `9eeea4b`, `4e82546` |
| Plán | Dnes u navigace měsíce, čas se nezalomí, filtr účasti 4 v řadě nebo 2 × 2, „Změna vedoucího a skupiny“ | `2bfc009`, `1490a36`, `3d518b3` |
| Detail a okno akce | Správce nejdřív čtecí okno s Upravit akci a ⋯; skupiny Akce/Termín/vedení bez číslovaných karet; jeden řádek stavu, příjemci po zveřejnění, mobilní patička se 2 akcemi | `b9f7352`, `f5549ee`, `f0c8b4f`, `bf735eb` |
| Účast | Neutrální pravdivé stavy Kalendáře, stav jako jedna věta vedle akce, důvod omluvy nepředvybraný, omluva bez dvojitého odeslání | `b8e9e9b`, `f4b34e5` |
| Brouček | Vyhýbá se otevřeným nabídkám a klávesnici (visualViewport), konec obsahu nad ním, regresní test překryvu | `ee04642`, `c945eb0` |
| Správa | Karta kolegy: jméno+e-mail / role+skupiny / zařízení, stav a ⋯ na ose se jménem; e-mail se láme jen před „@“ | `f47c76e` |
| Zápisy | K dokončení: řádek název + datum·vedoucí, CTA podle stavu, počty jednou nahoře, hledání a Stav v jedné liště; nápověda o údajích klientů | `0a6f188`, `beed5a5`, `9fa0a7e` |
| Hlavička okna | Ikonové Zavřít (44 px, `aria-label`) zůstane vedle dlouhého názvu | `98df081` |
| Čeština | Skloňování počtů návrhů a lidí, „Pro koho“ místo „Publikum“ | `8e868fb` |
| Domů | Víc zaseknutých pozvánek = jeden úkol „Pozvánky k vyřešení: N“ (počítá se N×), odkaz na první akci | `a191fc6` |

Geometrie (překryvy, zalomení, přetečení) hlídá `e2e/geometrie.spec.ts` na 320, 360 a 1280 px.

## Ověření

Výsledky celé sady jsou v popisu PR (commit, příkazy, počty). Kalendář, Účast a pozvánky jsou ověřené jen v simulaci
(`simCalendarEvents`), ne proti živému Googlu.

## Checklist živého ověření Účasti (vlastník, Preview se skutečným Kalendářem)

- [ ] Připojení: organizátor propojí Kalendář Google, úkol „Propoj Kalendář Google“ zmizí.
- [ ] Povinná pozvánka: po zveřejnění povinné akce dorazí pozvánka všem ze skupiny, ve Wiki stav „Pozvánka odeslána“.
- [ ] Dobrovolná registrace: přihlášení přidá hosta do pozvánky, odhlášení ho odebere (jen hosty přidané Wiki).
- [ ] Omluva: odeslání s důvodem se propíše do Kalendáře, dvojklik nepošle dvě omluvy.
- [ ] Návrat: zrušení omluvy vrátí účast a hosta v pozvánce.
- [ ] Přesun: změna termínu se propíše do pozvánky, pozvaní dostanou aktualizaci.
- [ ] Zrušení akce: pozvánka v Kalendáři se zruší, Wiki ukáže zrušenou akci.
- [ ] Retry: po dočasné chybě (např. odvolaný přístup a jeho obnovení) fronta pozvánku dopíše, úkol „Vyřešit pozvánku“ zmizí.
- [ ] Ruční host: host přidaný v Kalendáři ručně zůstane, Wiki ho neodebere a panel o něm nic netvrdí.
