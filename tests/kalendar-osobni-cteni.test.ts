import { describe, expect, test } from "vitest";
import { PersonalCalendarApi } from "@/server/calendar/personal-api";
import { CalendarError } from "@/server/calendar/provider";

// Čtení událostí osobního kalendáře pro skript živého ověření: stránkování a chyby. Bez sítě.

type Page = { status?: number; items?: Array<{ id: string }>; nextPageToken?: string };

function fakeGoogle(pages: Page[]) {
  const requests: URL[] = [];
  const fetchImpl = (async (input: URL | string) => {
    const url = new URL(String(input));
    if (url.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "t", expires_in: 3600 });
    requests.push(url);
    const page = pages.shift() ?? { items: [] };
    return Response.json(page.status && page.status !== 200 ? { error: { status: "UNAVAILABLE" } } : page, { status: page.status ?? 200 });
  }) as typeof fetch;
  return { requests, api: new PersonalCalendarApi({ clientId: "c", clientSecret: "s", fetchImpl }, "refresh") };
}

describe("PersonalCalendarApi.listEvents", () => {
  test("projde všechny stránky a pošle pageToken", async () => {
    const { api, requests } = fakeGoogle([{ items: [{ id: "a" }, { id: "b" }], nextPageToken: "p2" }, { items: [{ id: "c" }] }]);
    expect((await api.listEvents("cal@group.calendar.google.com")).map((event) => event.id)).toEqual(["a", "b", "c"]);
    expect(requests).toHaveLength(2);
    const [first, second] = requests as [URL, URL];
    expect(first.pathname).toBe("/calendar/v3/calendars/cal%40group.calendar.google.com/events");
    expect(first.searchParams.get("showDeleted")).toBe("false");
    expect(first.searchParams.has("pageToken")).toBe(false);
    expect(second.searchParams.get("pageToken")).toBe("p2");
  });

  test("prázdný kalendář vrátí prázdný seznam", async () => {
    expect(await fakeGoogle([{}]).api.listEvents("cal")).toEqual([]);
  });

  test("smazaný kalendář (404) i výpadek (503) skončí chybou, ne prázdným výsledkem", async () => {
    await expect(fakeGoogle([{ status: 404 }]).api.listEvents("cal")).rejects.toBeInstanceOf(CalendarError);
    await expect(fakeGoogle([{ status: 503 }]).api.listEvents("cal")).rejects.toMatchObject({ code: "calendar_unavailable" });
  });
});
