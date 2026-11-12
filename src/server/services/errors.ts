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
  | "not_past";

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
  not_past: "Nahrávku lze přidat až po skončení zveřejněné akce.",
};
