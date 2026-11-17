import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { evaluateAudit, type AuditException } from "../scripts/audit-vyjimky";

const { vyjimky } = JSON.parse(readFileSync("scripts/audit-vyjimky.json", "utf8")) as { vyjimky: AuditException[] };
const TODAY = "2026-11-18";

const advisory = (url: string, name: string, severity: string) => ({ source: 1, name, title: "test", url, severity, range: "*" });
const PICOMATCH = advisory("https://github.com/advisories/GHSA-fc5q-39xc-vjpf", "picomatch", "high");
// Zkrácený skutečný tvar výstupu `npm audit --json` (verze 2) z 18. 11. 2026.
const report = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    auditReportVersion: 2,
    vulnerabilities: {
      picomatch: { name: "picomatch", severity: "high", via: [PICOMATCH] },
      micromatch: { name: "micromatch", severity: "high", via: ["picomatch"] },
      vitest: { name: "vitest", severity: "high", via: ["picomatch", "vite"] },
      ...extra,
    },
    metadata: {},
  });

describe("plný npm audit se schválenými výjimkami", () => {
  test("známá výjimka GHSA-fc5q-39xc-vjpf projde a je reportovaná", () => {
    const verdict = evaluateAudit(report(), vyjimky, TODAY);
    expect(verdict.ok).toBe(true);
    expect(verdict.tolerated.map((t) => t.id)).toEqual(["GHSA-fc5q-39xc-vjpf"]);
  });

  test("audit bez nálezu projde", () => {
    expect(evaluateAudit(JSON.stringify({ auditReportVersion: 2, vulnerabilities: {}, metadata: {} }), vyjimky, TODAY)).toEqual({ ok: true, tolerated: [], errors: [] });
  });

  test("jiná zranitelnost od moderate CI zastaví i vedle známé výjimky", () => {
    for (const severity of ["moderate", "high", "critical"]) {
      const verdict = evaluateAudit(report({ lodash: { name: "lodash", severity, via: [advisory("https://github.com/advisories/GHSA-aaaa-bbbb-cccc", "lodash", severity)] } }), vyjimky, TODAY);
      expect(verdict.ok).toBe(false);
      expect(verdict.errors.join()).toContain("GHSA-aaaa-bbbb-cccc");
    }
  });

  test("nízká závažnost (low) CI nezastaví", () => {
    expect(evaluateAudit(report({ x: { name: "x", severity: "low", via: [advisory("https://github.com/advisories/GHSA-aaaa-bbbb-cccc", "x", "low")] } }), vyjimky, TODAY).ok).toBe(true);
  });

  test("stejný advisory v jiném balíčku výjimka nekryje", () => {
    const verdict = evaluateAudit(report({ jiny: { name: "jiny", severity: "high", via: [advisory("https://github.com/advisories/GHSA-fc5q-39xc-vjpf", "jiny", "high")] } }), vyjimky, TODAY);
    expect(verdict.ok).toBe(false);
  });

  test("výjimka po datu platnosti CI zastaví", () => {
    const verdict = evaluateAudit(report(), vyjimky, "2027-01-01");
    expect(verdict.ok).toBe(false);
    expect(verdict.errors.join()).toContain("vypršela");
  });

  test("chyba samotného auditu není povolená zranitelnost", () => {
    for (const raw of ["", "není json", JSON.stringify({ error: { code: "ENOTFOUND", summary: "registr nedostupný" } }), JSON.stringify({ auditReportVersion: 1 }), JSON.stringify({ auditReportVersion: 2, vulnerabilities: { a: { severity: "high", via: ["b"] } } })]) {
      expect(evaluateAudit(raw, vyjimky, TODAY).ok).toBe(false);
    }
  });
});
