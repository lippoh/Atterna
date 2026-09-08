// src/components/marketing/pricing.tsx — pricing + FAQ (§9.1)
// Three tiers with the product's real plan names/prices (from
// PLAN_LIMITS parity). The middle tier is highlighted. Monthly/annual
// toggle (annual = -20%) is this file's only client state. FAQ uses
// native <details>/<summary> — zero JavaScript.
"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/ui/reveal";
import { IconCheck, IconChevronDown } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type Plan = {
  name: string;
  priceMonthly: number;
  desc: string;
  features: string[];
  cta: string;
};
type FaqItem = { q: string; a: string };

// The product's real plan limits (price-map parity — never invented).
const LIMITS: Record<string, { reviews: number; businesses: number }> = {
  Starter: { reviews: 150, businesses: 1 },
  Growth: { reviews: 600, businesses: 1 },
  Pro: { reviews: 2000, businesses: 3 },
};

export function Pricing() {
  const t = useTranslations("landing.pricing");
  const tf = useTranslations("landing.faq");
  const locale = useLocale();
  const [annual, setAnnual] = useState(false);
  const plans = t.raw("plans") as Plan[];
  const faqs = tf.raw("items") as FaqItem[];

  const priceFmt = new Intl.NumberFormat(locale === "en" ? "en-GB" : "el-GR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const monthlyFmt = new Intl.NumberFormat(locale === "en" ? "en-GB" : "el-GR", {
    maximumFractionDigits: 0,
  });

  return (
    <section id="pricing" className="border-t border-line">
      <div className="mx-auto max-w-[1120px] px-6 py-16 md:py-24">
        <Reveal>
          <h2 className="font-display text-[clamp(2.1rem,1.5rem+2vw,3.25rem)] font-semibold leading-[1.12] text-ink-900">
            {t("title")}
          </h2>
          <p className="lh-body mt-4 max-w-[56ch] text-[1.0625rem] text-ink-700">
            {t("subtitle")}
          </p>

          {/* monthly / annual toggle */}
          <div className="mt-8 inline-flex items-center rounded-full border border-line-strong bg-surface p-1">
            {(
              [
                { key: false, label: t("monthly") },
                { key: true, label: t("annual") },
              ] as const
            ).map((opt) => (
              <button
                key={String(opt.key)}
                type="button"
                onClick={() => setAnnual(opt.key)}
                aria-pressed={annual === opt.key}
                className={cn(
                  "flex h-9 items-center rounded-full px-4 text-[13px] font-semibold transition-colors duration-150",
                  annual === opt.key
                    ? "bg-ink-900 text-white"
                    : "text-ink-500 hover:text-ink-700"
                )}
              >
                {opt.label}
                {opt.key && (
                  <span className="ml-2 rounded-full bg-terracotta-100 px-2 py-0.5 text-[10px] font-semibold text-terracotta-500">
                    −20%
                  </span>
                )}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
          {plans.map((plan, i) => {
            const limits = LIMITS[plan.name];
            const popular = i === 1;
            const monthly = annual ? Math.round(plan.priceMonthly * 0.8) : plan.priceMonthly;
            return (
              <Reveal key={plan.name} delay={i * 60} className="h-full">
                <div
                  className={cn(
                    "relative flex h-full flex-col rounded-xl border bg-surface p-6 shadow-xs transition-[transform,box-shadow] duration-[220ms] ease-out md:p-8",
                    popular
                      ? "border-aegean-600 shadow-md md:scale-[1.02]"
                      : "border-line hover:-translate-y-0.5 hover:shadow-md"
                  )}
                >
                  {popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-aegean-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
                      {t("popular")}
                    </span>
                  )}
                  <h3 className="font-display text-xl font-semibold text-ink-900">
                    {plan.name}
                  </h3>
                  <p className="mt-1.5 min-h-[40px] text-[13px] leading-relaxed text-ink-500">
                    {plan.desc}
                  </p>
                  <p className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-semibold tabular-nums text-ink-900">
                      {priceFmt.format(monthly)}
                    </span>
                    <span className="text-[13px] text-ink-500">/{t("perMonth")}</span>
                  </p>
                  <p className="mt-1 text-[12px] text-ink-300">
                    {annual ? t("billedAnnual", { months: monthlyFmt.format(Math.round(plan.priceMonthly * 0.8 * 12)) }) : t("billedMonthly")}
                  </p>
                  {limits && (
                    <p className="mt-4 rounded-md bg-sunken px-3 py-2 text-[12px] font-medium tabular-nums text-ink-700">
                      {monthlyFmt.format(limits.reviews)} {t("reviewsPerMonth")} ·{" "}
                      {limits.businesses} {t("businessesIncluded")}
                    </p>
                  )}
                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm text-ink-700">
                        <IconCheck className="mt-0.5 size-4 shrink-0 text-aegean-600" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className={cn(
                      "mt-8 inline-flex h-11 items-center justify-center rounded-md text-sm font-semibold transition-[background-color,transform,box-shadow] duration-150",
                      popular
                        ? "bg-aegean-600 text-white hover:-translate-y-px hover:bg-aegean-700 hover:shadow-sm"
                        : "border border-line-strong bg-surface text-ink-900 hover:border-ink-500"
                    )}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>
        <Reveal>
          <p className="mt-6 text-center text-[13px] text-ink-500">
            {t("finePrint")}
          </p>
        </Reveal>

        {/* FAQ — native details/summary, zero JS */}
        <div id="faq" className="mt-20 md:mt-28">
          <Reveal>
            <h2 className="font-display text-[clamp(2.1rem,1.5rem+2vw,3.25rem)] font-semibold leading-[1.12] text-ink-900">
              {tf("title")}
            </h2>
          </Reveal>
          <div className="mt-10 divide-y divide-line border-y border-line">
            {faqs.map((item, i) => (
              <Reveal key={item.q} delay={Math.min(i * 40, 160)}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[15px] font-semibold text-ink-900 transition-colors hover:text-aegean-700 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <IconChevronDown className="size-4 shrink-0 text-ink-300 transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <p className="lh-body max-w-[62ch] pb-5 text-sm leading-relaxed text-ink-700">
                    {item.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
