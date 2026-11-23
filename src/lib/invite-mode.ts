import { GROUP_LABELS } from "@/lib/labels";
import type { Group } from "@/lib/types";

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
      return `${invites} se odesílá${many ? "jí" : ""} jen na testovací adresy. Stav uvidíš u akce.`;
    case "audience":
      return `${invites} se odesílá${many ? "jí" : ""} přes Google Kalendář. Stav uvidíš u akce.`;
  }
}

const people = (n: number) => `${n} ${n === 1 ? "člověk" : n >= 2 && n <= 4 ? "lidé" : "lidí"}`;

/**
 * Koho zveřejnění návrhů pozve, podle režimu pozvánek a skupin vybraných návrhů. Stejná věta v okně
 * Připravit měsíc i při zveřejnění jednoho návrhu z menu karty.
 */
export function publishInviteNote(mode: InviteMode, audiences: Group[], recipients: Record<Group, Array<{ email: string }>>): string {
  const invited = new Set(audiences.flatMap((g) => recipients[g].map((r) => r.email)));
  switch (mode) {
    case "simulation":
      return "Simulace: skutečné e-maily se neodesílají.";
    case "disconnected":
      return "Pozvánky počkají na propojení Kalendáře.";
    case "allowlist":
      return `Pozvánky jen na testovací adresu (${[...invited].join(", ") || "žádná"}), kolegům ne.`;
    case "audience":
      return `Po zveřejnění dostane e-mail s pozvánkou od Googlu ${people(invited.size)}: ${audiences.map((g) => `${GROUP_LABELS[g]} (${recipients[g].length})`).join(", ")}.`;
  }
}
