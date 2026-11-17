import { formatDayMonth, toDateKey, toTimeKey } from "@/lib/time";
import type { WorkerAlert, WorkerHealth } from "@/server/calendar/worker";

// Stav pravidelného zpracování fronty Kalendáře ve Správě. Ukazuje se jen při problému,
// běžný provoz je jedna řádka s časem posledního běhu.

const when = (iso: string) => {
  const date = new Date(iso);
  return `${formatDayMonth(toDateKey(date))} v ${toTimeKey(date)}`;
};

const KIND_TEXT = {
  access: "Účet organizátora nesmí do Kalendáře zapisovat (odebraný přístup nebo odmítnutá operace). Připojte Kalendář znovu.",
  config: "Chybí nebo nesedí nastavení Kalendáře na serveru.",
  transient: "Google je dlouho nedostupný nebo hlásí limit. Wiki to dál zkouší sama.",
  data: "",
} as const;

/** Text upozornění. Samostatně kvůli testům. */
export function workerAlertText(alert: WorkerAlert): string {
  switch (alert.kind) {
    case "scheduler_never":
      return "Pravidelné zpracování ještě neproběhlo. Pozvánky se odešlou jen při zveřejnění a návštěvě Wiki. Nastavte plánovač (GitHub Actions), postup je v docs/kalendar-organizator.md.";
    case "scheduler_stale":
      return `Pravidelné zpracování naposledy proběhlo ${when(alert.lastSuccessAt)}. Plánovač mohl vypadnout nebo ho GitHub vypnul. Zkontrolujte workflow „Fronta Kalendáře“.`;
    case "queue":
      return `${alert.count} ${alert.count === 1 ? "akce čeká" : alert.count < 5 ? "akce čekají" : "akcí čeká"} na odeslání od ${when(alert.since)}. ${KIND_TEXT[alert.errorKind]}`;
    case "responses":
      return `Odpovědi pozvaných se nedaří načíst od ${when(alert.since)}. Na Úvodu se ukazují jako „stav nelze ověřit“.`;
  }
}

export function CalendarWorkerHealth({ health }: { health: WorkerHealth }) {
  const last = health.runs
    .map((r) => r.lastSuccessAt)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);
  if (!health.alerts.length) {
    return (
      <p className="small" data-testid="fronta-kalendare">
        Zpracování pozvánek: {last ? `naposledy ${when(last)}` : "zatím neproběhlo"}.
        {health.responsesSyncedAt ? ` Odpovědi pozvaných načteny ${when(health.responsesSyncedAt)}.` : ""}
      </p>
    );
  }
  return (
    <div className="cal-status cal-status-warn" role="status" data-testid="fronta-kalendare">
      <span className="cal-status-main">
        <strong>Zpracování pozvánek</strong>
        <span className="badge badge-ochre">Vyžaduje pozornost</span>
        <span className="cal-status-rest">{health.alerts.map(workerAlertText).join(" ")}</span>
      </span>
    </div>
  );
}
