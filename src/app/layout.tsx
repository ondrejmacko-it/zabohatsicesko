import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/newsreader/opsz.css";
import "./globals.css";
import { isLiveWiki } from "@/server/config";

// Funkce, ne konstanta: popis se řídí režimem za běhu, ne při buildu.
export function generateMetadata(): Metadata {
  return {
    title: { default: "Firemní Wiki", template: "%s · Firemní Wiki" },
    description: isLiveWiki()
      ? "Firemní Wiki Za bohatší Česko, modul Vzdělávání."
      : "Ukázka modulu Vzdělávání. Pracuje výhradně s fiktivními daty.",
    robots: { index: false, follow: false },
    // Safari na iOS jinak dělá z dat a čísel v harmonogramu odkazy.
    formatDetection: { telephone: false, date: false, address: false, email: false },
  };
}

// viewport-fit=cover: obsah na iPhonu sahá až k okrajům a odsazení řeší env(safe-area-inset-*) v CSS.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f7f6f4" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
