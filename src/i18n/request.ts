import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";

type MessageTree = {
  [key: string]: string | MessageTree;
};

function mergeMessages(fallback: MessageTree, overrides: MessageTree): MessageTree {
  const merged = { ...fallback };
  for (const [key, value] of Object.entries(overrides)) {
    const fallbackValue = merged[key];
    merged[key] =
      typeof fallbackValue === "object" && typeof value === "object"
        ? mergeMessages(fallbackValue, value)
        : value;
  }
  return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = routing.locales.includes(requested as Locale)
    ? (requested as Locale)
    : routing.defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default as MessageTree;
  const fallback = (await import("../../messages/en.json")).default as MessageTree;

  return {
    locale,
    messages: locale === "el" ? mergeMessages(fallback, messages) : messages,
  };
});
