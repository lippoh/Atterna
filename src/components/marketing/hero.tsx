// src/components/marketing/hero.tsx — the landing hero (§9.1)
// 2-col 55/45 (stacked on mobile). Left: eyebrow, display-xl serif H1,
// body-lg sub, CTA row, micro-trust. Right: a product-preview card —
// miniature dashboard (sync chip, KPIs, area chart, review row) with a
// rotated draft-reply card behind it for depth. Canvas + subtle aegean
// radial fade; meander divider closes the section.
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/ui/reveal";
import { CountUp } from "@/components/ui/count-up";
import { IconArrowRight, IconCheck, IconStarFilled } from "@/components/ui/icons";

export async function Hero() {
  const t = await getTranslations("landing.hero");
  const p = await getTranslations("landing.preview");

  // Static demo series for the mini area chart (up-trending).
  const series = [4.1, 4.15, 4.1, 4.25, 4.2, 4.35, 4.3, 4.45, 4.4, 4.55, 4.5, 4.62];
  const W = 220;
  const H = 90;
  const min = 4.0;
  const max = 4.75;
  const pts = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * (W - 8) + 4;
      const y = H - 8 - ((v - min) / (max - min)) * (H - 20);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" L");

  return (
    <section className="relative overflow-hidden">
      {/* Very subtle aegean radial fade at the top — depth, not decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,var(--aegean-100)_0%,transparent_70%)] opacity-60"
      />
      <div className="relative mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-14 px-6 pb-16 pt-16 md:pb-24 md:pt-24 lg:grid-cols-[55fr_45fr]">
        {/* ── Copy column ─────────────────────────────────────────────── */}
        <div className="max-w-[560px]">
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.08em] text-terracotta-500">
              {t("eyebrow")}
            </p>
          </Reveal>
          <Reveal delay={60}>
            <h1 className="mt-4 font-display text-[clamp(2.6rem,1.6rem+4vw,4.6rem)] font-semibold leading-[1.05] tracking-[-0.015em] text-ink-900">
              {t("title")}
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="lh-body mt-6 max-w-[52ch] text-[1.0625rem] text-ink-700">
              {t("subtitle")}
            </p>
          </Reveal>
          <Reveal delay={180}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-md bg-aegean-600 px-6 text-base font-semibold text-white shadow-sm transition-[background-color,transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:bg-aegean-700 hover:shadow-md active:translate-y-0"
              >
                {t("cta")}
                <IconArrowRight className="size-4" />
              </Link>
              <a
                href="#how"
                className="inline-flex h-12 items-center rounded-md border border-line-strong bg-surface px-6 text-base font-semibold text-ink-900 transition-[border-color,transform] duration-150 hover:border-ink-500 hover:-translate-y-px"
              >
                {t("ctaSecondary")}
              </a>
            </div>
          </Reveal>
          <Reveal delay={240}>
            <p className="mt-5 text-[13px] text-ink-500">{t("microTrust")}</p>
          </Reveal>
        </div>

        {/* ── Product preview column ──────────────────────────────────── */}
        <Reveal delay={200} className="relative lg:justify-self-end">
          <div className="relative mx-auto w-full max-w-[440px]">
            {/* Draft-reply card behind — offset, rotated 2deg, 0.9 scale */}
            <div
              aria-hidden="true"
              className="absolute -right-4 -top-8 hidden w-[62%] rotate-2 scale-90 rounded-xl border border-line bg-surface p-4 shadow-md sm:block"
            >
              <p className="text-[10px] font-semibold tracking-[0.08em] text-aegean-600">
                {p("draftLabel")}
              </p>
              <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-ink-500">
                {p("draftText")}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-success-100 px-2 py-0.5 text-[10px] font-medium text-success-600">
                  {p("draftReady")}
                </span>
              </div>
            </div>

            {/* The miniature dashboard */}
            <div className="relative rounded-xl border border-line bg-surface p-5 shadow-lg sm:p-6">
              {/* header row: business + sync chip */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-[17px] font-semibold text-ink-900">
                    {p("business")}
                  </p>
                  <p className="text-[12px] text-ink-500">{p("businessMeta")}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2.5 py-1 text-[11px] font-medium text-success-600">
                  <IconCheck className="size-3" />
                  {p("synced")}
                </span>
              </div>

              {/* three mini KPIs */}
              <div className="mt-5 grid grid-cols-3 gap-3">
                {(
                  [
                    { value: 4.8, decimals: 1, suffix: "★", label: p("kpiRating") },
                    { value: 92, decimals: 0, suffix: "%", label: p("kpiResponse") },
                    { value: 11, decimals: 0, prefix: "+", label: p("kpiDelta") },
                  ] as { value: number; decimals: number; prefix?: string; suffix?: string; label: string }[]
                ).map((kpi) => (
                  <div key={kpi.label} className="rounded-md bg-sunken px-3 py-2.5">
                    <p className="font-display text-xl font-semibold tabular-nums text-ink-900">
                      <CountUp
                        to={kpi.value}
                        decimals={kpi.decimals}
                        prefix={kpi.prefix ?? ""}
                        suffix={kpi.suffix}
                      />
                    </p>
                    <p className="mt-0.5 text-[10px] leading-tight text-ink-500">
                      {kpi.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* 220×90 area chart */}
              <figure className="mt-4 overflow-hidden rounded-md border border-line bg-sunken">
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="block h-[90px] w-full"
                  role="img"
                  aria-label={p("chartLabel")}
                >
                  <defs>
                    <linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--aegean-600)" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="var(--aegean-600)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M${pts} L${W - 4},${H - 6} L4,${H - 6} Z`}
                    fill="url(#heroArea)"
                  />
                  <path
                    d={`M${pts}`}
                    fill="none"
                    stroke="var(--aegean-600)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                    className="chart-line"
                  />
                </svg>
              </figure>

              {/* one review row */}
              <div className="mt-4 rounded-md border border-line p-3">
                <div className="flex items-center gap-2">
                  <span className="flex text-star-400" aria-hidden="true">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <IconStarFilled key={i} className="size-3" />
                    ))}
                  </span>
                  <span className="text-[12px] font-medium text-ink-700">
                    {p("reviewer")}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-success-600">
                    <IconCheck className="size-3" />
                    {p("answered")}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-ink-500">
                  {p("reviewText")}
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
      <div className="meander-strip" aria-hidden="true" />
    </section>
  );
}
