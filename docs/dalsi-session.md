# Navazující relace (stav 26. 11. 2026, relace 16 zadání „Finální dokončení po PR #92“)

Větev `claude/festive-sagan-lilorz` z main 2703a0b (PR #92 v main). Limit relace 170 tis. (start v cloudu zabere
~120 tis., na práci zbývá málo: čti cíleně, výstupy zkracuj). Nic nemergovat/nenasazovat, žádné vzdálené migrace,
změny produkčního Vercelu/Neonu ani Google pozvánky bez schválení vlastníka. Před testy `npm ci` (node_modules chybí).

## Zadání
Plné znění: první zpráva uživatele „ZBČ – FINÁLNÍ DOKONČENÍ PROJEKTU PO PR #92“ v relaci
session_01HpUiryLcisq3sp1bDNE1U2: `list_events` kinds=["user"], limit 100,
`before_id=ce15ad91-6fd8-49f9-b71c-5b737056552a` (výsledek jde do souboru; JSON za úvodní hlavičkou, najdi řetězec
obsahující „PO PR #92“ a „Fáze“, ulož do scratchpadu a čti jen řádky své fáze: E ř. 302–349, F 350–407,
G 408–484, H 485–535, I 536–556, J 557–583, K 584–637, L 638–656, výstup 657+).
Fáze: A audit · B účast na izolovaném Preview · C hotovo · D náhled 1:1 hotovo · E hromadný výběr (bod 9) ·
F Zápisy (bod 11) · G celkové UI (bod 13) · H Témata a barvy · I Google Kalendář F04 · J matice F01–F18, D01–D07 ·
K UX/regresní audit + smoke E2E v CI · L release checklist · výstup: report + draft PR.

## Hotovo
- A, B (Preview čeká na vlastníka: Preview `DATABASE_URL` = Neon branch br-wandering-paper-b9ef86og, pak redeploy),
  C01–C06, D1–D4 hotovo (viz git log). `e2e/ucast.spec.ts:262` samostatně OK (v celé sadě jen timeout pod zátěží).
- E1 (abb7f96): `draftBreakdown`/`draftHint` v `status.ts`, štítek Návrhy má nápovědu s rozpadem
  (nové / změny zveřejněných / v minulosti jen smazat / bez tématu či vedoucího); počet = filtr „navrhy“
  (konzistentní). Test `tests/navrhy-rozpad.test.ts`. tsc + eslint čisté.

- E2–E4 (6aa27c6): lišta „Vybráno Y z X nových návrhů“ + rozpad (`data-testid=rozpad-vyberu`); návrhy změn
  z viditelných karet (`draftBreakdown(cards).changes`); `picked` = Map id→revize, po refresh (i po chybě akce)
  vyřadí změněné s hláškou v `duvod-vyberu`; `SelectionZone key` = měsíc|typ|stav|ucast. Nový
  `e2e/vyber-kontext.spec.ts` (v projektu zapis-temat přidán do testMatch) – prošel na windows-1280, telefon-390,
  zapis-temat. tsc + eslint čisté. Celá vitest sada po změně neověřena (výstup se ořízl) – spustit `npx vitest run`.
  Zveřejnění z výběru e2e v tomto souboru není (kryjí ho okna/priprava-mesice).

## Další krok
Relace 16 jen načetla zadání F a kód (start cloudu spotřeboval ~140 tis.), nic nezměnila. Vitest po E2–E4
ověřen na 8546138: 67 souborů / 611 testů OK. Rovnou začni F1.
Fáze F (zadání ř. 350–407) – rozbor hotový, navrhovaný postup po jednotkách:
- F1 `journey.ts:65` `MissingMinutesItem` + `mine` (= `minutesTaskRole` write, nebo review a stav draft; stejně jako
  `listTasks` ř. 207). Okno K dokončení (`MinutesPeek.tsx` `AddMinutesPicker`, volá `zapisy/page.tsx:57`): `RouteModal
  wide`, řádky mřížkou Název · Datum · Vedoucí · Stav (badge) · jedna akce; stavy: bez vedoucího → „Chybí vedoucí“
  (akce Přiřadit vedoucího u správce), none → „Chybí zápis“, processing/failed/unsupported/started → „Rozpracováno“
  (+ podtext), draft → „Čeká na schválení“. Skupiny „Moje úkoly“ / „Ostatní (správcovský přehled)“. Hledání + filtr
  stavu v klientské komponentě od >6 položek (hrefy spočítat na serveru, funkce do klienta nejdou). Zachovat text
  „Vede: |Vedoucí neurčen“ a název okna (e2e `okna.spec.ts:250`, `nahled.spec.ts:47`).
- F2 tlačítko K dokončení (`zapisy/page.tsx:63`): u správce badge = moje, text „· všech N“; aria-label obojí.
  Domů/Plán (`TasksCard`, `harmonogram/page.tsx:227`) už ukazují jen vlastní „Čeká na tebe“ (max 4 zápisové úkoly,
  `MAX_MINUTES_TASKS`) – zvážit popisek.
- F3 `MinutesSourceForm.tsx`: krátké bezpečnostní upozornění (notice) NAD polem, dlouhý technický text do `<details>`
  (ponechat `data-testid=citliva-data` a fráze z `e2e/zapisy-schvaleni.spec.ts:24-27`). Oddělit Kontext / Stav a
  odpovědná osoba (`RecordingSection` hlavička + `ApproverNote`) / Vstup / Bezpečnost / Akce.
- F4 schvalování: ověřit testy (`tests/zapisy-f13-f15.test.ts`, re-approval `approvedVersion` v `RecordingSection`).
CSS: `globals.css` `.brief-row` ř. 2216, `.picker-list` 2895, mobil 2296, `.badge*` 612–640, `.filter-bar` 1967.
Pak G (408–484), H, I, J, K, L a výstup (657+). Zadání: uložit do scratchpadu Pythonem `json.JSONDecoder().raw_decode`
(soubor má víc JSON řádků), hledat řetězec s „PO PR #92“ a „Fáze“.

## Otevřené otázky pro vlastníka
- C04: správce si může nastavit sebe jako nadřízeného kohokoli a číst jeho důvody omluv (audit to zapíše).
  Doporučení: zakázat nastavení sebe. Deaktivace nadřízeného vazby nemaže – mazat?
- C05 `vedouci-tymu`: doporučení zachovat při uložení účtu.
- Preview `DATABASE_URL` izolovaného branche (tajemství), schválení migrací 0015–0018 na produkci.
- Zvýšení limitu relace (hook `scripts/limit-kontextu.py`) jen vlastník.
