// Veškeré kalendářní výpočty probíhají v Europe/Prague. Datum bez času se předává jako
// řetězec "YYYY-MM-DD" (dateKey), aby nevznikaly posuny přes UTC.

export const TIME_ZONE = "Europe/Prague";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function pragueParts(date: Date) {
  const map: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(date)) map[part.type] = part.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateKey(date: Date): string {
  const p = pragueParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function toTimeKey(date: Date): string {
  const p = pragueParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

function offsetMs(instant: number): number {
  const p = pragueParts(new Date(instant));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(instant / 60_000) * 60_000;
}

/** Převede místní pražské datum a čas na okamžik. Zohledňuje letní čas. */
export function fromPragueLocal(dateKey: string, time: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let instant = naive - offsetMs(naive);
  instant = naive - offsetMs(instant);
  return new Date(instant);
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidMonthKey(value: string): boolean {
  return /^(20[2-3]\d)-(0[1-9]|1[0-2])$/.test(value);
}

function keyToUtc(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function utcToKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(dateKey: string, days: number): string {
  const date = keyToUtc(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return utcToKey(date);
}

/** 1 = pondělí … 7 = neděle */
export function isoWeekday(dateKey: string): number {
  return keyToUtc(dateKey).getUTCDay() || 7;
}

export function isoWeekNumber(dateKey: string): number {
  const date = keyToUtc(dateKey);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

export function monthOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

export function daysInMonth(monthKey: string): string[] {
  const days: string[] = [];
  for (let day = `${monthKey}-01`; monthOf(day) === monthKey; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Týdny (po–ne), které zasahují do měsíce. */
export function monthWeeks(monthKey: string): string[][] {
  const first = `${monthKey}-01`;
  let monday = addDays(first, 1 - isoWeekday(first));
  const weeks: string[][] = [];
  while (monthOf(monday) <= monthKey) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
    monday = addDays(monday, 7);
  }
  return weeks;
}

/** Rozsah měsíce jako okamžiky [start, end) v pražském čase. */
export function monthRange(monthKey: string): { start: Date; end: Date } {
  return {
    start: fromPragueLocal(`${monthKey}-01`, "00:00"),
    end: fromPragueLocal(`${shiftMonth(monthKey, 1)}-01`, "00:00"),
  };
}

const MONTH_NAMES = [
  "leden", "únor", "březen", "duben", "květen", "červen",
  "červenec", "srpen", "září", "říjen", "listopad", "prosinec",
];
const WEEKDAY_SHORT = ["po", "út", "st", "čt", "pá", "so", "ne"];
const WEEKDAY_LONG = ["pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota", "neděle"];

export function formatMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number) as [number, number];
  const name = MONTH_NAMES[m - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

export function formatDayMonth(dateKey: string): string {
  const [, m, d] = dateKey.split("-").map(Number);
  return `${d}. ${m}.`;
}

export function weekdayShort(dateKey: string): string {
  return WEEKDAY_SHORT[isoWeekday(dateKey) - 1] ?? "";
}

export function weekdayLong(dateKey: string): string {
  return WEEKDAY_LONG[isoWeekday(dateKey) - 1] ?? "";
}

/** „čt 12. 11. 2026“ */
export function formatDate(dateKey: string): string {
  return `${weekdayShort(dateKey)} ${formatDayMonth(dateKey)} ${dateKey.slice(0, 4)}`;
}

/** „2.–6. 11.“ pro týden; při přechodu měsíce „30. 11.–4. 12.“ */
export function formatRange(fromKey: string, toKey: string): string {
  const [, fm, fd] = fromKey.split("-").map(Number);
  const [, tm, td] = toKey.split("-").map(Number);
  return fm === tm ? `${fd}.–${td}. ${tm}.` : `${fd}. ${fm}.–${td}. ${tm}.`;
}

/** Čas akce. Vícedenní akce ukáže i dny, celodenní jen datum. */
export function formatEventTime(startsAt: Date, endsAt: Date, allDay: boolean): string {
  const startDay = toDateKey(startsAt);
  const lastDay = allDay ? addDays(toDateKey(endsAt), -1) : toDateKey(endsAt);
  if (allDay) return startDay === lastDay ? "celý den" : formatRange(startDay, lastDay);
  if (startDay === lastDay) return `${toTimeKey(startsAt)}–${toTimeKey(endsAt)}`;
  return `${formatDayMonth(startDay)} ${toTimeKey(startsAt)} – ${formatDayMonth(lastDay)} ${toTimeKey(endsAt)}`;
}
