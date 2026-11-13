import type { Metadata } from "next";
import Link from "next/link";
import { GROUP_LABELS, TYPE_LABELS } from "@/lib/labels";
import { Icon } from "@/components/Icon";
import { AddMinutesPicker, MinutesPeek } from "@/features/vzdelavani/components/MinutesPeek";
import { TopicsSection } from "@/features/vzdelavani/components/TopicsSection";
import { groupByMonth } from "@/features/vzdelavani/minutes";
import { formatDate, formatMonth, toDateKey } from "@/lib/time";
import { GROUPS, type Group } from "@/lib/types";
import { requireUser } from "@/server/auth/session";
import { isOrganizer } from "@/server/policy";
import { listMissingMinutes, listPublishedMinutes } from "@/server/services/journey";

export const metadata: Metadata = { title: "Zápisy a témata" };

type SearchParams = Promise<{ q?: string; typ?: string; skupina?: string; zapis?: string; pridat?: string }>;

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
  const months = groupByMonth(filtered);
  // Okna nad stránkou řídí adresa: hledání a filtry pod nimi zůstávají.
  const link = (change: { zapis?: string; pridat?: string } = {}) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries({ q: query, typ: type, skupina: audience, ...change })) if (value) search.set(key, value);
    const text = search.toString();
    return text ? `/vzdelavani/zapisy?${text}` : "/vzdelavani/zapisy";
  };
  const missing = await listMissingMinutes(user);
  const canAdd = isOrganizer(user) || missing.handlesAny;
  const peekId = (params.zapis ?? "").slice(0, 120);

  return (
    <>
    {peekId ? (
      <MinutesPeek key={peekId} user={user} eventId={peekId} closeHref={link()} />
    ) : (
      canAdd && params.pridat === "1" && <AddMinutesPicker items={missing.items} hrefFor={(id) => link({ zapis: id })} closeHref={link()} />
    )}
    <section className="section" aria-labelledby="zapisy">
      <div className="spread">
        <h2 id="zapisy">Zápisy</h2>
        {canAdd && (
          <Link className="btn btn-primary" href={link({ pridat: "1" })} scroll={false}>
            <Icon name="plus" /> Přidat zápis{missing.items.length > 0 && <span className="count-badge">{missing.items.length}</span>}
          </Link>
        )}
      </div>
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
        months.map(([month, items]) => (
          <div key={month} className="minutes-month">
            <h3 className="minutes-month-title">{formatMonth(month)}</h3>
            <ul className="card-list">
              {items.map((m) => (
                <li key={m.eventId}>
                  <Link className="item-card" href={link({ zapis: m.eventId })} scroll={false}>
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
