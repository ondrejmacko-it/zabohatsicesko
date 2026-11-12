import { refresh } from "next/cache";
import { z } from "zod";
import { logError } from "@/server/audit";
import { getCurrentUser, type CurrentUser } from "@/server/auth/session";
import { DOMAIN_ERROR_MESSAGES, DomainError } from "@/server/services/errors";

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };

/**
 * Společný obal serverových akcí: znovu načte session (role z databáze), převede doménové chyby
 * a chyby validace na srozumitelnou zprávu a ostatní zapíše do logu jen kódem.
 */
export async function runAction(task: (user: CurrentUser) => Promise<ActionResult>): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Přihlášení vypršelo. Načtěte stránku a vstupte znovu." };
  try {
    const result = await task(user);
    refresh();
    return result;
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: DOMAIN_ERROR_MESSAGES[error.code] };
    if (error instanceof z.ZodError) return { ok: false, error: DOMAIN_ERROR_MESSAGES.invalid_input };
    logError("action", "unexpected", error);
    return { ok: false, error: "Akci se nepodařilo dokončit. Zkuste to prosím znovu." };
  }
}
