import { like } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BUG_SIZE, BUG_TAB_WIDTH, DEFAULT_BUG_DOCK, moveBugDock, parseBugDock, placeBug, serializeBugDock, snapBugDock } from "@/lib/bug-dock";
import { FEEDBACK_REPORTS_PER_HOUR, FEEDBACK_SHOT_PAGES, feedbackMarkIsStructural, type FeedbackDraft } from "@/lib/feedback";
import { feedbackWebhook } from "@/server/config";
import { getDb } from "@/server/db/client";
import { rateLimits } from "@/server/db/schema";
import { detectScreenshotMime, FEEDBACK_SECRET_HEADER, parseFeedbackDraft, readScreenshotSize, submitFeedbackCore, type FeedbackServerFacts } from "@/server/feedback";
import { sameMark } from "@/components/feedback/MarkingLayer";
import { clonedTextIsSingleLine } from "@/components/feedback/screenshot";
import { issueShotGrant, SHOT_GRANT_TTL_SEC, shotGrantValid } from "@/server/feedback-grant";

const SECRET = "test-jen-pro-unit-test-0000000000000000";
const webhook = { url: "https://hook.example.invalid/zpetna-vazba", secret: SECRET };
const GRANT_SECRET = "jen-pro-unit-test-podpis-snimku-000000000";
const grant = (userId = "demo-organizator", page: (typeof FEEDBACK_SHOT_PAGES)[number] = "/vzdelavani/harmonogram") => issueShotGrant(GRANT_SECRET, userId, page);

const draft = (patch: Partial<FeedbackDraft> = {}): FeedbackDraft => ({
  submissionId: crypto.randomUUID(),
  type: "bug",
  text: "  Tlačítko Uložit nic neudělá.  ",
  expected: "Mělo by uložit akci.",
  marks: [{ kind: "element", description: "Tlačítko ve formuláři", selector: "main > form > button:nth-of-type(2)", box: { x: 10, y: 20, width: 80, height: 30 } }],
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

/** Hlavička WebP (VP8X) s rozměry. Obsah obrázku server nedekóduje, čte jen hlavičku. */
function webpBytes(width = 10, height = 10): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(40);
  bytes.set([0x52, 0x49, 0x46, 0x46, 32, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0]);
  const w = width - 1;
  const h = height - 1;
  bytes.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 24);
  return bytes;
}
const webp = (width = 10, height = 10) => new Blob([webpBytes(width, height)], { type: "image/webp" });

/** JPEG: SOI, APP0 a SOF0 s rozměry. */
function jpegBytes(width: number, height: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xff, 0xc4, 0, 4, 0, 0,
    0xff, 0xc0, 0, 17, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1,
  ]);
}

type Sent = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

function fakeFetch(status = 200) {
  const sent: Sent[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) });
    return new Response(null, { status });
  });
  return { sent, impl: impl as unknown as typeof fetch };
}

type SubmitOptions = { status?: number; screenshot?: Blob | null; grant?: unknown; facts?: Partial<FeedbackServerFacts>; configured?: boolean };

async function submit(d: FeedbackDraft, options: SubmitOptions = {}) {
  const fetchFake = fakeFetch(options.status);
  const screenshot = options.screenshot ?? null;
  const result = await submitFeedbackCore(
    { draftJson: JSON.stringify(d), screenshot, screenshotGrant: "grant" in options ? options.grant : screenshot ? grant() : null, facts: facts(options.facts) },
    { db: await getDb(), webhook: options.configured === false ? null : webhook, fetchImpl: fetchFake.impl, grantSecret: GRANT_SECRET },
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

  test("značka smí nést jen strukturální popis a selektor ze značek", () => {
    const mark = draft().marks[0]!;
    expect(feedbackMarkIsStructural(mark)).toBe(true);
    expect(feedbackMarkIsStructural({ kind: "element", description: "Karta v harmonogramu", selector: null })).toBe(true);
    expect(feedbackMarkIsStructural({ kind: "rect", description: "Označená oblast", selector: null })).toBe(true);
    // Fiktivní citlivé řetězce: text tlačítka, jméno, číslo karty, třída, id a atribut v selektoru.
    for (const description of ["Tlačítko „Smazat Jana Nováka“", "Tlačítko v okně 4111 1111 1111 1111", "tlačítko", "Označená oblast"]) {
      expect(feedbackMarkIsStructural({ kind: "element", description, selector: null })).toBe(false);
    }
    expect(feedbackMarkIsStructural({ kind: "rect", description: "Označená oblast", selector: "main" })).toBe(false);
    for (const selector of ["form > button.btn", "#jan-novak", "div[data-name='Jan']", "main > div:nth-of-type(0)", "a > b > c > d > e > f > g > h > i", "main >  div", ""]) {
      expect(feedbackMarkIsStructural({ kind: "element", description: "Tlačítko", selector })).toBe(false);
    }
    expect(parseFeedbackDraft(JSON.stringify(draft({ marks: [{ ...mark, description: "Tlačítko „Jan Novák“" }] })))).toBeNull();
    expect(parseFeedbackDraft(JSON.stringify(draft({ marks: [{ ...mark, selector: "button[aria-label='Jan Novák']" }] })))).toBeNull();
  });

  test("povolení snímku: jen ověřená stránka, tentýž účet, platné a nepodvržené", () => {
    const nowSec = 1_800_000_000;
    const token = issueShotGrant(GRANT_SECRET, "u1", "/", nowSec);
    expect(shotGrantValid(GRANT_SECRET, token, "u1", nowSec)).toBe(true);
    expect(shotGrantValid(GRANT_SECRET, token, "u2", nowSec)).toBe(false);
    expect(shotGrantValid("jiny-klic-0000000000000000000000000000", token, "u1", nowSec)).toBe(false);
    expect(shotGrantValid(GRANT_SECRET, token, "u1", nowSec + SHOT_GRANT_TTL_SEC)).toBe(false);
    // Podvržená cesta se stejným podpisem neprojde, stejně jako stránka mimo seznam.
    const [, exp, signature] = token.split("|");
    expect(shotGrantValid(GRANT_SECRET, `/sprava|${exp}|${signature}`, "u1", nowSec)).toBe(false);
    expect(shotGrantValid(GRANT_SECRET, `/vzdelavani/harmonogram|${exp}|${signature}`, "u1", nowSec)).toBe(false);
    for (const bad of [null, 42, "", "/", "/||", `${token}|navic`, "x".repeat(500)]) expect(shotGrantValid(GRANT_SECRET, bad, "u1", nowSec)).toBe(false);
  });

  test("rozměry obrázku se čtou z hlavičky WebP i JPEG", () => {
    expect(readScreenshotSize(webpBytes(1280, 720), "image/webp")).toEqual({ width: 1280, height: 720 });
    expect(readScreenshotSize(jpegBytes(390, 844), "image/jpeg")).toEqual({ width: 390, height: 844 });
    const lossy = new Uint8Array(30);
    lossy.set([0x52, 0x49, 0x46, 0x46, 22, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
    lossy.set([0x9d, 0x01, 0x2a, 0x00, 0x05, 0xd0, 0x02], 23);
    expect(readScreenshotSize(lossy, "image/webp")).toEqual({ width: 1280, height: 720 });
    expect(readScreenshotSize(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 2]), "image/jpeg")).toBeNull();
    expect(readScreenshotSize(new Uint8Array(40), "image/webp")).toBeNull();
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

  test("snímek se pošle jako base64 jen s odpovídajícím popisem, typem, rozměry a povolením", async () => {
    const shot = { mime: "image/webp" as const, width: 10, height: 10 };
    const ok = await submit(draft({ screenshot: shot }), { screenshot: webp() });
    expect(ok.result).toEqual({ ok: true });
    const sentShot = ok.sent[0]!.body.screenshot as Record<string, unknown>;
    expect(sentShot.base64).toBe(Buffer.from(webpBytes()).toString("base64"));
    // Povolení je jen pro server, do Make.com nejde.
    expect(JSON.stringify(ok.sent[0]!.body)).not.toContain(grant().split("|")[2]!);

    const invalid = { ok: false, reason: "invalid" };
    expect((await submit(draft({ screenshot: shot }))).result).toEqual(invalid);
    expect((await submit(draft(), { screenshot: webp() })).result).toEqual(invalid);
    expect((await submit(draft({ screenshot: { ...shot, mime: "image/jpeg" } }), { screenshot: webp() })).result).toEqual(invalid);
    // Obsah neodpovídá popisu: jiné rozměry, nečitelná hlavička, příliš velký soubor nebo strana.
    expect((await submit(draft({ screenshot: shot }), { screenshot: webp(11, 10) })).result).toEqual(invalid);
    expect((await submit(draft({ screenshot: shot }), { screenshot: new Blob([webpBytes().slice(0, 20)]) })).result).toEqual(invalid);
    expect((await submit(draft({ screenshot: shot }), { screenshot: new Blob([new Uint8Array(600_000)]) })).result).toEqual(invalid);
    expect(parseFeedbackDraft(JSON.stringify(draft({ screenshot: { ...shot, width: 2001 } })))).toBeNull();
    // Bez povolení, s cizím nebo podvrženým povolením snímek neprojde, ani když klient tvrdí povolenou cestu.
    expect((await submit(draft({ screenshot: shot }), { screenshot: webp(), grant: null })).result).toEqual(invalid);
    expect((await submit(draft({ screenshot: shot }), { screenshot: webp(), grant: grant("demo-vedouci") })).result).toEqual(invalid);
    expect((await submit(draft({ screenshot: shot }), { screenshot: webp(), grant: grant().replace("/vzdelavani/harmonogram", "/sprava") })).result).toEqual(invalid);
    // Text bez snímku jde odeslat odkudkoli, i ze stránky bez povolení.
    expect((await submit(draft({ context: { ...draft().context, path: "/sprava" } }))).result).toEqual({ ok: true });
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

  test("vypršení času po odeslání: výsledek nejistý, klíč zůstane a opakování nevytvoří duplicitu", async () => {
    const d = draft();
    let calls = 0;
    const slow = (async () => {
      calls += 1;
      throw new DOMException("Make přijal, odpověď nedorazila", "TimeoutError");
    }) as unknown as typeof fetch;
    const deps = { db: await getDb(), webhook, fetchImpl: slow, grantSecret: GRANT_SECRET };
    const submission = { draftJson: JSON.stringify(d), screenshot: null, screenshotGrant: null, facts: facts() };
    expect(await submitFeedbackCore(submission, deps)).toEqual({ ok: false, reason: "uncertain" });
    expect(await submitFeedbackCore(submission, deps)).toEqual({ ok: false, reason: "duplicate" });
    expect(calls).toBe(1);
  });

  test("souběžné dvojí odeslání téhož konceptu projde do Make.com jen jednou", async () => {
    const d = draft();
    const fetchFake = fakeFetch();
    const deps = { db: await getDb(), webhook, fetchImpl: fetchFake.impl, grantSecret: GRANT_SECRET };
    const submission = { draftJson: JSON.stringify(d), screenshot: null, screenshotGrant: null, facts: facts() };
    const results = await Promise.all([submitFeedbackCore(submission, deps), submitFeedbackCore(submission, deps)]);
    expect(results).toContainEqual({ ok: true });
    expect(results).toContainEqual({ ok: false, reason: "duplicate" });
    expect(fetchFake.sent).toHaveLength(1);
  });

  test("výpadek sítě vrátí failed a do logu jde jen kód", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await submitFeedbackCore(
      { draftJson: JSON.stringify(draft()), screenshot: null, screenshotGrant: null, facts: facts() },
      { db: await getDb(), webhook, grantSecret: GRANT_SECRET, fetchImpl: (async () => { throw new Error("ECONNRESET Tlačítko Uložit"); }) as unknown as typeof fetch },
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

  test("na telefonu sedí vedle rychlých akcí Plánu ve stejném řádku, schovaný jazýček zůstává u okraje", () => {
    const phone = { width: 320, height: 800 };
    const bar = { left: 212, top: 738, right: 308, bottom: 788, beside: true };
    const placed = placeBug(DEFAULT_BUG_DOCK, 48, phone, [bar], { touch: true });
    expect(placed).toMatchObject({ left: 212 - 48 - 8, peek: false });
    expect(placed.top).toBeLessThan(bar.bottom);
    expect(placed.top + 48).toBeGreaterThan(bar.top);
    const tucked = placeBug(DEFAULT_BUG_DOCK, BUG_TAB_WIDTH, phone, [bar], { touch: true });
    expect(tucked.left).toBe(320 - BUG_TAB_WIDTH);
    const blocked = placeBug(DEFAULT_BUG_DOCK, 48, phone, [bar, { left: 100, top: 730, right: 210, bottom: 790 }], { touch: true });
    expect(blocked.left).toBe(320 - 48 - 12);
    expect(blocked.top + 48).toBeLessThanOrEqual(bar.top);
  });

  test("vlevo obejde vysoké levé menu", () => {
    const sidebar = { left: 0, top: 0, right: 240, bottom: 800 };
    expect(placeBug({ side: "left", y: 0.5 }, BUG_SIZE, viewport, [sidebar]).left).toBe(256);
  });
});

describe("zpětná vazba: snímek a značky na telefonu", () => {
  const style = (patch: Partial<Record<string, string>>) => ({ height: "20px", lineHeight: "20px", fontSize: "15px", boxSizing: "content-box", paddingTop: "0px", paddingBottom: "0px", borderTopWidth: "0px", borderBottomWidth: "0px", ...patch });

  test("jednořádkový text v kopii stránky se nezalamuje, víceřádkový ano", () => {
    expect(clonedTextIsSingleLine(style({}))).toBe(true);
    // Pilulka: border-box s odsazením, uvnitř jeden řádek.
    expect(clonedTextIsSingleLine(style({ height: "42px", boxSizing: "border-box", paddingTop: "10px", paddingBottom: "10px", borderTopWidth: "1px", borderBottomWidth: "1px" }))).toBe(true);
    expect(clonedTextIsSingleLine(style({ height: "40px" }))).toBe(false);
    expect(clonedTextIsSingleLine(style({ height: "19px", lineHeight: "normal" }))).toBe(true);
    expect(clonedTextIsSingleLine(style({ height: "auto" }))).toBe(false);
  });

  test("stejný prvek se neoznačí dvakrát, ani po posunu stránky; obdélníky se neslučují", () => {
    const element = { kind: "element" as const, description: "Tlačítko v záhlaví", selector: "header > button", box: { x: 10, y: 20, width: 30, height: 40 }, scroll: { x: 0, y: 0 } };
    expect(sameMark(element, { ...element })).toBe(true);
    expect(sameMark(element, { ...element, box: { ...element.box, y: 0 }, scroll: { x: 0, y: 20 } })).toBe(true);
    expect(sameMark(element, { ...element, selector: "header > a" })).toBe(false);
    expect(sameMark(element, { ...element, box: { ...element.box, width: 31 } })).toBe(false);
    const rect = { ...element, kind: "rect" as const, selector: null };
    expect(sameMark(rect, { ...rect })).toBe(false);
  });
});
