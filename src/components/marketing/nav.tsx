// src/components/marketing/nav.tsx — sticky marketing navigation (§7.5)
// Client island: h-16, canvas/85 + backdrop-blur, hairline appears after
// 8px scroll. Mobile: 44px hamburger → full-canvas overlay, links stagger
// in at 40ms. Locale pill ΕΛ/EN swaps via the i18n Link (route preserved).
// i18n-stable structure: every link/button sits in a FIXED-width slot sized
// to the wider locale (Greek), so switching ΕΛ ↔ EN changes only the text —
// never the geometry. Desktop links therefore start at lg (the Greek nav
// needs ~880px of slots; md would squeeze and wrap).
"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/ui/logo";
import { IconMenu, IconX } from "@/components/ui/icons";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import { cn } from "@/lib/utils";

export function MarketingNav() {
  const t = useTranslations("landing.nav");
  const locale = useLocale();
  const other = locale === "el" ? "en" : "el";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock scroll + close on Escape while the overlay is open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const links = [
    { href: "#how", label: t("how") },
    { href: "#features", label: t("features") },
    { href: "#pricing", label: t("pricing") },
    { href: "#faq", label: t("faq") },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-background/85 backdrop-blur-md transition-[border-color,box-shadow] duration-200",
        scrolled ? "border-b border-line shadow-xs" : "border-b border-transparent"
      )}
    >
      {/* reading progress — aegean→terracotta gradient along the nav's
       * bottom edge, scaled by scroll fraction */}
      <ScrollProgress />
      <nav className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
        <Link href="/" aria-label="Atterna" className="shrink-0">
          <Logo size="md" />
        </Link>

        {/* Desktop links — hover grows a 2px terracotta underline (220ms).
         * Slot widths (min-w) fit the WIDER label of the two locales, so
         * EN/EL render identical positions — text-center swaps glyphs only. */}
        <div className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={cn(
                "link-grow whitespace-nowrap text-center text-[15px] font-medium text-ink-700 transition-colors hover:text-ink-900",
                l.href === "#how" && "min-w-[7.5rem]",
                l.href === "#features" && "min-w-[6.25rem]",
                l.href === "#pricing" && "min-w-[3.5rem]",
                l.href === "#faq" && "min-w-[5rem]"
              )}
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Locale pill */}
          <Link
            locale={other}
            href="/"
            className="flex h-8 items-center rounded-full border border-line-strong px-3 font-mono text-[11px] font-semibold tracking-wider text-ink-700 transition-colors hover:border-ink-500"
            aria-label={locale === "el" ? t("switchToEnglish") : t("switchToGreek")}
          >
            {other.toUpperCase()}
          </Link>
          <Link
            href="/login"
            className="hidden h-10 min-w-[5.5rem] items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-semibold text-aegean-600 transition-colors hover:bg-aegean-100 sm:inline-flex"
          >
            {t("login")}
          </Link>
          <Link
            href="/register"
            className="hidden h-10 min-w-[10.25rem] items-center justify-center whitespace-nowrap rounded-md bg-aegean-600 px-4 text-sm font-semibold text-white shadow-xs transition-[background-color,transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:bg-aegean-700 hover:shadow-sm active:translate-y-0 sm:inline-flex"
          >
            {t("cta")}
          </Link>

          {/* Mobile hamburger — 44px target */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t("closeMenu") : t("openMenu")}
            className="flex size-11 items-center justify-center rounded-md text-ink-700 transition-colors hover:bg-sunken lg:hidden"
          >
            {open ? <IconX className="size-6" /> : <IconMenu className="size-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile full-canvas overlay; links stagger in at 40ms */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-30 flex flex-col bg-background px-6 pb-8 pt-8 lg:hidden">
          <nav className="flex flex-col gap-2" aria-label="Mobile">
            {[...links, { href: "/login", label: t("login") }].map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="reveal is-visible flex h-14 items-center border-b border-line font-display text-2xl font-semibold text-ink-900"
                style={{ transitionDelay: `${i * 40}ms` }}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <Link
            href="/register"
            onClick={() => setOpen(false)}
            className="mt-6 flex h-12 items-center justify-center rounded-md bg-aegean-600 text-base font-semibold text-white shadow-sm"
          >
            {t("cta")}
          </Link>
        </div>
      )}
    </header>
  );
}
