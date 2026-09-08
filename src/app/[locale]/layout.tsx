// src/app/[locale]/layout.tsx — locale segment + providers
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import "../globals.css";
export function generateStaticParams() {
return routing.locales.map((locale) => ({ locale }));
}
export const metadata: Metadata = {
title: {
default: "Reputation SaaS",
template: "%s · Reputation SaaS",
},
description: "AI reputation & customer insight platform for local businesses",
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
<NextIntlClientProvider messages={messages}>
<div className="min-h-dvh bg-slate-50 text-slate-900 antialiased">
	{children}
</div>
</NextIntlClientProvider>
);
}