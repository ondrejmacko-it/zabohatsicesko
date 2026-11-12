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
