import { config } from "@/server/config";

/**
 * Kam se má člověk vrátit po přihlášení, když přišel odkazem z pozvánky. Krátká cookie, platí 15 minut.
 * Nenese žádné oprávnění. Při čtení projde jen interní cesta modulu Vzdělávání, jinam přesměrovat nejde.
 */
export const RETURN_COOKIE = "zbc_navrat";

export const returnCookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 15 * 60,
};

const TOPIC_ID = /^[A-Za-z0-9_-]{1,64}$/;
const INTERNAL_PATH = /^\/vzdelavani(?:[/?#][A-Za-z0-9\-._~/?#=&%]*)?$/;

/** Cesta z cookie, jen pokud míří dovnitř modulu Vzdělávání. Cizí adresa, `//` ani zpětné lomítko neprojdou. */
export function safeReturnPath(value: string | undefined): string | null {
  if (!value || value.length > 200 || value.includes("//") || !INTERNAL_PATH.test(value)) return null;
  return value;
}

/** Cíl odkazu „zájem o téma“ z pozvánky. Neplatné ID vede na běžný seznam témat. */
export function topicInterestPath(topicId: string | null): string {
  return topicId && TOPIC_ID.test(topicId) ? `/vzdelavani/zapisy?zajem=${topicId}#temata` : "/vzdelavani/zapisy#temata";
}
