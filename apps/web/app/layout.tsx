import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Providers } from "@/components/Providers";
import { PreferenceBridge } from "@/components/shell/PreferenceBridge";
import { parsePrefs } from "@/lib/i18n/cookie";
import { I18nProvider } from "@/lib/i18n/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "আমার পরিবার — Amar Poribar",
  description: "AI-assisted family expense tracker for Bangladesh",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const prefs = parsePrefs((name) => jar.get(name)?.value);
  const signedIn = jar.has("ap_at") || jar.has("ap_rt");
  return (
    <html lang={prefs.locale} data-simple={prefs.simple ? "1" : undefined} suppressHydrationWarning>
      <body>
        <I18nProvider initial={prefs}>
          <PreferenceBridge signedIn={signedIn} />
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
