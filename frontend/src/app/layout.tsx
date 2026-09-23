import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PharmaRefill AI (RxTriage) — Clinical Voice Agent & Operations Cockpit",
  description:
    "Zero-Error Community Pharmacy Voice Triage, DEA Title 21 CFR § 1306 Controlled Substance Guardrails, and Proactive Medication Synchronization.",
  keywords: ["pharmacy", "voice AI", "clinical", "medication sync", "RxTriage"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth" suppressHydrationWarning>
      <body
        className="min-h-screen antialiased overflow-x-hidden"
        style={{
          background: "#060c18",
          fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
