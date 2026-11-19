import { describe, expect, test } from "vitest";
import type { EventSnapshot } from "@/lib/types";
import { changedParts } from "@/server/services/events";

const published: EventSnapshot = {
  type: "training-fp",
  label: "Trénink FP",
  topicTitle: "Pojištění",
  topicId: "t1",
  startsAt: "2026-12-01T15:00:00.000Z",
  endsAt: "2026-12-01T16:30:00.000Z",
  allDay: false,
  audience: "vsichni",
  leadId: "u1",
  reviewerId: null,
  status: "published",
  cancelReason: null,
};

describe("changedParts: co návrh mění proti zveřejněné verzi", () => {
  test("beze změny nic nehlásí", () => {
    expect(changedParts(published, published)).toEqual([]);
  });

  test("termín, téma i vedoucí v pořadí čtení karty", () => {
    const draft = { ...published, startsAt: "2026-12-02T15:00:00.000Z", endsAt: "2026-12-02T16:30:00.000Z", topicTitle: "Hypotéky", leadId: "u2" };
    expect(changedParts(draft, published)).toEqual(["termín", "téma", "vedoucí"]);
  });

  test("celodenní přepnutí je změna termínu, prázdné téma proti null není změna", () => {
    expect(changedParts({ ...published, allDay: true }, published)).toEqual(["termín"]);
    const noTopic = { ...published, topicTitle: null };
    expect(changedParts(noTopic, { ...noTopic })).toEqual([]);
  });

  test("publikum, typ (i jen popisek) a kontrolor", () => {
    expect(changedParts({ ...published, audience: "tym-a", label: "Jiný název", reviewerId: "u3" }, published)).toEqual(["publikum", "typ", "kontrolor"]);
  });
});
