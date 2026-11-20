import { cookies } from "next/headers";
import { cache } from "react";
import { config } from "@/server/config";
import type { CurrentUser } from "@/server/auth/session";
import { resolvePreview, type PlanPreview } from "@/server/services/preview";

// Globální „Zobrazit jako“: klíč náhledu (skupina nebo kolega) drží HttpOnly cookie, ne adresa. Cookie nic
// neopravňuje: při každém požadavku se znovu ověří přes `resolvePreview` (jen správce, jen platný klíč) a je
// vázaná na účet, který ji zapnul. Skutečná identita, session ani serverové akce se náhledem nemění.

export const PREVIEW_COOKIE = "zbc_nahled";
/** Náhled vydrží nejvýš pracovní den, pak se sám vrátí na vlastní pohled. */
const PREVIEW_TTL_SEC = 12 * 60 * 60;

export const previewCookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: PREVIEW_TTL_SEC,
};

/** Mazání nese stejné atributy jako uložení (viz `expiredSessionCookieOptions`). */
export const expiredPreviewCookieOptions = { ...previewCookieOptions, maxAge: 0, expires: new Date(0) };

/** Hodnota cookie: id účtu, který náhled zapnul, a klíč náhledu. Jiný účet ji ignoruje. */
export function encodePreviewCookie(userId: string, key: string): string {
  return `${userId}|${key}`;
}

export function previewKeyFor(userId: string, value: string | undefined): string | undefined {
  if (!value) return undefined;
  const at = value.indexOf("|");
  if (at <= 0 || value.slice(0, at) !== userId) return undefined;
  return value.slice(at + 1) || undefined;
}

/** Aktivní náhled přihlášeného správce, nebo null. Ne-správce a neplatný klíč = běžný pohled. */
export const currentPreview = cache(async (user: CurrentUser): Promise<(PlanPreview & { key: string }) | null> => {
  const key = previewKeyFor(user.id, (await cookies()).get(PREVIEW_COOKIE)?.value);
  const preview = await resolvePreview(user, key);
  return preview && key ? { ...preview, key } : null;
});
