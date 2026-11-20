import { createHmac, timingSafeEqual } from "node:crypto";
import { FEEDBACK_SHOT_PAGES, type FeedbackShotPage } from "@/lib/feedback";

/**
 * Povolení snímku obrazovky pro zpětnou vazbu. Server ho vydá jen na ověřených stránkách (`FEEDBACK_SHOT_PAGES`)
 * a jen přihlášenému uživateli. Při odeslání snímku ověří podpis, účet, platnost a stránku. Klientské
 * `context.path` tak o snímku nerozhoduje.
 *
 * Mez: obsah obrázku server zkontrolovat nemůže. Povolení jen dokládá, že uživatel měl otevřenou stránku,
 * na které je snímek bezpečný, a že snímek pořídilo okno Wiki, ne ruční podvrh cesty.
 */

export const SHOT_GRANT_TTL_SEC = 12 * 60 * 60;

const sign = (secret: string, data: string) => createHmac("sha256", secret).update(`feedback-shot:${data}`).digest("base64url");

const isShotPage = (page: string): page is FeedbackShotPage => (FEEDBACK_SHOT_PAGES as readonly string[]).includes(page);

/** Token `stránka|platnost|podpis`. Stránka je pevná hodnota ze seznamu, nic z URL ani z obsahu. */
export function issueShotGrant(secret: string, userId: string, page: FeedbackShotPage, nowSec = Math.floor(Date.now() / 1000)): string {
  const exp = nowSec + SHOT_GRANT_TTL_SEC;
  return `${page}|${exp}|${sign(secret, `${userId}|${page}|${exp}`)}`;
}

/** Platí povolení pro tohoto uživatele? Cokoli nečitelného, cizího nebo prošlého je `false`. */
export function shotGrantValid(secret: string, token: unknown, userId: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (typeof token !== "string" || token.length > 200) return false;
  const [page, expText, signature, ...rest] = token.split("|");
  if (rest.length > 0 || !page || !expText || !signature || !isShotPage(page) || !/^\d{1,12}$/.test(expText)) return false;
  const exp = Number(expText);
  if (exp <= nowSec || exp > nowSec + SHOT_GRANT_TTL_SEC) return false;
  const expected = Buffer.from(sign(secret, `${userId}|${page}|${exp}`));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
