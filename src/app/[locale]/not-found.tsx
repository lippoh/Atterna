// src/app/[locale]/not-found.tsx — localized 404 inside the locale tree
// Bilingual inline copy (no new message keys) with the wordmark and a
// serif 404 in ink-300 — calm, not scary.
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/ui/logo";

export default async function NotFound() {
  const locale = await getLocale();
  const en = locale === "en";
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh max-w-[420px] flex-col items-center justify-center px-4 text-center"
    >
      <Logo size="md" />
      <p className="mt-8 font-display text-6xl font-semibold text-ink-300">404</p>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-500">
        {en ? "This page does not exist." : "Αυτή η σελίδα δεν υπάρχει."}
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-10 items-center rounded-md border border-line-strong bg-surface px-5 text-sm font-semibold text-ink-900 transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-ink-500"
      >
        {en ? "Back to the homepage" : "Επιστροφή στην αρχική"}
      </Link>
    </main>
  );
}
