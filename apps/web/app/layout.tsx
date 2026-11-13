import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { Providers } from "@/components/Providers";
import { PreferenceBridge } from "@/components/shell/PreferenceBridge";
import { parsePrefs } from "@/lib/i18n/cookie";
import { I18nProvider } from "@/lib/i18n/provider";
import "../styles/tokens.css";
import "../styles/base.css";

const hind = localFont({
  src: [
    { path: "../public/fonts/HindSiliguri-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/HindSiliguri-Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/HindSiliguri-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/HindSiliguri-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-hind",
  display: "swap",
});

export const metadata: Metadata = {
  title: "আমার পরিবার — Amar Poribar",
  description: "AI-assisted family expense tracker for Bangladesh",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const prefs = parsePrefs((name) => jar.get(name)?.value);
  const signedIn = jar.has("ap_at") || jar.has("ap_rt");
  return (
    <html
      lang={prefs.locale}
      className={hind.variable}
      data-simple={prefs.simple ? "1" : undefined}
      suppressHydrationWarning
    >
      <body>
        <I18nProvider initial={prefs}>
          <PreferenceBridge signedIn={signedIn} />
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
