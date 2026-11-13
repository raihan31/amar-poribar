import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/Providers";
import "../styles/tokens.css";
import "../styles/base.css";
import "./globals.css";

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
  title: "Amar Poribar Admin",
  description: "Staff console for Amar Poribar",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={hind.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
