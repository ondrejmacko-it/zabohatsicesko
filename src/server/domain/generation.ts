import { addDays, daysInMonth, isoWeekNumber, isoWeekday } from "@/lib/time";
import { TYPE_LABELS } from "@/lib/labels";
import type { EventType, Group } from "@/lib/types";

export type TemplateSlot = {
  isoWeekday: number;
  startTime: string;
  endTime: string;
  types: string[];
  active: boolean;
};

export type PlannedSlot = {
  generationKey: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  type: EventType;
  label: string;
  audience: Group;
  holiday: boolean;
};

/**
 * Klíč návrhu = organizace + slot šablony + původní výskyt. Přesunutá nebo ručně upravená akce
 * si klíč ponechá, takže ji další generování nezdvojí.
 */
export function generationKey(orgId: string, weekday: number, dateKey: string): string {
  return `${orgId}:slot-${weekday}:${dateKey}`;
}

const DEFAULT_AUDIENCE: Partial<Record<EventType, Group>> = {
  action: "tym-a",
  "training-fp": "fp",
  portfolio: "fp",
  "education-fp": "fp",
  "training-rm": "rm",
  "education-rm": "rm",
};

export function defaultAudience(type: EventType): Group {
  return DEFAULT_AUDIENCE[type] ?? "vsichni";
}

/** Velikonoční neděle (anonymní gregoriánský algoritmus). */
function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const FIXED_HOLIDAYS = ["01-01", "05-01", "05-08", "07-05", "07-06", "09-28", "10-28", "11-17", "12-24", "12-25", "12-26"];

/** Státní svátky ČR. Vznikne z nich viditelný záznam v plánu, nikdy pozvánka. */
export function czechHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  return new Set([
    ...FIXED_HOLIDAYS.map((md) => `${year}-${md}`),
    addDays(easter, -2),
    addDays(easter, 1),
  ]);
}

/**
 * Návrh měsíce ze šablony. Vrací jen sloty, které ještě nemají akci ani výjimku,
 * takže opakované generování doplní chybějící místa a ruční úpravy nechá být.
 * Střídání typů ve slotu se řídí lichým/sudým ISO týdnem, správce ho může kdykoli přepsat.
 */
export function planMonth(
  orgId: string,
  monthKey: string,
  slots: TemplateSlot[],
  takenKeys: ReadonlySet<string>,
): PlannedSlot[] {
  const year = Number(monthKey.slice(0, 4));
  const holidays = czechHolidays(year);
  const byWeekday = new Map(slots.filter((s) => s.active && s.types.length).map((s) => [s.isoWeekday, s]));
  const planned: PlannedSlot[] = [];

  for (const dateKey of daysInMonth(monthKey)) {
    const weekday = isoWeekday(dateKey);
    const slot = byWeekday.get(weekday);
    if (!slot) continue;
    const key = generationKey(orgId, weekday, dateKey);
    if (takenKeys.has(key)) continue;

    if (holidays.has(dateKey)) {
      planned.push({
        generationKey: key, dateKey, startTime: "00:00", endTime: "00:00",
        type: "holiday", label: TYPE_LABELS.holiday, audience: "vsichni", holiday: true,
      });
      continue;
    }
    const type = slot.types[isoWeekNumber(dateKey) % slot.types.length] as EventType;
    planned.push({
      generationKey: key, dateKey, startTime: slot.startTime, endTime: slot.endTime,
      type, label: TYPE_LABELS[type], audience: defaultAudience(type), holiday: false,
    });
  }
  return planned;
}
