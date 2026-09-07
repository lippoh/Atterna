// src/i18n/request.ts — next-intl request config (referenced by
// next.config.ts via createNextIntlPlugin("./src/i18n/request.ts"))
import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";
export default getRequestConfig(async ({ requestLocale }) => {
const requested = await requestLocale;
const locale: Locale = routing.locales.includes(requested as Locale)
? (requested as Locale)
: routing.defaultLocale;
return {
locale,
messages: (await import(`../../messages/${locale}.json`)).default,
};
});