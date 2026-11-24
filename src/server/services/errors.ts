/** Očekávaná chyba domény s kódem, který UI převede na čitelnou zprávu. */
export class DomainError extends Error {
  constructor(readonly code: DomainErrorCode) {
    super(code);
    this.name = "DomainError";
  }
}

export type DomainErrorCode =
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid_input"
  | "invalid_time"
  | "invalid_state"
  | "cancelled"
  | "duplicate"
  | "email_taken"
  | "rate_limited"
  | "file_too_large"
  | "file_type"
  | "file_corrupt"
  | "file_too_long"
  | "not_past"
  | "holiday_locked"
  | "outside_month"
  | "priority_pending_migration"
  | "text_file_type"
  | "text_too_large"
  | "text_encoding"
  | "text_empty"
  | "no_lead"
  | "not_lead"
  | "minutes_incomplete"
  | "minutes_invalid"
  | "replace_unconfirmed"
  | "recording_disabled"
  | "preview_read_only";

export const DOMAIN_ERROR_MESSAGES: Record<DomainErrorCode, string> = {
  forbidden: "K této akci nemáte oprávnění.",
  preview_read_only: "Náhled je jen ke čtení. Změny dělej po přepnutí Pohledu na Můj pohled.",
  not_found: "Záznam neexistuje nebo k němu nemáte přístup.",
  conflict: "Záznam mezitím změnil někdo jiný. Načti stránku znovu a změnu zopakuj.",
  invalid_input: "Formulář obsahuje neplatné údaje.",
  invalid_time: "Konec musí být později než začátek.",
  invalid_state: "Tuto změnu nelze v aktuálním stavu provést.",
  cancelled: "Zrušenou akci už nelze upravit.",
  duplicate: "Takové téma už existuje.",
  email_taken: "Uživatel s touto adresou už ve Wiki je.",
  rate_limited: "Příliš mnoho pokusů. Zkus to prosím za chvíli.",
  file_too_large: "Soubor je příliš velký. Limit je 4 MB.",
  file_type: "Nepodporovaný formát. Nahraj WAV, MP3 nebo M4A.",
  file_corrupt: "Soubor se nepodařilo přečíst jako zvukovou nahrávku.",
  file_too_long: "Nahrávka je delší než 15 minut, což je limit ukázky.",
  outside_month: "Datum návrhu musí být v budoucnu a ve stejném měsíci.",
  not_past: "Nahrávku lze přidat až po skončení zveřejněné akce.",
  holiday_locked: "Státní svátek je pevně daný. Nejde přesunout ani upravit.",
  priority_pending_migration: "Víc než 3 garantovaná témata půjdou po schválení úpravy databáze. Zatím u jiného tématu garanci zruš.",
  text_file_type: "Nepodporovaný formát. Nahraj textový soubor TXT, MD, VTT nebo SRT.",
  text_too_large: "Text je příliš velký. Limit je 1 MB.",
  text_encoding: "Soubor není čitelný text v kódování UTF-8. Ulož ho jako UTF-8 a zkus to znovu.",
  text_empty: "Text je prázdný. Vlož přepis nebo poznámky.",
  no_lead: "Doplň vedoucího akce. Zápis schvaluje a zveřejňuje vedoucí.",
  not_lead: "Zápis schvaluje a zveřejňuje jen vedoucí akce. Návrh můžeš upravit a uložit.",
  minutes_incomplete: "Ke schválení doplň Shrnutí. Body mají nejvýš 500 znaků, v každé části nejvýš 20.",
  minutes_invalid: "Zápis je příliš dlouhý. Shrnutí má nejvýš 2000 znaků, body nejvýš 500 znaků, v každé části nejvýš 20.",
  replace_unconfirmed: "Rozepsaný zápis by se nahradil. Potvrď nahrazení, nebo pokračuj v úpravách.",
  recording_disabled: "Nahrávání zatím není zapnuté. Vlož přepis nebo poznámky, nebo nahraj textový soubor.",
};
