import { describe, expect, test } from "vitest";
import { invitationTask } from "@/features/vzdelavani/invitations";
import type { Invitation } from "@/server/calendar/rsvp";

// Pozvánky bez odpovědi na Úvodu jako jeden úkol „Čeká na tebe“.
const item = (over: Partial<Invitation>): Invitation => ({
  eventId: "ev-1",
  title: "Trénink RM",
  startsAt: "2026-11-18T07:30:00Z",
  status: "needsAction",
  urgent: false,
  ...over,
});

describe("úkol z pozvánek", () => {
  test("bez pozvánek, s vyřízenými nebo s neověřeným stavem úkol není", () => {
    expect(invitationTask(null)).toBeNull();
    expect(invitationTask({ items: [], organizerEmail: null, verified: true })).toBeNull();
    expect(invitationTask({ items: [item({ status: "accepted" }), item({ status: "declined" })], organizerEmail: null, verified: true })).toBeNull();
    expect(invitationTask({ items: [item({ status: "unknown" })], organizerEmail: null, verified: false })).toBeNull();
  });

  test("více pozvánek: počet, nejbližší akce a odkaz do Gmailu v novém okně", () => {
    const task = invitationTask({
      items: [item({ urgent: true }), item({ eventId: "ev-2", title: "Portfolio tým" }), item({ eventId: "ev-3", status: "accepted" })],
      organizerEmail: "organizator@example.invalid",
      verified: true,
    })!;
    expect(task.title).toBe("Odpověz na pozvánky (2)");
    // Odznak Čeká na tebe počítá obě pozvánky, ne jeden úkol.
    expect(task.count).toBe(2);
    expect(task.detail).toContain("Nejbližší: Trénink RM, 18. 11. v 08:30");
    expect(task).toMatchObject({ action: "Otevřít Gmail", external: true, newTab: true, urgent: true });
    expect(task.href).toContain("mail.google.com");
  });

  test("simulace bez adresy organizátora: úkol bez tlačítka", () => {
    const task = invitationTask({ items: [item({})], organizerEmail: null, verified: true })!;
    expect(task.title).toBe("Odpověz na pozvánku");
    expect(task.href).toBeUndefined();
    expect(task.urgent).toBe(false);
  });
});
