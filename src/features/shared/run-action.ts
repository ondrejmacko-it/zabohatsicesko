import { refresh } from "next/cache";
import { z } from "zod";
import { logError, withinRateLimit } from "@/server/audit";
import { getCurrentUser, type CurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { DOMAIN_ERROR_MESSAGES, DomainError } from "@/server/services/errors";

/** `link` = zvací odkaz, který se ukáže jen jednou (Správa). */
export type ActionResult = { ok: true; message?: string; id?: string; link?: string } | { ok: false; error: string };

/**
 * Strop serverových akcí na uživatele. Člověk se k němu ani při rychlé práci nepřiblíží, zastaví ale
 * skript, který by akce volal ve smyčce. Nahrávky mají vlastní, přísnější limit.
 */
export const ACTION_LIMIT = { count: 120, windowSec: 60 };

/**
 * Společný obal serverových akcí: znovu načte session (role z databáze), pohlídá limit četnosti,
 * převede doménové chyby a chyby validace na srozumitelnou zprávu a ostatní zapíše do logu jen kódem.
 */
export async function runAction(task: (user: CurrentUser) => Promise<ActionResult>): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Přihlášení vypršelo. Načti stránku a vstup znovu." };
  try {
    if (!(await withinRateLimit(await getDb(), `action:${user.id}`, ACTION_LIMIT.count, ACTION_LIMIT.windowSec))) {
      return { ok: false, error: DOMAIN_ERROR_MESSAGES.rate_limited };
    }
    const result = await task(user);
    refresh();
    return result;
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: DOMAIN_ERROR_MESSAGES[error.code] };
    if (error instanceof z.ZodError) return { ok: false, error: DOMAIN_ERROR_MESSAGES.invalid_input };
    logError("action", "unexpected", error);
    return { ok: false, error: "Akci se nepodařilo dokončit. Zkus to prosím znovu." };
  }
}
