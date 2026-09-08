import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";

// Catalog leaf types (verified against messages/{el,en}.json): string,
// number, and arrays (t.raw consumers: stats grids, pricing plans, FAQ
// lists). Arrays replace wholesale during the fallback merge — never
// merged element-by-element.
type MessageLeaf = string | number;
type MessageValue = MessageLeaf | MessageTree | MessageValue[];
type MessageTree = { [key: string]: MessageValue };

function mergeMessages(fallback: MessageTree, overrides: MessageTree): MessageTree {
  const merged = { ...fallback };
  for (const [key, value] of Object.entries(overrides)) {
    const fallbackValue = merged[key];
    const mergeable =
      typeof fallbackValue === "object" &&
      typeof value === "object" &&
      !Array.isArray(fallbackValue) &&
      !Array.isArray(value);
    merged[key] = mergeable
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
