import type { EventResponses } from "@/server/services/responses";

const ROWS = [
  { key: "accepted", label: "Přijalo" },
  { key: "tentative", label: "Možná" },
  { key: "declined", label: "Odmítlo" },
  { key: "waiting", label: "Čeká" },
] as const;

/** Krátký souhrn na kartu akce v Plánu. */
export const responsesSummary = (r: Pick<EventResponses, "accepted" | "total">) => `${r.accepted.length} z ${r.total}`;

/** Kdo jak odpověděl na pozvánku v Kalendáři. Jen ke čtení, odpovědi mění každý host u sebe v Kalendáři. */
export function ResponsesBlock({ responses }: { responses: EventResponses }) {
  return (
    <section className="responses" aria-label="Odpovědi na pozvánku">
      <p className="responses-head">
        <strong>Přijalo {responsesSummary(responses)}</strong>
        <span>Odpovědi na pozvánku z Kalendáře</span>
      </p>
      <dl className="responses-list">
        {ROWS.filter((row) => responses[row.key].length > 0).map((row) => (
          <div key={row.key} className={`responses-${row.key}`}>
            <dt>
              {row.label} <span className="responses-count">{responses[row.key].length}</span>
            </dt>
            <dd>{responses[row.key].join(", ")}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
