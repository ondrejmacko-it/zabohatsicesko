/**
 * Údaj, který zatím chybí. V celé Wiki vypadá stejně (menší, kurzívou, okrově), aby se nepletl se
 * skutečnými hodnotami: ty mají zůstat to nejvýraznější na řádku.
 */
export function Todo({ children }: { children: React.ReactNode }) {
  return <span className="todo">{children}</span>;
}

/** Kdo plán spravuje, čte výzvu k doplnění. Ostatní jen to, že údaj zatím není. */
export const missingText = (managing: boolean, what: "vedoucího" | "téma") => (managing ? `doplnit ${what}` : "zatím neurčeno");
