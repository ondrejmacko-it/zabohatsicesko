import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "@/server/config";

/** Krátkodobá cookie se stavem, nonce a PKCE ověřovačem přihlášení. Podepsaná, HttpOnly, platí 10 minut. */
export const LOGIN_COOKIE = config.isProduction ? "__Host-zbc_google_login" : "zbc_google_login";

export const loginCookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  // Lax, aby cookie dorazila při návratu z Googlu (navigace nejvyšší úrovně metodou GET).
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60,
};

export const gateUrl = (result: string) => `${config.appUrl}/vstup?google=${result}`;

/**
 * Dlouhodobá cookie s ID uživatele, který se z tohoto prohlížeče naposledy přihlásil Googlem. Podle ní
 * server ještě před přesměrováním pozná správce a požádá o Kalendář na téže obrazovce. Nenese žádné
 * oprávnění: je podepsaná a rozhoduje jen o tom, o jaký rozsah se Google požádá.
 */
export const HINT_COOKIE = "zbc_google_hint";
export const hintCookieOptions = { ...loginCookieOptions, maxAge: 180 * 24 * 3600 };

const signHint = (userId: string) => createHmac("sha256", config.sessionSecret).update(`google-hint:${userId}`).digest("base64url");

export const encodeHint = (userId: string) => `${userId}.${signHint(userId)}`;

export function decodeHint(value: string | undefined): string | null {
  const cut = value?.lastIndexOf(".") ?? -1;
  if (!value || cut < 1) return null;
  const userId = value.slice(0, cut);
  const expected = Buffer.from(signHint(userId));
  const received = Buffer.from(value.slice(cut + 1));
  return expected.length === received.length && timingSafeEqual(expected, received) ? userId : null;
}
