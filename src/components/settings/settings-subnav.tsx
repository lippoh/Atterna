// src/components/settings/settings-subnav.tsx — Settings section switcher
// General (profile + tone) lives on /settings; Data Sources and Billing are
// sibling surfaces. One segmented control binds them (Stage C). Client
// island: usePathname drives the active segment.
"use client";

import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { IconSettings, IconGlobe, IconCard } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export function SettingsSubnav() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("settings");
  const prefix = `/${locale}`;
  const path = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;

  const items = [
    { href: "/settings", label: t("subnavGeneral"), Icon: IconSettings },
    { href: "/settings/sources", label: t("subnavSources"), Icon: IconGlobe },
    { href: "/billing", label: t("subnavBilling"), Icon: IconCard },
  ] as const;

  return (
    <nav aria-label={t("subnavLabel")} className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1 shadow-xs">
      {items.map(({ href, label, Icon }) => {
        const active = href === "/settings" ? path === "/settings" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3.5 py-2 text-sm transition-colors duration-150",
              active
                ? "bg-sunken font-semibold text-ink-900"
                : "font-medium text-ink-500 hover:bg-sunken hover:text-ink-700"
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
