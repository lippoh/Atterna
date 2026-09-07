// src/i18n/routing.ts — locale routing (el default, en secondary)
import { defineRouting } from "next-intl/routing";
export const routing = defineRouting({
locales: ["el", "en"],
defaultLocale: "el",
localePrefix: "as-needed", // Greek URLs stay unprefixed; /en for English
});
export type Locale = (typeof routing.locales)[number];