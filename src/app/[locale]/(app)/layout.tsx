// src/app/[locale]/(app)/layout.tsx — auth guard + app shell (§9.3)
// Top bar: wordmark + desktop nav tabs (active state) + initials avatar.
// Billing lives under Settings (sub-nav), not as a fifth top-level tab.
// Bottom mobile bar with the same four destinations. The impersonation
// banner is danger-tinted — the one state that must never be missed.
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/ui/logo";
import { DesktopNavTabs, MobileNavTabs } from "@/components/app/nav-tabs";
import { IconLogout } from "@/components/ui/icons";
import { signOutAction } from "../(auth)/actions";

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

  const initials = (user.email ?? "?")
    .split("@")[0]
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-dvh bg-background pb-20 md:pb-0">
      {user.impersonatedBy && (
        <div className="bg-danger-600 px-4 py-2 text-center text-[13px] font-semibold text-white">
          {locale === "en"
            ? "Support session — read-only billing. The owner has been notified."
            : "Συνεδρία υποστήριξης — η χρέωση είναι μόνο για ανάγνωση. Ο ιδιοκτήτης έχει ενημερωθεί."}
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-4 sm:px-6">
          <Link href="/dashboard" aria-label="Atterna" className="shrink-0">
            <Logo size="sm" />
          </Link>
          <DesktopNavTabs />
          <div className="ml-auto flex items-center gap-2">
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label={t("signOut")}
                title={t("signOut")}
                className="flex size-9 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-sunken hover:text-ink-700"
              >
                <IconLogout className="size-5" />
              </button>
            </form>
            <Link
              href="/settings"
              aria-label={t("settings")}
              className="flex size-9 items-center justify-center rounded-full bg-aegean-100 text-[13px] font-semibold text-aegean-600 transition-transform hover:scale-105"
            >
              {initials}
            </Link>
          </div>
        </div>
      </header>

      {children}

      <MobileNavTabs />
    </div>
  );
}
