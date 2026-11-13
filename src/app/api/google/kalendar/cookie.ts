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

/**
 * Propojení spuštěné Wiki samo (po přihlášení nebo z úkolu v Plánu). Návrat pak vede na Plán, ne na
 * technickou stránku. Cookie nenese žádné oprávnění, jen cíl návratu.
 */
export const AUTO_COOKIE = "zbc_google_auto";
export const CONNECT_PATH = "/api/google/kalendar/pripojit?auto=1";
export const planUrl = () => `${config.appUrl}/vzdelavani/harmonogram`;
