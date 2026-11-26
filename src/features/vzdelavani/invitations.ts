import { formatDayMonth, toDateKey, toTimeKey } from "@/lib/time";
import { gmailSearchHref, type InvitationsView } from "@/server/calendar/rsvp";
import type { TaskRow } from "./components/TasksCard";

/**
 * Pozvánky bez odpovědi jako jeden úkol v „Čeká na tebe“. Odpovídá se v e-mailu nebo v Google Kalendáři,
 * Wiki odpověď jen čte. Vyřízené pozvánky ani neověřený stav úkol nejsou, nic po uživateli nechtějí.
 */
export function invitationTask(view: InvitationsView | null): TaskRow | null {
  const open = (view?.items ?? []).filter((item) => item.status === "needsAction");
  if (!view || open.length === 0) return null;
  const first = open[0]!;
  const date = new Date(first.startsAt);
  const nearest = `${first.title}, ${formatDayMonth(toDateKey(date))} v ${toTimeKey(date)}`;
  return {
    key: "pozvanky",
    title: open.length === 1 ? "Odpověz na pozvánku" : `Odpověz na pozvánky (${open.length})`,
    detail: `${open.length === 1 ? "" : "Nejbližší: "}${nearest}. Odpověz v e-mailu s pozvánkou nebo v Google Kalendáři.`,
    // Vyhledávání podle odesílatele včetně Spamu. Odkaz na konkrétní zprávu Wiki nezná. V simulaci odkaz není.
    ...(view.organizerEmail ? { href: gmailSearchHref(view.organizerEmail), action: "Otevřít Gmail", external: true, newTab: true } : {}),
    urgent: open.some((item) => item.urgent),
    // Odznak Čeká na tebe počítá každou nezodpovězenou pozvánku zvlášť, stejně jako číslo v názvu.
    count: open.length,
  };
}
