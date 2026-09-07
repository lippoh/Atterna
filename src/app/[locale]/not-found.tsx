// src/app/[locale]/not-found.tsx — localized 404 inside the locale tree
// V2.1 addition: with [locale]/layout.tsx as the ROOT layout (there is
// no src/app/layout.tsx in this design — deleting the scaffold root
// layout is Fix A-1), this boundary gives unmatched paths a proper
// localized 404 instead of Next's bare default page. Bilingual inline
// copy, same pattern as the public feedback page — no new message keys.
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
export default async function NotFound() {
  const locale = await getLocale();
  const en = locale === "en";
  return (
  <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4
        text-center">
    <p className="text-4xl font-bold text-slate-300">404</p>
    <p className="mt-2 text-sm text-slate-600">
            {en ? "This page does not exist." : "Αυτή η σελίδα δεν υπάρχει."}
    </p>
    <Link
            href="/"
            className="mt-6 text-sm font-medium text-blue-700 underline"
    >
            {en ? "Back to the homepage" : "Επιστροφή στην αρχική"}
    </Link>
    </main>
  );
}