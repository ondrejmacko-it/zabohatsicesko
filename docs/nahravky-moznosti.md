# Nahrávky a přepis · přehled možností pro firmu

Podklad pro rozhodnutí, ne objednávka. **Nic placeného se nezavádí, dokud to firma neschválí a nezaplatí.**
Dokument nemění kód, demo dál běží v ukázkovém režimu.

## Jak číst údaje

- Datum ověření všech údajů: **12. 11. 2026**.
- Údaje pocházejí z oficiálních stránek poskytovatelů (ceník, dokumentace), přečtených přes vyhledávač.
  Přímé otevření stránek pracovní prostředí nedovolilo, proto u každého údaje stojí odkaz na zdroj
  a **před objednávkou je nutné ho na živé stránce potvrdit**.
- Kde se zdroje rozcházejí, je uvedeno rozpětí. Kde údaj nebyl nalezen, je napsáno „neověřeno“. Nic není odhad.
- Přesnost v češtině uvádí jen sami poskytovatelé, každý na vlastním měření. Nezávislé srovnání pro češtinu
  nebylo nalezeno. Čísla proto nejsou mezi sebou spolehlivě srovnatelná, rozhodne až vlastní zkouška.
- Ceny jsou ceníkové, bez DPH, bez slev za objem. Cena za záznam 2,5 h je prostý násobek.

## Požadavky

- Co nejkvalitnější čeština, ideálně bez chyb.
- Zpracování v EU.
- Záznamy dlouhé 2 až 2,5 h.
- Soukromý přístup: audio a pracovní přepis vidí jen vedoucí akce a pověřený kontrolor (platí už dnes).

## Dnešní stav v demu

- Nahrávka se ukládá soukromě do databáze, limit 4 MB a 15 minut (`src/server/recordings/audio.ts`).
- Přepis a shrnutí dělá ukázkový poskytovatel, který zná jen přiloženou syntetickou nahrávku
  (`src/server/recordings/transcription.ts`, rozhraní `TranscriptionProvider`).
- Záznam 2,5 h má podle kvality zvuku řádově desítky až přes sto MB (při 128 kb/s zhruba 144 MB).
  Do databáze ani přes serverovou funkci Vercelu (limit těla požadavku 4,5 MB) se nevejde.

## Úložiště nahrávek

| | Google Disk | Soukromý Vercel Blob | Databáze (dnes) |
|---|---|---|---|
| Cena | Bezplatná kapacita účtu Google (velikost v této relaci neověřena) | Hobby: 1 GB a 10 GB přenosu měsíčně zdarma. Po překročení se přístup zablokuje, nic se neúčtuje | V ceně databáze |
| Soukromí | Soubor patří účtu Google, Wiki k němu přistupuje přes rozsah `drive.file` (jen soubory, které sama vytvořila) | Čtení jde přes kód Wiki, který nejdřív ověří oprávnění | Ano |
| Velké soubory | Ano, nahrávání po částech (podrobnosti neověřeny) | Ano: přímé nahrání z prohlížeče, po částech, soubor až 5 TB | Ne |
| Umístění dat | Určuje Google, region nejde zvolit (neověřeno) | Region se volí při založení a nejde změnit. Nabídku regionů v EU ověřit při zakládání | Region databáze |
| Hlavní riziko | Firemní záznamy by ležely na osobním účtu. Wiki závisí na platném připojení účtu | Plán Hobby je jen pro osobní, nekomerční použití. Ostrý provoz firmy znamená placený plán | Nestačí kapacitou |

Poznámky:

- Rozsah `drive.file` vede Google jako necitlivý a doporučený, nevyžaduje bezpečnostní posouzení aplikace.
  Wiki už má jednoho OAuth klienta pro přihlášení a Kalendář, přidání Disku znamená nový souhlas účtu.
- Soukromý Blob odpovídá dnešnímu modelu oprávnění: soubor nemá veřejnou adresu, vydává ho server.
- Jiná úložiště (například Cloudflare R2) nebyla v této relaci ověřena.

Zdroje: [Vercel Blob](https://vercel.com/docs/vercel-blob),
[ceny a limity Blobu](https://vercel.com/docs/vercel-blob/usage-and-pricing),
[pravidla plánu Hobby](https://vercel.com/docs/limits/fair-use-guidelines),
[rozsahy Drive API](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

## Poskytovatelé přepisu

| | Soniox | Speechmatics | ElevenLabs Scribe v2 |
|---|---|---|---|
| Čeština | Podporována. Číslo přesnosti pro češtinu nenalezeno | Podporována. Výrobce uvádí 7,54 % chybovost slov (FLEURS, model Enhanced) | Podporována, pásmo „výborná, do 5 % chybovosti slov“ |
| Zpracování v EU | Ano, region EU s vlastní adresou API. Nastavuje se pro projekt a **musí se o něj požádat** | Ano, adresa `eu1.asr.api.speechmatics.com` | **Jen plán Enterprise** (rezidence dat v EU nebo režim bez uchování) |
| Uchování dat | Soubory a přepisy se mažou po 30 dnech, lze smazat dřív (neověřeno) | 7 dní, lze smazat dřív | S režimem bez uchování se maže hned (Enterprise) |
| Délka záznamu | Do 300 minut, 2,5 h se vejde vcelku | Limit délky neověřen | Do 15 h a 5 GB |
| Cena za hodinu | asi 0,10 USD | 0,12 až 0,40 USD podle modelu (Melia 0,12 až 0,19, Standard 0,23 až 0,24, Enhanced 0,38 až 0,40) | 0,20 až 0,22 USD |
| Cena za 2,5 h | asi 0,25 USD | 0,30 až 1,00 USD | 0,50 až 0,55 USD |
| Rozlišení mluvčích | Ano | Neověřeno | Neověřeno |
| Zkouška zdarma | Neověřeno | Výrobce uvádí 10 h měsíčně zdarma u modelu Melia | Neověřeno |

Další prověřené možnosti, které do první trojice nepatří:

- **Google Cloud Speech-to-Text (Chirp 3).** Region `eu` je dostupný, ale čeština je ve stavu Preview a dávkové
  rozpoznání bere záznam do 1 hodiny (do 20 minut s časovými značkami slov). Záznam 2,5 h by se musel dělit.
  Cena 0,016 USD za minutu (0,96 USD za hodinu), odložené dávkové zpracování do 24 hodin 0,003 USD za minutu.
- **Beey (česká služba).** Ceník 8,4 EUR za hodinu bez paušálu, v tarifu Plus 25 EUR měsíčně za 5 hodin.
  Napojení přes API nabízí, cena API ani místo uložení dat nejsou veřejně uvedeny, nutný dotaz u dodavatele.
  Řádově dražší než ostatní, zato český dodavatel a nástroj na ruční opravy přepisu.

Zdroje: Soniox ([ceník](https://soniox.com/pricing), [čeština](https://soniox.com/speech-to-text/czech),
[rezidence dat](https://soniox.com/docs/data-residency),
[limity](https://soniox.com/docs/stt/async/limits-and-quotas)),
Speechmatics ([ceník](https://www.speechmatics.com/pricing),
[čeština](https://www.speechmatics.com/speech-to-text/czech),
[modely a regiony](https://docs.speechmatics.com/speech-to-text/models),
[limity](https://docs.speechmatics.com/speech-to-text/batch/limits)),
ElevenLabs ([ceník](https://elevenlabs.io/pricing/api),
[přepis](https://elevenlabs.io/docs/overview/capabilities/speech-to-text),
[rezidence dat](https://elevenlabs.io/docs/product-guides/administration/data-residency)),
Google ([ceník](https://cloud.google.com/speech-to-text/pricing),
[Chirp 3](https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3)),
Beey ([ceník](https://www.beey.io/en/pricing/)).

## Shrnutí do zápisu

Rozhraní přepisu má dva kroky: přepis a shrnutí do zápisu (souhrn, hlavní body, rozhodnutí, další kroky).
Služby výše dodají jen přepis. Shrnutí potřebuje jazykový model, tedy **druhou placenou službu se stejným
požadavkem na zpracování v EU**. Tato část v přehledu ověřena není a je potřeba ji doplnit před objednávkou.

## Doporučení

1. **Nejdřív zkouška na vlastním českém záznamu.** Jeden skutečný záznam (se souhlasem účastníků) přepsat
   u dvou až tří služeb a porovnat chyby ručně. Bez toho nejde poctivě říct, kdo má nejlepší češtinu.
2. **Kandidáti do zkoušky: Soniox a Speechmatics.** Oba nabízejí zpracování v EU bez podnikové smlouvy
   a 2,5 h stojí do jednoho dolaru. ElevenLabs má nejlepší udávanou přesnost, ale zpracování v EU jen v plánu
   Enterprise. Zařadit ho má smysl, pokud firma o takové smlouvě uvažuje.
3. **Úložiště: soukromý Vercel Blob v regionu EU.** Nejlépe sedí na dnešní oprávnění a zvládne velké soubory.
   Pro zkoušku stačí bezplatný 1 GB, ostrý provoz znamená placený plán Vercelu (ten je pro firemní použití
   nutný i bez nahrávek). Google Disk zůstává jako bezplatná nouzová varianta, s výhradou osobního účtu.
4. Se smlouvou si firma vyžádá zpracovatelskou smlouvu (GDPR), potvrzení regionu a dobu uchování.

## Co by znamenalo zapojení do Wiki

Odhad rozsahu, žádná z úprav není hotová:

- **Nahrání:** přímo z prohlížeče do úložiště po částech, server jen vydá krátkodobé oprávnění a ověří roli.
  Zvednout limity velikosti a délky, kontrolu formátu a délky zachovat.
- **Uložení:** v databázi zůstane jen odkaz, otisk a metadata. Přehrání a stažení dál přes server s kontrolou
  oprávnění. Smazání a nahrazení audia musí smazat i soubor v úložišti.
- **Přepis:** nový adaptér rozhraní `TranscriptionProvider`. Dnešní `transcribe(audio, sha256)` dostává celý
  soubor v paměti, pro dlouhé záznamy se změní na předání odkazu nebo proudu. Zpracování trvá minuty, proto
  poběží jako úloha na pozadí s dotazováním na stav. Opakované doručení a výpadek už demo ošetřuje.
- **Shrnutí:** adaptér jazykového modelu, výstup dál prochází `minutesSchema` a vykresluje se jako prostý text.
- **Provoz:** klíče služeb jako tajemství prostředí (doplní uživatel), přepínač režimu ukázka / skutečná
  služba po vzoru Kalendáře, logy bez obsahu přepisu.
- **Dělení záznamu** je potřeba jen u služby s limitem délky (Google). U kandidátů výše odpadá.
- **Testy:** oprávnění ke stažení z úložiště, souběh nahrazení audia a běžící úlohy, chyba služby, smazání.

## Otevřené body

- Potvrdit všechny údaje na živých stránkách a doplnit „neověřeno“.
- Vybrat službu pro shrnutí do zápisu a ověřit ji stejně jako přepis.
- Doba uchování audia, přepisu a zápisu a postup smazání (rozhoduje firma).
- Souhlas účastníků s nahráváním a zpracováním u třetí strany.
