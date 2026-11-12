import { config } from "@/server/config";

/** Krátkodobá cookie se stavem OAuth a PKCE ověřovačem. Podepsaná, HttpOnly, platí 10 minut. */
export const OAUTH_COOKIE = config.isProduction ? "__Host-zbc_google_oauth" : "zbc_google_oauth";

export const oauthCookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  // Lax, aby cookie dorazila při návratu z Googlu (navigace nejvyšší úrovně metodou GET).
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60,
};

export const integrationsUrl = (result: string) => `${config.appUrl}/vzdelavani/integrace?google=${result}`;
