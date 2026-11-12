import { googleCalendarConfig } from "@/server/config";
import { DEMO_CALENDAR_ID } from "@/server/seed";

/** Kalendář, do kterého Wiki zakládá nové vazby: v testovacím režimu Googlu nastavený, jinak simulovaný. */
export function targetCalendarId(): string {
  return googleCalendarConfig()?.calendarId ?? DEMO_CALENDAR_ID;
}
