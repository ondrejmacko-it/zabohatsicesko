import { monthOf, toDateKey } from "@/lib/time";

/**
 * Rozdělí zápisy po měsících konání akce, od nejnovějšího. Řadí podle zveřejněného termínu: výpis ze služby
 * je seřazený podle rozpracovaného termínu akce, který se od zveřejněného může lišit (návrh přesunu).
 * Měsíc se počítá v pražském čase, akce 31. 10. ve 23:30 patří do října.
 */
export function groupByMonth<T extends { startsAt: string }>(items: T[]): [month: string, items: T[]][] {
  const sorted = [...items].sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const months = new Map<string, T[]>();
  for (const item of sorted) {
    const month = monthOf(toDateKey(new Date(item.startsAt)));
    months.set(month, [...(months.get(month) ?? []), item]);
  }
  return [...months];
}
