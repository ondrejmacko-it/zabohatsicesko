import { createHash, timingSafeEqual } from "node:crypto";

// Ověření plánovaných volání. Vercel Cron posílá tajemství `CRON_SECRET` v hlavičce Authorization.
// Bez nastaveného tajemství je cesta zavřená pro všechny, takže zapomenutá proměnná nic neotevře.

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Je požadavek od plánovače? Porovnává otisky v konstantním čase, hodnotu nikam nezapisuje. */
export function isCronRequest(authorization: string | null, secret: string | undefined = process.env.CRON_SECRET): boolean {
  const expected = secret?.trim() ?? "";
  if (expected.length < 16 || !authorization) return false;
  return timingSafeEqual(digest(authorization), digest(`Bearer ${expected}`));
}
