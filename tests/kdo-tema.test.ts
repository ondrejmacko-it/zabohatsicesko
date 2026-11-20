import { describe, expect, test } from "vitest";
import { cardDetails, hiddenMissingDetails } from "@/features/vzdelavani/status";
import type { EventCard } from "@/server/services/events";

const card = (over: Partial<EventCard> = {}): EventCard => ({
  id: "x",
  type: "education-fp",
  label: "Firemní vzdělávání FP",
  topicTitle: null,
  startsAt: "2026-12-01T09:00:00.000Z",
  endsAt: "2026-12-01T10:00:00.000Z",
  allDay: false,
  audience: "fp",
  leadName: null,
  planStatus: "published",
  unpublishedChanges: false,
  extraordinary: false,
  past: false,
  syncStatus: null,
  movedFrom: null,
  original: null,
  revision: null,
  handler: false,
  minutesPublished: false,
  ...over,
});

const text = (c: EventCard, managing: boolean) => cardDetails(c, managing).map((d) => `${d.label}: ${d.value}`);

describe("kolonky Kdo a Téma na kartě harmonogramu", () => {
  test("vyplněné údaje vidí správce i účastník stejně", () => {
    const filled = card({ leadName: "Vašek", topicTitle: "Rozbor schůzky" });
    for (const managing of [true, false]) {
      expect(text(filled, managing)).toEqual(["Kdo: Vašek", "Téma: Rozbor schůzky"]);
      expect(cardDetails(filled, managing).every((d) => !d.missing)).toBe(true);
    }
  });

  test("nevyplněné: správce „— doplnit“, účastník „Bude upřesněno“", () => {
    expect(text(card(), true)).toEqual(["Kdo: — doplnit", "Téma: — doplnit"]);
    expect(text(card(), false)).toEqual(["Kdo: Bude upřesněno", "Téma: Bude upřesněno"]);
    expect(cardDetails(card({ leadName: "Vašek" }), false)).toEqual([
      { label: "Kdo", value: "Vašek", missing: false },
      { label: "Téma", value: "Bude upřesněno", missing: true },
    ]);
  });

  test("svátek a zrušená akce kolonky nemají", () => {
    for (const managing of [true, false]) {
      expect(cardDetails(card({ type: "holiday", label: "Státní svátek" }), managing)).toEqual([]);
      expect(cardDetails(card({ planStatus: "cancelled", leadName: "Vašek", topicTitle: "Rozbor" }), managing)).toEqual([]);
    }
  });

  test("téma shodné s názvem akce se nezdvojuje", () => {
    const same = card({ label: "Rozbor schůzky", topicTitle: " rozbor schůzky ", leadName: "Vašek" });
    expect(text(same, true)).toEqual(["Kdo: Vašek"]);
    expect(text(same, false)).toEqual(["Kdo: Vašek"]);
  });

  test("proběhlá akce: účastník prázdná pole nevidí, správce ano", () => {
    const past = card({ past: true, topicTitle: "Rozbor schůzky" });
    expect(text(past, false)).toEqual(["Téma: Rozbor schůzky"]);
    expect(text(past, true)).toEqual(["Kdo: — doplnit", "Téma: Rozbor schůzky"]);
  });

  test("Action time: Kdo vždy, Téma jen vyplněné", () => {
    const action = card({ type: "action", label: "Action time", leadName: "Vašek" });
    expect(text(action, true)).toEqual(["Kdo: Vašek"]);
    expect(text(action, false)).toEqual(["Kdo: Vašek"]);
    expect(text(card({ type: "action", label: "Action time" }), false)).toEqual(["Kdo: Bude upřesněno"]);
    expect(text({ ...action, topicTitle: "Telefonáty" }, false)).toEqual(["Kdo: Vašek", "Téma: Telefonáty"]);
  });

  test("návrh a mimořádná akce kolonky mají", () => {
    expect(text(card({ planStatus: "draft", topicTitle: "Hypotéky" }), true)).toEqual(["Kdo: — doplnit", "Téma: Hypotéky"]);
    expect(text(card({ type: "workshop", label: "AI workshop", extraordinary: true, leadName: "Eva" }), false)).toEqual([
      "Kdo: Eva",
      "Téma: Bude upřesněno",
    ]);
  });
});

describe("výstraha na kartě jen pro chybějící údaj, který karta neukazuje (A-04)", () => {
  test("řádky „— doplnit“ už problém hlásí, výstraha se neopakuje", () => {
    expect(hiddenMissingDetails(card(), true)).toEqual([]);
    expect(hiddenMissingDetails(card({ leadName: "Vašek" }), true)).toEqual([]);
  });

  test("Action time bez tématu řádek Téma nemá, výstraha zůstává", () => {
    expect(hiddenMissingDetails(card({ type: "action", leadName: "Vašek" }), true)).toEqual(["téma"]);
  });

  test("účastník výstrahu nikdy nedostane", () => {
    expect(hiddenMissingDetails(card({ type: "action" }), false)).toEqual([]);
  });
});
