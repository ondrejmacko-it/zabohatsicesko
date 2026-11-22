import type { EventType, Group, MinutesSource, PlanStatus, RecordingState, Role, SyncStatus, UserStatus } from "./types";

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

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Správce",
  // Starší hodnota v databázi, práva i název jsou stejné jako u správce.
  organizer: "Správce",
  member: "Člen týmu",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: "Aktivní",
  pending: "Čeká na schválení",
  disabled: "Odebraný přístup",
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  draft: "Návrh",
  published: "Zveřejněno",
  cancelled: "Zrušeno",
};

export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  pending: "Pozvánka se odesílá",
  synced: "Synchronizováno",
  attention: "Změna se nepropsala",
};

export const RECORDING_STATE_LABELS: Record<RecordingState, string> = {
  awaiting: "Čeká na zápis",
  processing: "Zpracovává se",
  review: "Čeká na schválení",
  available: "Zápis zveřejněn",
  failed: "Přepis se nepovedl",
};

/** Zdroj zápisu, jak ho vidí vedoucí, kontrolor a správce. */
export const MINUTES_SOURCE_LABELS: Record<MinutesSource, string> = {
  recording: "nahrávka",
  transcript: "vložený přepis",
  notes: "vložené poznámky",
  file: "textový soubor",
  manual: "ruční zápis",
};

export const TEMPLATE_LABELS: Record<string, string> = {
  training: "Trénink / rozbor",
  course: "Školení",
  meeting: "Interní schůzka",
  unknown: "Jiné / nejisté",
};

/** Čitelné důvody chyb. Neobsahují obsah nahrávky ani technické detaily. */
export const ERROR_LABELS: Record<string, string> = {
  calendar_unavailable: "Google Kalendář je dočasně nedostupný. Změna je ve Wiki uložená, Wiki ji odešle sama.",
  calendar_revoked: "Přístup ke Kalendáři byl odvolán. Připoj integraci znovu.",
  calendar_forbidden: "Google tuto změnu odmítl, přístup ke Kalendáři ale platí. Wiki to zkusí znovu, při opakování zkontroluj účet organizátora.",
  calendar_no_access: "Připojený účet Google nemá přístup ke kalendáři, do kterého Wiki zapisuje. Nic se neodeslalo.",
  external_change: "Pozvánku někdo upravil přímo v Google Kalendáři. Zkontroluj rozdíl a rozhodni, co platí.",
  calendar_missing: "Propojená pozvánka v Kalendáři už neexistuje. Vazbu je potřeba opravit.",
  attendee_not_allowed: "Pozvánka by šla na adresu mimo povolené testovací příjemce. Nic se neodeslalo.",
  calendar_not_allowed: "Kalendář není na seznamu povolených. Nic se nezapsalo.",
  calendar_series_master: "Vazba míří na celou opakovanou sérii. Wiki mění jen jeden výskyt, spáruj konkrétní termín.",
  calendar_not_organizer: "Originál pozvánky vlastní jiný účet. Připoj účet, který pozvánku založil, nebo založ novou pozvánku.",
  calendar_not_configured: "Testovací režim Google Kalendáře nemá úplnou konfiguraci na serveru.",
  unsupported_fixture: "Přepis je zatím jen ukázka a umí jen ukázkovou nahrávku. Tento soubor nepřepíše.",
  transcription_unavailable: "Služba přepisu je dočasně nedostupná. Zkus přepis znovu.",
  invalid_output: "Návrh zápisu neprošel kontrolou formátu. Zkus přepis znovu.",
};

/**
 * Skupina, kterou už říká název typu („Trénink poradců“ = finanční poradci). U takové akce se skupina
 * vedle typu neopakuje. Ostatní typy (Action time, Portfolio tým…) skupinu v názvu nenesou.
 */
const AUDIENCE_IN_TYPE: Partial<Record<EventType, Group>> = {
  "training-fp": "fp",
  "education-fp": "fp",
  "training-rm": "rm",
  "education-rm": "rm",
};

/** Text pro porovnání: bez diakritiky, velikosti písmen a interpunkce. */
export function comparableText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function mentions(text: string, part: string): boolean {
  const haystack = ` ${comparableText(text)} `;
  const needle = comparableText(part);
  return needle !== "" && haystack.includes(` ${needle} `);
}

/**
 * Název akce „Typ: Téma“. Když jedna část obsahuje druhou („Trénink poradců: Trénink poradců – Q4“),
 * zobrazí se jen delší, aby se nic neopakovalo.
 */
export function eventTitle(label: string, topicTitle?: string | null): string {
  const topic = topicTitle?.trim() ?? "";
  if (!topic) return label;
  if (!label.trim() || mentions(topic, label)) return topic;
  if (mentions(label, topic)) return label;
  return `${label}: ${topic}`;
}

/**
 * Typ a skupina k názvu akce, ale jen to, co název ještě neříká. Jiná akce typ nemá, skupinu vynechá
 * i typ, který ji sám pojmenovává. Sdílí ho okna, karty, Zápisy a úkoly, aby se nikde neopakovalo
 * „Trénink poradců · Trénink poradců“. Bez skupiny vrací jen typ (kde skupinu ukazuje jiné pole).
 */
export function eventContext(title: string, type: EventType, audience?: Group): string[] {
  const parts: string[] = [];
  const typeLabel = TYPE_LABELS[type];
  if (type !== "other" && !mentions(title, typeLabel)) parts.push(typeLabel);
  if (audience && AUDIENCE_IN_TYPE[type] !== audience && !mentions(title, GROUP_LABELS[audience])) parts.push(GROUP_LABELS[audience]);
  return parts;
}
