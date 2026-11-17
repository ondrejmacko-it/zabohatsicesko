import { createHash, timingSafeEqual } from "node:crypto";
import { calendarWorkerTokens } from "@/server/config";

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

/**
 * Ověří `Authorization: Bearer <token>` plánovače. Porovnává otisky stejné délky v konstantním čase,
 * délka ani obsah tokenu tak z doby odpovědi nevyplyne. Bez nastaveného tokenu neprojde nic.
 */
export function workerRequestAuthorized(header: string | null): boolean {
  const match = /^Bearer (\S+)$/.exec(header ?? "");
  const tokens = calendarWorkerTokens();
  if (!match || !tokens.length) return false;
  const given = digest(match[1]!);
  // Projde všechny tokeny bez předčasného konce.
  return tokens.reduce((ok, token) => timingSafeEqual(given, digest(token)) || ok, false);
}
