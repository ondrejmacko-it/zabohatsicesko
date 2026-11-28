// Oslovení jménem v 5. pádě („Ahoj, Anno“). Jediné místo, odkud aplikace oslovení bere, aby bylo jednotné i po
// spojení s Moje ZBČ. Tvar se nehádá pravidly: zná ho jen malý slovník běžných křestních jmen. Neznámé jméno dostane
// neutrální „Ahoj“, protože špatně vyskloňované jméno působí hůř než pozdrav bez jména.

/** Křestní jméno v 1. pádě → 5. pád. Jen jména, kde je tvar jistý. */
const VOCATIVE: Record<string, string> = {
  // Ženská
  Adéla: "Adélo", Alena: "Aleno", Andrea: "Andreo", Anna: "Anno", Barbora: "Barboro", Blanka: "Blanko",
  Dagmar: "Dagmar", Dana: "Dano", Daniela: "Danielo", Denisa: "Deniso", Eliška: "Eliško", Eva: "Evo",
  Gabriela: "Gabrielo", Hana: "Hano", Helena: "Heleno", Ilona: "Ilono", Irena: "Ireno", Iveta: "Iveto",
  Ivana: "Ivano", Jana: "Jano", Jarmila: "Jarmilo", Jitka: "Jitko", Kamila: "Kamilo", Karolína: "Karolíno",
  Kateřina: "Kateřino", Klára: "Kláro", Kristýna: "Kristýno", Lenka: "Lenko", Lucie: "Lucie", Ludmila: "Ludmilo",
  Magdaléna: "Magdaléno", Marie: "Marie", Markéta: "Markéto", Martina: "Martino", Michaela: "Michaelo",
  Monika: "Moniko", Natálie: "Natálie", Nikola: "Nikolo", Olga: "Olgo", Pavla: "Pavlo", Petra: "Petro",
  Radka: "Radko", Renata: "Renato", Romana: "Romano", Sabina: "Sabino", Silvie: "Silvie", Simona: "Simono",
  Šárka: "Šárko", Tereza: "Terezo", Vendula: "Vendulo", Veronika: "Veroniko", Věra: "Věro", Zuzana: "Zuzano",
  // Mužská
  Adam: "Adame", Aleš: "Aleši", Antonín: "Antoníne", Bohumil: "Bohumile", Daniel: "Danieli", David: "Davide",
  Dominik: "Dominiku", Dušan: "Dušane", Erik: "Eriku", Filip: "Filipe", František: "Františku", Igor: "Igore",
  Ivan: "Ivane", Jakub: "Jakube", Jan: "Jane", Jaromír: "Jaromíre", Jaroslav: "Jaroslave", Jindřich: "Jindřichu",
  Jiří: "Jiří", Josef: "Josefe", Kamil: "Kamile", Karel: "Karle", Ladislav: "Ladislave", Libor: "Libore",
  Luboš: "Luboši", Lukáš: "Lukáši", Marek: "Marku", Martin: "Martine", Matěj: "Matěji", Matyáš: "Matyáši",
  Michal: "Michale", Milan: "Milane", Miroslav: "Miroslave", Oldřich: "Oldřichu", Ondřej: "Ondřeji",
  Patrik: "Patriku", Pavel: "Pavle", Petr: "Petře", Radek: "Radku", Richard: "Richarde", Robert: "Roberte",
  Roman: "Romane", Rostislav: "Rostislave", Stanislav: "Stanislave", Šimon: "Šimone", Štěpán: "Štěpáne",
  Tomáš: "Tomáši", Václav: "Václave", Viktor: "Viktore", Vít: "Víte", Vladimír: "Vladimíre", Vojtěch: "Vojtěchu",
  Zdeněk: "Zdeňku",
};

/**
 * Oslovení v 5. pádě, nebo null, když tvar není jistý. `preferred` je podoba, kterou si člověk nastavil sám
 * (zatím se nikde neukládá, viz docs/dalsi-session.md); má přednost před slovníkem.
 */
export function vocativeName(fullName: string | null | undefined, preferred?: string | null): string | null {
  const own = preferred?.normalize("NFC").trim();
  if (own) return own.slice(0, 40);
  const first = (fullName ?? "").normalize("NFC").trim().split(/\s+/)[0] ?? "";
  // „ANNA“ i „anna“ z importu účtů patří ke stejnému jménu; klíč slovníku je s velkým počátečním písmenem.
  const key = first.charAt(0).toLocaleUpperCase("cs") + first.slice(1).toLocaleLowerCase("cs");
  return VOCATIVE[key] ?? null;
}

/** Pozdrav na Úvodu: „Ahoj, Anno“, u neznámého tvaru jen „Ahoj“. */
export function greeting(fullName: string | null | undefined, preferred?: string | null): string {
  const name = vocativeName(fullName, preferred);
  return name ? `Ahoj, ${name}` : "Ahoj";
}
