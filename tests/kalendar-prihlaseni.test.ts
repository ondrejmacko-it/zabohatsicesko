import { beforeAll, describe, expect, test } from "vitest";
import { beginLogin, verifyLoginState } from "@/server/auth/google-login";
import { audienceAttendees, listRecipients } from "@/server/calendar/attendees";
import { loadCalendarStatus } from "@/server/services/calendar-status";
import { admin, organizer, participant, resetDemo } from "./helpers";

// Souhlas ke Kalendáři rovnou při přihlášení správce, příjemci pozvánek podle skupin a stav Kalendáře.

const CFG = { clientId: "client", clientSecret: "secret", redirectUri: "https://wiki.example.invalid/cb", accounts: new Map<string, string>() };
const CALENDAR = "https://www.googleapis.com/auth/calendar.events";

describe("žádost o Kalendář při přihlášení", () => {
  test("běžné přihlášení žádá jen identitu a nabízí výběr účtu", () => {
    const { url, cookieValue } = beginLogin(CFG);
    const query = new URL(url).searchParams;
    expect(query.get("scope")).toBe("openid email profile");
    expect(query.get("prompt")).toBe("select_account");
    expect(query.get("access_type")).toBeNull();
    expect(verifyLoginState(cookieValue, query.get("state"))?.calendar).toBe("later");
  });

  test("známý správce bez propojení dostane jednu obrazovku s Kalendářem a svým účtem", () => {
    const { url, cookieValue } = beginLogin(CFG, undefined, { calendar: "ask", loginHint: "spravce@example.com" });
    const query = new URL(url).searchParams;
    expect(query.get("scope")?.split(" ")).toEqual(["openid", "email", "profile", CALENDAR]);
    expect(query.get("access_type")).toBe("offline");
    expect(query.get("prompt")).toBe("consent");
    expect(query.get("login_hint")).toBe("spravce@example.com");
    expect(verifyLoginState(cookieValue, query.get("state"))?.calendar).toBe("ask");
  });

  test("přihlášení bez Kalendáře o rozsah nežádá a záměr nese podepsaný stav", () => {
    const { url, cookieValue } = beginLogin(CFG, undefined, { calendar: "skip", loginHint: "x@example.com" });
    const query = new URL(url).searchParams;
    expect(query.get("scope")).toBe("openid email profile");
    expect(query.get("login_hint")).toBeNull();
    expect(verifyLoginState(cookieValue, query.get("state"))?.calendar).toBe("skip");
    expect(verifyLoginState(cookieValue.replace(/.$/, "x"), query.get("state"))).toBeNull();
  });
});

describe("příjemci pozvánek a stav Kalendáře v simulaci", () => {
  let db: Awaited<ReturnType<typeof resetDemo>>;
  beforeAll(async () => {
    db = await resetDemo();
  });

  test("simulace zve jen fiktivní role ze skupiny akce", async () => {
    const all = await listRecipients(db, false);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((r) => r.email.endsWith("@example.invalid"))).toBe(true);
    const fp = await audienceAttendees(db, "fp");
    expect(fp.map((a) => a.email).sort()).toEqual(all.filter((r) => r.groups.includes("fp")).map((r) => r.email).sort());
  });

  test("v režimu Googlu fiktivní role bez svázaného účtu Google mezi příjemci nejsou", async () => {
    expect(await listRecipients(db, true)).toEqual([]);
  });

  test("stav Kalendáře vidí jen správce (obě hodnoty role)", async () => {
    for (const viewer of [organizer, admin]) {
      const status = await loadCalendarStatus(viewer);
      expect(status.mode).toBe("simulation");
      expect(status.connection).toBeNull();
      expect(status.recipients.fp.length).toBeGreaterThan(0);
    }
    await expect(loadCalendarStatus(participant)).rejects.toMatchObject({ code: "forbidden" });
  });
});
