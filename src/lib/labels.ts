import type { EventType, Group, PlanStatus, RecordingState, SyncStatus } from "./types";

export const TYPE_LABELS: Record<EventType, string> = {
  action: "Action time",
  "training-fp": "Trénink poradců",
  portfolio: "Portfolio tým",
  "training-rm": "Trénink RM",
  "education-fp": "Firemní vzdělávání FP",
  "education-rm": "Firemní vzdělávání RM",
  team: "Setkání týmu",
  workshop: "AI workshop",
  "two-day": "Dvoudenní školení",
  holiday: "Státní svátek",
  other: "Jiná akce",
};

/** Typy, které nahrazují pravidelnou aktivitu. V harmonogramu se zvýrazní jako mimořádné. */
export const EXTRAORDINARY_TYPES: ReadonlySet<EventType> = new Set(["team", "workshop", "two-day", "other"]);

export const GROUP_LABELS: Record<Group, string> = {
  vsichni: "Všichni",
  fp: "Finanční poradci",
  rm: "Relationship manažeři",
  "tym-a": "Tým A",
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  draft: "Návrh",
  published: "Zveřejněno",
  cancelled: "Zrušeno",
};

export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  pending: "Čeká",
  synced: "Synchronizováno",
  attention: "Vyžaduje pozornost",
};

export const RECORDING_STATE_LABELS: Record<RecordingState, string> = {
  awaiting: "Čeká na nahrávku",
  processing: "Zpracovává se",
  review: "Ke kontrole",
  available: "Zápis dostupný",
  failed: "Zpracování se nepovedlo",
};

export const TEMPLATE_LABELS: Record<string, string> = {
  training: "Trénink / rozbor",
  course: "Školení",
  meeting: "Interní schůzka",
  unknown: "Jiné / nejisté",
};

/** Čitelné důvody chyb. Neobsahují obsah nahrávky ani technické detaily. */
export const ERROR_LABELS: Record<string, string> = {
  calendar_unavailable: "Google Kalendář je dočasně nedostupný. Změna je ve Wiki uložená, zkuste synchronizaci znovu.",
  calendar_revoked: "Přístup ke Kalendáři byl odvolán. Připojte integraci znovu.",
  external_change: "Pozvánku někdo upravil přímo v Google Kalendáři. Zkontrolujte rozdíl a rozhodněte, co platí.",
  calendar_missing: "Propojená pozvánka v Kalendáři už neexistuje. Vazbu je potřeba opravit.",
  unsupported_fixture: "Ukázkový přepis zná jen testovací nahrávku. Pro jiný soubor je potřeba skutečný testovací režim.",
  transcription_unavailable: "Služba přepisu je dočasně nedostupná. Zkuste zpracování znovu.",
  invalid_output: "Návrh zápisu neprošel kontrolou formátu. Zkuste zpracování znovu.",
};
