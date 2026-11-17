/**
 * Co se po zveřejnění stane s pozvánkami. Hlášky po uložení a zveřejnění podle toho říkají pravdu:
 * simulace nic neodesílá, bez propojení pozvánky čekají, testovací režim zve jen povolené adresy.
 */
export type InviteMode = "simulation" | "allowlist" | "audience" | "disconnected";

export function inviteModeOf(status: { mode: "simulation" | "google"; connection: unknown; attendeeSource: "allowlist" | "audience" }): InviteMode {
  if (status.mode !== "google") return "simulation";
  if (!status.connection) return "disconnected";
  return status.attendeeSource;
}

/** Věta za „Zveřejněno ve Wiki.“ Zveřejnění samo pozvánky jen zařadí, stav odeslání ukáže detail akce. */
export function inviteOutcome(mode: InviteMode, many = false): string {
  const invites = many ? "Pozvánky" : "Pozvánka";
  switch (mode) {
    case "simulation":
      return "Pozvánky jsou v této ukázce jen simulované, žádný e-mail neodešel.";
    case "disconnected":
      return `${invites} zatím neodešl${many ? "y" : "a"}, čeká${many ? "jí" : ""} na propojení Kalendáře.`;
    case "allowlist":
      return `${invites} se odesílá${many ? "jí" : ""} jen na testovací adresy. Stav uvidíte u akce.`;
    case "audience":
      return `${invites} se odesílá${many ? "jí" : ""} přes Google Kalendář. Stav uvidíte u akce.`;
  }
}
