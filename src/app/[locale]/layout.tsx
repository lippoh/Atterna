// src/app/[locale]/layout.tsx — locale segment + root layout + fonts
// ROOT layout: this file renders <html>. There must be NO src/app/layout.tsx
// and NO src/app/page.tsx — with localePrefix "as-needed" the default
// locale (el) serves "/" directly from this tree, and scaffold root files
// would shadow the Greek landing. Delete them if they exist.
//
// Fonts (brief §6.1 with the documented fallback): Playfair Display has NO
// Greek subset — the display face is Source Serif 4 (verified Greek +
// greek-ext). Inter covers Greek; Plex Mono is Latin-only by design (it
// only ever renders digits, tokens and codes).
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Source_Serif_4, Inter, IBM_Plex_Mono } from "next/font/google";
import { routing, type Locale } from "@/i18n/routing";
import "../globals.css";

const display = Source_Serif_4({
  subsets: ["latin", "greek"],
  variable: "--font-serif-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin", "greek"],
  variable: "--font-inter",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-plex",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: {
    default: "Atterna — AI διαχείριση φήμης για ελληνικές επιχειρήσεις",
    template: "%s · Atterna",
  },
  description:
    "Το Atterna διαβάζει τις κριτικές σας στο Google, γράφει απαντήσεις με το δικό σας ύφος στα ελληνικά και τα αγγλικά, και στέλνει τους ικανοποιημένους πελάτες να αφήνουν πεντάστερες κριτικές.",
  applicationName: "Atterna",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF9F7" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1522" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background font-sans text-ink-700 antialiased">
        {/* First focusable element — the a11y contract's skip link (§11). */}
        <a
          href="#main-content"
          className="skip-link rounded-md bg-aegean-600 px-4 py-2 text-sm font-semibold text-white shadow-md"
        >
          {locale === "en" ? "Skip to content" : "Προς το περιεχόμενο"}
        </a>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
