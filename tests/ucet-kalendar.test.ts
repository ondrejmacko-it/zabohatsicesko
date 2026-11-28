import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { PersonalCalendarState } from "@/server/calendar/personal";
import { AccountCalendar } from "@/features/vzdelavani/components/PersonalCalendarStatus";

// Bod 8: sekce Google Kalendář v menu Účet ukazuje stav vždy. Ruční synchronizace jen u funkčního
// propojení, jinak vede náprava přes propojení Kalendáře.
const base: PersonalCalendarState = { status: "active", accountEmail: "ucastnik@example.invalid", syncedAt: null, retrying: false, blocked: false };
const render = (state: PersonalCalendarState) => renderToStaticMarkup(createElement(AccountCalendar, { state }));

describe("menu Účet: sekce Google Kalendář", () => {
  test("propojený kalendář: stav Propojeno a tlačítko Synchronizovat teď", () => {
    const html = render(base);
    expect(html).toContain("Propojeno");
    expect(html).toContain("Synchronizovat teď");
    expect(html).toContain("ucastnik@example.invalid");
    expect(html).not.toContain("<a ");
  });

  test("nepropojený kalendář: stav a odkaz na propojení, bez synchronizace", () => {
    const html = render({ ...base, status: "none", accountEmail: null });
    expect(html).not.toContain("Synchronizovat teď");
    expect(html).toMatch(/<a [^>]*href="[^"]+"/);
  });

  test("odvolaný přístup: varování a odkaz na nové propojení", () => {
    const html = render({ ...base, status: "revoked" });
    expect(html).toContain("badge-danger");
    expect(html).not.toContain("Synchronizovat teď");
    expect(html).toMatch(/<a [^>]*href=/);
  });
});
