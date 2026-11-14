import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { confirmDevice, createAccess, decodeDevice, encodeDevice, openAccessLink, redeemCode, trustedDevice } from "@/server/auth/access-links";
import { encodeSession, readSession, resolveSessionUser } from "@/server/auth/session";
import { accessLinks } from "@/server/db/schema";
import { DomainError } from "@/server/services/errors";
import { inviteUser, updateAccess } from "@/server/services/users";
import { admin, participant, resetDemo } from "./helpers";

const tokenOf = (link: string) => link.split("/pozvanka/")[1]!;
const invite = () => inviteUser(admin, { email: "nova.kolegyne@example.com", name: "Nová Kolegyně", role: "member", groups: ["vsichni", "fp"] });

beforeEach(resetDemo);

describe("vstup na pozvánku", () => {
  test("osobní odkaz smí vytvořit jen správce a v databázi je jen otisk", async () => {
    const db = await resetDemo();
    const id = await invite();
    await expect(createAccess(participant, id, false)).rejects.toThrow(DomainError);
    const created = await createAccess(admin, id, true);
    const rows = await db.select().from(accessLinks).where(eq(accessLinks.userId, id));
    expect(rows.map((r) => r.kind).sort()).toEqual(["code", "link"]);
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain(tokenOf(created.link));
    expect(stored).not.toContain(created.code!.replace("-", ""));
  });

  test("odkaz otevře přihlášení jen svému člověku, platí do prvního přihlášení a nový ruší starý", async () => {
    const db = await resetDemo();
    const id = await invite();
    const first = await createAccess(admin, id, false);
    const second = await createAccess(admin, id, false);
    expect(await openAccessLink(db, tokenOf(first.link))).toBeNull();
    expect(await openAccessLink(db, "neexistujici-odkaz-1234567890")).toBeNull();
    const opened = (await openAccessLink(db, tokenOf(second.link)))!;
    expect(opened.userId).toBe(id);

    // Dvě zařízení otevřela tentýž odkaz: přihlásí se jen první, druhé už přihlášení neuvidí.
    const cookie = encodeDevice(opened.userId, opened.linkId);
    const device = (await trustedDevice(db, cookie))!;
    const kept = (await confirmDevice(db, device))!;
    expect(await confirmDevice(db, device)).toBeNull();
    expect(await trustedDevice(db, cookie)).toBeNull();
    expect(await openAccessLink(db, tokenOf(second.link))).toBeNull();
    expect((await trustedDevice(db, kept))?.userId).toBe(id);

    // Odebraný přístup zavře přihlášení i zapamatovanému zařízení.
    await updateAccess(admin, id, { role: "member", groups: ["vsichni"], status: "disabled" });
    expect(await trustedDevice(db, kept)).toBeNull();
  });

  test("cookie zařízení nejde podvrhnout ani použít po vypršení", () => {
    const cookie = encodeDevice("u-1");
    expect(decodeDevice(cookie)?.userId).toBe("u-1");
    expect(decodeDevice(`${cookie.split(".")[0]}.podvrh`)).toBeNull();
    expect(decodeDevice(encodeDevice("u-1", undefined, 100), 200)).toBeNull();
    expect(decodeDevice(undefined)).toBeNull();
    // Session cookie se jako cookie zařízení nepřijme.
    expect(decodeDevice(encodeSession("u-1"))).toBeNull();
  });

  test("jednorázový kód platí jednou, jen svému člověku, a session drží 30 dní", async () => {
    const db = await resetDemo();
    const id = await invite();
    const created = await createAccess(admin, id, true);
    const opened = (await openAccessLink(db, tokenOf(created.link)))!;
    const device = { userId: opened.userId, exp: 0, linkId: opened.linkId };
    expect(await redeemCode(db, { userId: "demo-ucastnik", exp: 0 }, created.code!)).toBe(false);
    expect(await redeemCode(db, device, "AAAAA-AAAAA")).toBe(false);
    expect(await redeemCode(db, device, created.code!.toLowerCase())).toBe(true);
    expect(await redeemCode(db, device, created.code!)).toBe(false);

    const now = 1_800_000_000;
    const session = encodeSession(id, now, "code");
    expect(readSession(session, now + 29 * 86400)).toEqual({ userId: id, method: "code" });
    expect(readSession(session, now + 31 * 86400)).toBeNull();
    expect(readSession(encodeSession(id, now, "google"), now + 13 * 3600)).toBeNull();
    expect((await resolveSessionUser(db, { userId: id, method: "code" }))?.signedInWith).toBe("code");
  });

  describe("režim GATE_MODE=invite", () => {
    beforeAll(() => {
      process.env.GATE_MODE = "invite";
    });
    afterAll(() => {
      delete process.env.GATE_MODE;
    });
    test("session fiktivní role při vstupu na pozvánku neplatí", async () => {
      const db = await resetDemo();
      expect(await resolveSessionUser(db, { userId: "demo-spravce", method: "demo" })).toBeNull();
    });
  });
});
