import { like } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BUG_SIZE, BUG_TAB_WIDTH, DEFAULT_BUG_DOCK, moveBugDock, parseBugDock, placeBug, serializeBugDock, snapBugDock } from "@/lib/bug-dock";
import { FEEDBACK_REPORTS_PER_HOUR, screenshotAllowed, type FeedbackDraft } from "@/lib/feedback";
import { feedbackWebhook } from "@/server/config";
import { getDb } from "@/server/db/client";
import { rateLimits } from "@/server/db/schema";
import { detectScreenshotMime, FEEDBACK_SECRET_HEADER, parseFeedbackDraft, submitFeedbackCore, type FeedbackServerFacts } from "@/server/feedback";

const SECRET = "test-jen-pro-unit-test-0000000000000000";
const webhook = { url: "https://hook.example.invalid/zpetna-vazba", secret: SECRET };

const draft = (patch: Partial<FeedbackDraft> = {}): FeedbackDraft => ({
  submissionId: crypto.randomUUID(),
  type: "bug",
  text: "  Tlačítko Uložit nic neudělá.  ",
  expected: "Mělo by uložit akci.",
  marks: [{ kind: "element", description: "tlačítko „Uložit“ v sekci „Akce“", selector: "form > button.btn", box: { x: 10, y: 20, width: 80, height: 30 } }],
  screenshot: null,
  context: { path: "/vzdelavani/harmonogram", viewport: { width: 1280, height: 800 }, pixelRatio: 2 },
  ...patch,
});

const facts = (patch: Partial<FeedbackServerFacts> = {}): FeedbackServerFacts => ({
  id: "00000000-0000-4000-8000-000000000001",
  createdAt: "2026-11-20T10:00:00Z",
  appVersion: "abc1234",
  userAgent: "Vitest",
  wikiMode: "demo",
  reporter: { userId: "demo-organizator", role: "organizer", signedInWith: "demo" },
  preview: null,
  ...patch,
});

const webp = () => new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50])], { type: "image/webp" });

type Sent = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

function fakeFetch(status = 200) {
  const sent: Sent[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) });
    return new Response(null, { status });
  });
  return { sent, impl: impl as unknown as typeof fetch };
}

async function submit(d: FeedbackDraft, options: { status?: number; screenshot?: Blob | null; facts?: Partial<FeedbackServerFacts>; configured?: boolean } = {}) {
  const fetchFake = fakeFetch(options.status);
  const result = await submitFeedbackCore(
    { draftJson: JSON.stringify(d), screenshot: options.screenshot ?? null, facts: facts(options.facts) },
    { db: await getDb(), webhook: options.configured === false ? null : webhook, fetchImpl: fetchFake.impl },
  );
  return { result, sent: fetchFake.sent };
}

beforeEach(async () => {
  await (await getDb()).delete(rateLimits).where(like(rateLimits.key, "feedback%"));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("zpětná vazba: validace konceptu", () => {
  test("platný koncept projde a text se ořízne", () => {
    expect(parseFeedbackDraft(JSON.stringify(draft()))?.text).toBe("Tlačítko Uložit nic neudělá.");
  });

  test("nečitelný, prázdný nebo cizí koncept se odmítne", () => {
    expect(parseFeedbackDraft("{")).toBeNull();
    expect(parseFeedbackDraft(42)).toBeNull();
    expect(parseFeedbackDraft(JSON.stringify(draft({ text: "   " })))).toBeNull();
    expect(parseFeedbackDraft(JSON.stringify({ ...draft(), reporter: "podvrh" }))).toBeNull();
    expect(parseFeedbackDraft(JSON.stringify(draft({ context: { path: "//jinde.example", viewport: { width: 1, height: 1 }, pixelRatio: 1 } })))).toBeNull();
    // „Co by mělo fungovat jinak“ jen u chyby.
    expect(parseFeedbackDraft(JSON.stringify(draft({ type: "idea", expected: "něco" })))).toBeNull();
    expect(parseFeedbackDraft(JSON.stringify(draft({ marks: Array.from({ length: 11 }, () => draft().marks[0]!) })))).toBeNull();
  });

  test("snímek na Správě a Integracích server nepřijme", () => {
    expect(screenshotAllowed("/sprava")).toBe(false);
    expect(screenshotAllowed("/sprava/uzivatele")).toBe(false);
    expect(screenshotAllowed("/vzdelavani/integrace")).toBe(false);
    expect(screenshotAllowed("/spravany")).toBe(true);
    const shot = { mime: "image/webp" as const, width: 10, height: 10 };
    expect(parseFeedbackDraft(JSON.stringify(draft({ screenshot: shot, context: { ...draft().context, path: "/sprava" } })))).toBeNull();
    expect(parseFeedbackDraft(JSON.stringify(draft({ screenshot: shot })))).not.toBeNull();
  });

  test("typ snímku se pozná podle bajtů", () => {
    expect(detectScreenshotMime(new Uint8Array(webp().size).fill(0))).toBeNull();
    expect(detectScreenshotMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectScreenshotMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull();
  });
});

describe("zpětná vazba: odeslání do Make.com", () => {
  test("bez nastaveného webhooku se nic neodešle a vrátí not_configured", async () => {
    const { result, sent } = await submit(draft(), { configured: false });
    expect(result).toEqual({ ok: false, reason: "not_configured" });
    expect(sent).toHaveLength(0);
  });

  test("konfigurace: jen https nebo http na localhost, tajemství aspoň 32 znaků", () => {
    const run = (url: string, secret: string) => {
      vi.stubEnv("FEEDBACK_WEBHOOK_URL", url);
      vi.stubEnv("FEEDBACK_WEBHOOK_SECRET", secret);
      const value = feedbackWebhook();
      vi.unstubAllEnvs();
      return value;
    };
    expect(run("https://hook.eu1.make.com/abc", SECRET)?.url).toBe("https://hook.eu1.make.com/abc");
    expect(run("http://127.0.0.1:3312/hook", SECRET)).not.toBeNull();
    expect(run("http://hook.eu1.make.com/abc", SECRET)).toBeNull();
    expect(run("https://user:heslo@hook.eu1.make.com/abc", SECRET)).toBeNull();
    expect(run("https://hook.eu1.make.com/abc", "kratke")).toBeNull();
    expect(run("", SECRET)).toBeNull();
  });

  test("payload nese tajemství v hlavičce, Pohled a roli, ale ne jméno ani e-mail", async () => {
    const { result, sent } = await submit(draft(), { facts: { preview: { key: "skupina-fp", label: "Finanční poradci" } } });
    expect(result).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe(webhook.url);
    expect(sent[0]!.headers[FEEDBACK_SECRET_HEADER]).toBe(SECRET);
    const body = sent[0]!.body as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body).toMatchObject({ schemaVersion: 1, source: "zbc-wiki", type: "bug", text: "Tlačítko Uložit nic neudělá.", screenshot: null });
    expect(body.context).toMatchObject({ path: "/vzdelavani/harmonogram", wikiMode: "demo", appVersion: "abc1234", preview: { key: "skupina-fp", label: "Finanční poradci" } });
    expect(body.reporter).toEqual({ ref: expect.stringMatching(/^[0-9a-f]{32}$/), role: "organizer", signedInWith: "demo" });
    const text = JSON.stringify(body);
    expect(text).not.toContain("demo-organizator");
    expect(text).not.toMatch(/@|email|name/i);
  });

  test("snímek se pošle jako base64 jen s odpovídajícím popisem a typem", async () => {
    const shot = { mime: "image/webp" as const, width: 10, height: 10 };
    const ok = await submit(draft({ screenshot: shot }), { screenshot: webp() });
    expect(ok.result).toEqual({ ok: true });
    expect((ok.sent[0]!.body.screenshot as { base64: string }).base64).toBe(Buffer.from(await webp().arrayBuffer()).toString("base64"));

    expect((await submit(draft({ screenshot: shot }))).result).toEqual({ ok: false, reason: "invalid" });
    expect((await submit(draft(), { screenshot: webp() })).result).toEqual({ ok: false, reason: "invalid" });
    expect((await submit(draft({ screenshot: { ...shot, mime: "image/jpeg" } }), { screenshot: webp() })).result).toEqual({ ok: false, reason: "invalid" });
    const huge = new Blob([new Uint8Array(600_000)]);
    expect((await submit(draft({ screenshot: shot }), { screenshot: huge })).result).toEqual({ ok: false, reason: "invalid" });
  });

  test("totéž hlášení podruhé neprojde, po chybě doručení ale jde zopakovat", async () => {
    const d = draft();
    const failed = await submit(d, { status: 500 });
    expect(failed.result).toEqual({ ok: false, reason: "failed" });
    expect(failed.sent).toHaveLength(1);
    const retried = await submit(d);
    expect(retried.result).toEqual({ ok: true });
    const again = await submit(d);
    expect(again.result).toEqual({ ok: false, reason: "duplicate" });
    expect(again.sent).toHaveLength(0);
  });

  test(`limit ${FEEDBACK_REPORTS_PER_HOUR} hlášení za hodinu na účet`, async () => {
    for (let i = 0; i < FEEDBACK_REPORTS_PER_HOUR; i += 1) expect((await submit(draft())).result).toEqual({ ok: true });
    const blocked = await submit(draft());
    expect(blocked.result).toEqual({ ok: false, reason: "rate_limited" });
    expect(blocked.sent).toHaveLength(0);
    // Jiný účet limit nesdílí.
    expect((await submit(draft(), { facts: { reporter: { userId: "demo-vedouci", role: "member", signedInWith: "demo" } } })).result).toEqual({ ok: true });
  });

  test("výpadek sítě vrátí failed a do logu jde jen kód", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await submitFeedbackCore(
      { draftJson: JSON.stringify(draft()), screenshot: null, facts: facts() },
      { db: await getDb(), webhook, fetchImpl: (async () => { throw new Error("ECONNRESET Tlačítko Uložit"); }) as unknown as typeof fetch },
    );
    expect(result).toEqual({ ok: false, reason: "failed" });
    expect(JSON.stringify(errors.mock.calls)).not.toContain("Tlačítko Uložit");
  });
});

describe("brouček: poloha", () => {
  const viewport = { width: 1280, height: 800 };

  test("uložená poloha se načte, nečitelná znamená výchozí", () => {
    const dock = { side: "left" as const, y: 0.3, mode: "tucked" as const };
    expect(parseBugDock(serializeBugDock(dock))).toEqual(dock);
    expect(parseBugDock("nesmysl")).toEqual(DEFAULT_BUG_DOCK);
    expect(parseBugDock(null)).toEqual(DEFAULT_BUG_DOCK);
  });

  test("přichycení k bližšímu okraji a šipky", () => {
    expect(snapBugDock({ x: 100, y: 400 }, viewport)).toEqual({ side: "left", y: 0.5 });
    expect(snapBugDock({ x: 1200, y: 0 }, viewport)).toEqual({ side: "right", y: 0.05 });
    expect(moveBugDock(DEFAULT_BUG_DOCK, "ArrowLeft")?.side).toBe("left");
    expect(moveBugDock(DEFAULT_BUG_DOCK, "ArrowUp")?.y).toBeCloseTo(0.83);
    expect(moveBugDock(DEFAULT_BUG_DOCK, "Enter")).toBeNull();
  });

  test("brouček uhne hlavní akci, a když není kam, vykoukne jen jazýček", () => {
    const free = placeBug(DEFAULT_BUG_DOCK, BUG_SIZE, viewport, []);
    expect(free).toMatchObject({ left: 1280 - BUG_SIZE - 16, peek: false });
    const button = { left: 1150, top: free.top - 10, right: 1270, bottom: free.top + 40 };
    const moved = placeBug(DEFAULT_BUG_DOCK, BUG_SIZE, viewport, [button]);
    expect(moved.peek).toBe(false);
    expect(moved.top + BUG_SIZE <= button.top || moved.top >= button.bottom).toBe(true);
    const wall = Array.from({ length: 20 }, (_, i) => ({ left: 1100, top: i * 40, right: 1280, bottom: i * 40 + 38 }));
    expect(placeBug(DEFAULT_BUG_DOCK, BUG_SIZE, viewport, wall)).toMatchObject({ left: 1280 - BUG_TAB_WIDTH, peek: true });
  });

  test("vlevo obejde vysoké levé menu", () => {
    const sidebar = { left: 0, top: 0, right: 240, bottom: 800 };
    expect(placeBug({ side: "left", y: 0.5 }, BUG_SIZE, viewport, [sidebar]).left).toBe(256);
  });
});
