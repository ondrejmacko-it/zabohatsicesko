import type { Metadata } from "next";
import Link from "next/link";
import { GROUP_LABELS, TYPE_LABELS } from "@/lib/labels";
import { TopicsSection } from "@/features/vzdelavani/components/TopicsSection";
import { formatDate, formatMonth, monthOf, toDateKey } from "@/lib/time";
import { GROUPS, type Group } from "@/lib/types";
import { requireUser } from "@/server/auth/session";
import { listPublishedMinutes } from "@/server/services/journey";

export const metadata: Metadata = { title: "Zápisy a témata" };

type SearchParams = Promise<{ q?: string; typ?: string; skupina?: string }>;

export default async function MinutesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const query = (params.q ?? "").slice(0, 80);
  // Nabídka filtrů vychází jen ze zápisů, které uživatel smí číst. Cizí skupiny ani typy neprozradí.
  const all = await listPublishedMinutes(user);
  const types = [...new Set(all.map((m) => m.type))];
  const groups = GROUPS.filter((g) => all.some((m) => m.audience === g));
  const type = types.find((t) => t === params.typ);
  const audience = groups.find((g: Group) => g === params.skupina);
  const filtered = query || type || audience ? await listPublishedMinutes(user, { query, type, audience }) : all;
  const filtering = Boolean(query || type || audience);
  // Zápisy jsou seřazené od nejnovější akce, stačí je rozdělit po měsících.
  const months = new Map<string, typeof filtered>();
  for (const item of filtered) {
    const month = monthOf(toDateKey(new Date(item.startsAt)));
    months.set(month, [...(months.get(month) ?? []), item]);
  }

  return (
    <>
    <section className="section" aria-labelledby="zapisy">
      <h2 id="zapisy">Zápisy</h2>
      <p className="lead-text">
        Shrnutí proběhlých akcí, které jsou určené vám: o čem to bylo, co se rozhodlo a co dál. Stejný zápis najdete i přímo u akce
        v Plánu.
      </p>

      {all.length > 0 && (
        <form className="filter-bar" method="get" role="search">
          <label className="field filter-grow">
            <span className="field-label">Hledat v zápisech</span>
            <input className="input" type="search" name="q" defaultValue={query} maxLength={80} placeholder="Téma, rozhodnutí, další krok…" />
          </label>
          {types.length > 1 && (
            <label className="field">
              <span className="field-label">Typ akce</span>
              <select className="select" name="typ" defaultValue={type ?? ""}>
                <option value="">Všechny typy</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {groups.length > 1 && (
            <label className="field">
              <span className="field-label">Skupina</span>
              <select className="select" name="skupina" defaultValue={audience ?? ""}>
                <option value="">Všechny skupiny</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {GROUP_LABELS[g]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="row">
            <button className="btn btn-primary" type="submit">
              Hledat
            </button>
            {filtering && (
              <Link className="btn" href="/vzdelavani/zapisy">
                Zrušit filtr
              </Link>
            )}
          </div>
        </form>
      )}

      {filtering && (
        <p className="small muted" role="status">
          Nalezeno: {filtered.length} z {all.length}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p className="item-title">{filtering ? "Tomuto hledání neodpovídá žádný zápis." : "Zatím tu není žádný zápis."}</p>
          <p className="item-meta">
            {filtering
              ? "Zkuste jiné slovo nebo zrušte filtr."
              : "Zápis se objeví, jakmile ho vedoucí po skončení akce zkontroluje a zveřejní. Uvidíte jen zápisy z akcí pro své skupiny."}
          </p>
        </div>
      ) : (
        [...months].map(([month, items]) => (
          <div key={month} className="minutes-month">
            <h3 className="minutes-month-title">{formatMonth(month)}</h3>
            <ul className="card-list">
              {items.map((m) => (
                <li key={m.eventId}>
                  <Link className="item-card" href={`/vzdelavani/akce/${m.eventId}?odkud=zapisy#zapis`}>
                    <p className="eyebrow">
                      {formatDate(toDateKey(new Date(m.startsAt)))} · {TYPE_LABELS[m.type]} · {GROUP_LABELS[m.audience]}
                    </p>
                    <p className="item-title">{m.title}</p>
                    <p className="item-meta clamp">{m.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
    <TopicsSection user={user} />
    </>
  );
}
