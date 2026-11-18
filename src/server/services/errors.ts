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
  | "priority_full"
  | "text_file_type"
  | "text_too_large"
  | "text_encoding"
  | "text_empty"
  | "no_lead"
  | "not_lead"
  | "minutes_incomplete"
  | "replace_unconfirmed";

export const DOMAIN_ERROR_MESSAGES: Record<DomainErrorCode, string> = {
  forbidden: "K této akci nemáte oprávnění.",
  not_found: "Záznam neexistuje nebo k němu nemáte přístup.",
  conflict: "Záznam mezitím změnil někdo jiný. Načtěte stránku znovu a změnu zopakujte.",
  invalid_input: "Formulář obsahuje neplatné údaje.",
  invalid_time: "Konec musí být později než začátek.",
  invalid_state: "Tuto změnu nelze v aktuálním stavu provést.",
  cancelled: "Zrušenou akci už nelze upravit.",
  duplicate: "Takové téma už existuje.",
  email_taken: "Uživatel s touto adresou už ve Wiki je.",
  rate_limited: "Příliš mnoho pokusů. Zkuste to prosím za chvíli.",
  file_too_large: "Soubor je příliš velký. Limit je 4 MB.",
  file_type: "Nepodporovaný formát. Nahrajte WAV, MP3 nebo M4A.",
  file_corrupt: "Soubor se nepodařilo přečíst jako zvukovou nahrávku.",
  file_too_long: "Nahrávka je delší než 15 minut, což je limit ukázky.",
  outside_month: "Datum návrhu musí být v budoucnu a ve stejném měsíci.",
  not_past: "Nahrávku lze přidat až po skončení zveřejněné akce.",
  holiday_locked: "Státní svátek je pevně daný. Nejde přesunout ani upravit.",
  priority_full: "Garantovaná mohou být nejvýš 3 témata. Nejdřív u jiného tématu prioritu zrušte.",
  text_file_type: "Nepodporovaný formát. Nahrajte textový soubor TXT, MD, VTT nebo SRT.",
  text_too_large: "Text je příliš velký. Limit je 1 MB.",
  text_encoding: "Soubor není čitelný text v kódování UTF-8. Uložte ho jako UTF-8 a zkuste to znovu.",
  text_empty: "Text je prázdný. Vložte přepis nebo poznámky.",
  no_lead: "Doplňte vedoucího akce. Zápis schvaluje a zveřejňuje vedoucí.",
  not_lead: "Zápis schvaluje a zveřejňuje jen vedoucí akce. Návrh můžete upravit a uložit.",
  minutes_incomplete: "Zápis potřebuje aspoň shrnutí. Body mají nejvýš 500 znaků, v každé části nejvýš 20.",
  replace_unconfirmed: "Rozepsaný zápis by se nahradil. Potvrďte nahrazení, nebo pokračujte v úpravách.",
};
