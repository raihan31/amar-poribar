import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "আমার পরিবার — Amar Poribar",
  description: "AI-assisted family expense tracker for Bangladesh",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
