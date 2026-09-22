import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PharmaRefill AI (RxTriage) — Clinical Voice Agent & Operations Cockpit",
  description: "Zero-Error Community Pharmacy Voice Triage, DEA Title 21 CFR § 1306 Controlled Substance Guardrails, and Proactive Medication Synchronization.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-full flex flex-col bg-[#06090e]">{children}</body>
    </html>
  );
}
