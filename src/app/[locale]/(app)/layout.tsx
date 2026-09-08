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
    <div className="app-shell min-h-dvh bg-background pb-20 text-ink-900 lg:pb-0">
      {user.impersonatedBy && (
        <div className="border-b border-terracotta-500/20 bg-terracotta-100 px-4 py-2 text-center text-xs font-semibold text-terracotta-500">
          {locale === "en"
            ? "Support session — read-only billing. The owner has been notified."
            : "Συνεδρία υποστήριξης — η χρέωση είναι μόνο για ανάγνωση. Ο ιδιοκτήτης έχει ενημερωθεί."}
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="font-display text-xl font-semibold tracking-tight text-ink-900">Atterna<span className="text-terracotta-500">.</span></Link>
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
              {nav.map((item) => <Link key={item.href} href={item.href} className="rounded-sm px-3 py-2 text-sm font-medium text-ink-500 transition hover:bg-sunken hover:text-ink-900">{item.label}</Link>)}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/billing" className="hidden rounded-full bg-aegean-100 px-3 py-1.5 text-xs font-semibold text-aegean-700 sm:inline-flex">{t("billing")}</Link>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-aegean-100 text-xs font-semibold text-aegean-600">{user.email?.slice(0, 1).toUpperCase() ?? "A"}</span>
            <form action={signOutAction} className="hidden sm:block"><button type="submit" className="text-xs font-medium text-ink-500 hover:text-aegean-600">{t("signOut")}</button></form>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 backdrop-blur-md lg:hidden" aria-label="Mobile navigation">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="flex min-h-14 flex-1 items-center justify-center px-1 text-[11px] font-medium text-ink-500 hover:text-aegean-600">
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}