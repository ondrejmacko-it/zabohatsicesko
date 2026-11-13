import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/newsreader/opsz.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Firemní Wiki", template: "%s · Firemní Wiki" },
  description: "Ukázka modulu Vzdělávání. Pracuje výhradně s fiktivními daty.",
  robots: { index: false, follow: false },
  // Safari na iOS jinak dělá z dat a čísel v harmonogramu odkazy.
  formatDetection: { telephone: false, date: false, address: false, email: false },
};

// viewport-fit=cover: obsah na iPhonu sahá až k okrajům a odsazení řeší env(safe-area-inset-*) v CSS.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f7f6f4" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
