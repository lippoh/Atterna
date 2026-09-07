// src/app/[locale]/(app)/layout.tsx — auth guard + app shell
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "./actions";

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser();
  const t = await getTranslations({ namespace: "nav", locale });

  const nav = [
    { href: "/dashboard", label: t("dashboard") },
    { href: "/reviews", label: t("reviews") },
    { href: "/feedback", label: t("feedback") },
    { href: "/settings", label: t("settings") },
  ] as const;

  return (
    <div className="min-h-dvh bg-slate-50 pb-20">
      {user.impersonatedBy && (
        <div className="bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900">
          {locale === "en"
            ? "Support session — read-only billing. The owner has been notified."
            : "Συνεδρία υποστήριξης — η χρέωση είναι μόνο για ανάγνωση. Ο ιδιοκτήτης έχει ενημερωθεί."}
        </div>
      )}

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <span className="text-sm font-bold text-blue-800">ΦΗΜΗ</span>
        <div className="flex items-center gap-3">
          <Link href="/billing" className="text-xs font-medium text-slate-500 underline">
            {t("billing")}
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="text-xs text-slate-500 underline">
              {t("signOut")}
            </button>
          </form>
        </div>
      </header>

      {children}

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-200 bg-white">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="flex flex-1 flex-col items-center py-2.5 text-[11px] font-medium text-slate-600 hover:text-blue-700">
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}