// Vyhodnocení plného `npm audit --json` proti schváleným výjimkám (scripts/audit-vyjimky.json).
// Projde jen nález, který je celý tvořen schválenými a platnými výjimkami. Jakýkoli jiný advisory
// od úrovně moderate, neplatná výjimka nebo chyba samotného auditu CI zastaví.

export type AuditException = { advisory: string; balicek: string; platiDo: string; issue: string; duvod: string };

type Advisory = { id: string; packageName: string; severity: string; title: string };

export type AuditVerdict = {
  ok: boolean;
  /** Tolerované nálezy (známé výjimky), pro report v CI. */
  tolerated: Advisory[];
  /** Důvody zastavení CI. */
  errors: string[];
};

const BLOCKING = new Set(["moderate", "high", "critical"]);

function advisoryId(url: unknown): string | null {
  const match = typeof url === "string" ? /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i.exec(url) : null;
  return match ? match[0] : null;
}

/** `today` ve tvaru RRRR-MM-DD. Výjimka platí včetně dne `platiDo`. */
export function evaluateAudit(raw: string, exceptions: AuditException[], today: string): AuditVerdict {
  const fail = (error: string): AuditVerdict => ({ ok: false, tolerated: [], errors: [error] });
  let report: unknown;
  try {
    report = JSON.parse(raw);
  } catch {
    return fail("Výstup npm audit není platný JSON (audit selhal), nález nejde posoudit.");
  }
  if (!report || typeof report !== "object") return fail("Výstup npm audit je prázdný.");
  const data = report as { error?: unknown; auditReportVersion?: unknown; vulnerabilities?: unknown };
  if (data.error) return fail("npm audit skončil chybou (např. registr nedostupný), nález nejde posoudit.");
  if (data.auditReportVersion !== 2 || !data.vulnerabilities || typeof data.vulnerabilities !== "object") {
    return fail("Neznámý formát výstupu npm audit, nález nejde posoudit.");
  }

  const advisories = new Map<string, Advisory>();
  const entries = Object.entries(data.vulnerabilities as Record<string, { severity?: string; via?: unknown[] }>);
  for (const [, vuln] of entries) {
    for (const via of vuln.via ?? []) {
      if (typeof via === "string") continue; // tranzitivní odkaz na jiný zranitelný balíček
      const v = via as { url?: unknown; name?: unknown; severity?: unknown; title?: unknown; source?: unknown };
      const id = advisoryId(v.url) ?? `npm-${String(v.source)}`;
      advisories.set(`${id}|${String(v.name)}`, { id, packageName: String(v.name), severity: String(v.severity), title: String(v.title ?? "") });
    }
  }
  if (entries.length && !advisories.size) return fail("npm audit hlásí zranitelné balíčky bez advisory, nález nejde posoudit.");

  const tolerated: Advisory[] = [];
  const errors: string[] = [];
  for (const adv of advisories.values()) {
    if (!BLOCKING.has(adv.severity)) continue;
    const exception = exceptions.find((e) => e.advisory.toLowerCase() === adv.id.toLowerCase() && e.balicek === adv.packageName);
    if (!exception) errors.push(`Neposouzená zranitelnost ${adv.id} (${adv.packageName}, ${adv.severity}): ${adv.title}`);
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.platiDo) || exception.platiDo < today) {
      errors.push(`Výjimka pro ${adv.id} (${adv.packageName}) vypršela ${exception.platiDo}, je potřeba ji znovu posoudit.`);
    } else tolerated.push(adv);
  }
  return { ok: errors.length === 0, tolerated, errors };
}
