// src/components/marketing/hero.tsx — the landing hero (§9.1)
// 2-col 55/45 (stacked on mobile). Left: eyebrow, display-xl serif H1 with
// a gradient-ink accent sentence under a self-drawing swash, body-lg sub,
// magnetic primary CTA, micro-trust. Right: the parallax product stage
// (hero-stage.tsx). Background: drifting aegean/terracotta aurora blobs on
// a fading hairline grid — depth, not decoration. Meander divider + scroll
// cue close the section.
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/ui/reveal";
import { Magnetic } from "@/components/ui/magnetic";
import { HeroStage } from "@/components/marketing/hero-stage";
import { IconArrowRight, IconChevronDown } from "@/components/ui/icons";

export async function Hero() {
  const t = await getTranslations("landing.hero");
  const p = await getTranslations("landing.preview");

  return (
    <section className="relative overflow-hidden">
      {/* Aurora background — slow drifting color, pointer-events off */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="aurora aurora-aegean aurora-drift-a absolute -top-44 left-[6%] size-[440px]" />
        <div className="aurora aurora-terracotta aurora-drift-b absolute -top-28 right-[2%] size-[380px]" />
        <div className="aurora aurora-aegean aurora-drift-c absolute top-[300px] left-[36%] size-[320px] opacity-30" />
        <div className="hero-grid absolute inset-0" />
      </div>

      <div className="relative mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-14 px-6 pb-16 pt-16 md:pb-24 md:pt-24 lg:grid-cols-[55fr_45fr]">
        {/* ── Copy column ─────────────────────────────────────────────── */}
        <div className="max-w-[560px]">
          <Reveal>
            <p className="flex items-center gap-2.5 text-xs font-semibold tracking-[0.08em] text-terracotta-500">
              <span className="pulse-dot inline-block size-1.5 rounded-full bg-terracotta-500" aria-hidden="true" />
              {t("eyebrow")}
            </p>
          </Reveal>
          <Reveal delay={60}>
            <h1 className="mt-4 font-display text-[clamp(2.6rem,1.6rem+4vw,4.6rem)] font-semibold leading-[1.05] tracking-[-0.015em] text-ink-900">
              {t("titleTop")}
              <br />
              <span className="hero-accent relative inline-block">
                {t("titleAccent")}
                {/* swash draws itself under the accent sentence */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 220 12"
                  preserveAspectRatio="none"
                  className="absolute -bottom-1.5 left-0 h-[10px] w-full overflow-visible"
                >
                  <path
                    d="M3 9 C 60 2.5, 160 2.5, 217 7.5"
                    fill="none"
                    stroke="var(--terracotta-500)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    pathLength={1}
                    className="swash-line"
                  />
                </svg>
              </span>
            </h1>
          </Reveal>
          <Reveal delay={120}>
            {/* min-h reserves the Greek 4-line height so the hero (and every
             * section below) keeps identical geometry in EN and EL */}
            <p className="lh-body mt-6 min-h-[7.5rem] max-w-[52ch] text-[1.0625rem] text-ink-700">
              {t("subtitle")}
            </p>
          </Reveal>
          <Reveal delay={180}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Magnetic>
                <Link
                  href="/register"
                  className="btn-shine inline-flex h-12 min-w-[13.75rem] items-center justify-center gap-2 whitespace-nowrap rounded-md bg-aegean-600 px-6 text-base font-semibold text-white shadow-sm transition-[background-color,transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:bg-aegean-700 hover:shadow-md active:translate-y-0"
                >
                  {t("cta")}
                  <IconArrowRight className="size-4" />
                </Link>
              </Magnetic>
              <a
                href="#demo"
                className="inline-flex h-12 min-w-[13rem] items-center justify-center whitespace-nowrap rounded-md border border-line-strong bg-surface px-6 text-base font-semibold text-ink-900 transition-[border-color,transform] duration-150 hover:border-ink-500 hover:-translate-y-px"
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
          <HeroStage
            labels={{
              business: p("business"),
              businessMeta: p("businessMeta"),
              synced: p("synced"),
              kpiRating: p("kpiRating"),
              kpiResponse: p("kpiResponse"),
              kpiDelta: p("kpiDelta"),
              chartLabel: p("chartLabel"),
              draftLabel: p("draftLabel"),
              draftText: p("draftText"),
              draftReady: p("draftReady"),
              reviewer: p("reviewer"),
              answered: p("answered"),
              reviewText: p("reviewText"),
            }}
          />
        </Reveal>
      </div>

      {/* scroll cue — invites the scroll into the story */}
      <div className="relative flex justify-center pb-6 md:pb-8">
        <a
          href="#demo"
          aria-label={t("ctaSecondary")}
          className="scroll-cue flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-500 shadow-xs transition-colors hover:border-ink-500 hover:text-ink-900"
        >
          <IconChevronDown className="size-4" />
        </a>
      </div>

      <div className="meander-strip" aria-hidden="true" />
    </section>
  );
}
