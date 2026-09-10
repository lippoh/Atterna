// src/components/app/nav-tabs.tsx — app bottom navigation (mobile) +
// top-bar links (desktop), one component, two renderings.
// Client island: usePathname drives the active tab (ink-900 + 600 weight,
// never color-only — the tab gains an 2px aegean underline bar).
"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  IconChartLine,
  IconStar,
  IconQr,
  IconGlobe,
  IconSettings,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", labelKey: "dashboard", Icon: IconChartLine },
  { href: "/reviews", labelKey: "reviews", Icon: IconStar },
  { href: "/settings/sources", labelKey: "sources", Icon: IconGlobe },
  { href: "/feedback", labelKey: "feedback", Icon: IconQr },
  { href: "/settings", labelKey: "settings", Icon: IconSettings },
] as const;

/** Desktop top-bar links. */
export function DesktopNavTabs() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="App">
      {TABS.map(({ href, labelKey }) => {
        // Stage E: exact match for /settings — /settings/sources is its own
        // primary tab and must not light up Settings too.
        const active = href === "/settings" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center rounded-md px-3.5 text-sm transition-colors duration-150",
              active
                ? "bg-sunken font-semibold text-ink-900"
                : "font-medium text-ink-500 hover:bg-sunken hover:text-ink-700"
            )}
          >
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile bottom bar — 44px+ targets, icons + 11px labels. */
export function MobileNavTabs() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="App"
    >
      {TABS.map(({ href, labelKey, Icon }) => {
        const active = href === "/settings" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-2"
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center transition-colors",
                active ? "text-aegean-600" : "text-ink-300"
              )}
            >
              <Icon className="size-6" />
            </span>
            <span
              className={cn(
                "text-[11px] leading-none",
                active ? "font-semibold text-ink-900" : "font-medium text-ink-500"
              )}
            >
              {t(labelKey)}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "h-0.5 w-6 rounded-full transition-colors",
                active ? "bg-aegean-600" : "bg-transparent"
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
