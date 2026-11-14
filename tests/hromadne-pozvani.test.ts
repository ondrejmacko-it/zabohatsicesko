import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { users } from "@/server/db/schema";
import { inviteUser, inviteUsers, parseInviteList, previewBulkInvite } from "@/server/services/users";
import { admin, lead, organizer, participant, resetDemo } from "./helpers";

// Hromadné pozvání: stejná oprávnění a validace jako pozvání jednoho kolegy, chyby po řádcích.

const LIST = "Jana Nová <Jana.Nova@gmail.test>\npetr.svoboda2@gmail.test; neni-adresa\njana.nova@gmail.test\n\nstara@gmail.test";

describe("hromadné pozvání", () => {
  let db: Awaited<ReturnType<typeof resetDemo>>;
  beforeEach(async () => {
    db = await resetDemo();
  });

  test("seznam se rozebere po řádcích: jméno, neplatná adresa i duplicita s číslem řádku", () => {
    expect(parseInviteList(LIST).map((r) => [r.line, r.email, r.name, r.status])).toEqual([
      [1, "jana.nova@gmail.test", "Jana Nová", "ok"],
      [2, "petr.svoboda2@gmail.test", "Petr Svoboda", "ok"],
      [2, null, "", "invalid"],
      [3, "jana.nova@gmail.test", "Jana Nova", "duplicate"],
      [5, "stara@gmail.test", "Stara", "ok"],
    ]);
  });

  test("přehled označí adresu, která už ve Wiki je, a nic nezapíše", async () => {
    await inviteUser(admin, { email: "stara@gmail.test", name: "Stará Známá", role: "member", groups: ["vsichni"] });
    const rows = await previewBulkInvite(admin, LIST, "member");
    expect(rows.map((r) => r.status)).toEqual(["ok", "ok", "invalid", "duplicate", "existing"]);
    expect(await db.select().from(users).where(eq(users.origin, "invite"))).toHaveLength(1);
  });

  test("uložení pozve jen platné adresy se zvolenou rolí a skupinami", async () => {
    await inviteUser(admin, { email: "stara@gmail.test", name: "Stará Známá", role: "member", groups: ["vsichni"] });
    const rows = await inviteUsers(organizer, { text: LIST, role: "member", groups: ["vsichni", "fp"] });
    expect(rows.filter((r) => r.status === "ok").map((r) => r.email)).toEqual(["jana.nova@gmail.test", "petr.svoboda2@gmail.test"]);
    const invited = await db.select().from(users).where(eq(users.email, "jana.nova@gmail.test"));
    expect(invited[0]).toMatchObject({ name: "Jana Nová", role: "member", groups: ["vsichni", "fp"], status: "active", origin: "invite" });
    // Druhé odeslání téhož seznamu nikoho nezdvojí.
    expect((await inviteUsers(admin, { text: LIST, role: "member", groups: ["vsichni"] })).some((r) => r.status === "ok")).toBe(false);
  });

  test("člen týmu ani vedoucí akce hromadně zvát nesmí, ani si seznam nechat vyhodnotit", async () => {
    for (const viewer of [lead, participant]) {
      await expect(previewBulkInvite(viewer, LIST, "member")).rejects.toMatchObject({ code: "forbidden" });
      await expect(inviteUsers(viewer, { text: LIST, role: "member", groups: ["vsichni"] })).rejects.toMatchObject({ code: "forbidden" });
    }
    expect(await db.select().from(users).where(eq(users.origin, "invite"))).toHaveLength(0);
  });

  test("delší seznam než 50 adres server odmítne celý", async () => {
    const long = Array.from({ length: 51 }, (_, i) => `kolega${i}@gmail.test`).join("\n");
    await expect(inviteUsers(admin, { text: long, role: "member", groups: ["vsichni"] })).rejects.toMatchObject({ code: "invalid_input" });
  });
});
