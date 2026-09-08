// src/components/marketing/sections.tsx — landing body sections (§9.1)
// Trust strip → problem (tilt stat cards) → how-it-works (numbered serif
// circles on a hairline that draws itself across when the section enters)
// → four feature sections (alternating 6/6, check bullets, terracotta
// underline CTA links, each proof mockup on a pointer-tilt card) → stats
// band (ink-900, tilt cards) → testimonials as an infinite CSS marquee.
// All copy from messages; arrays via t.raw().
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/ui/reveal";
import { Tilt } from "@/components/ui/tilt";
import { Marquee } from "@/components/ui/marquee";
import {
  IconCheck,
  IconStarFilled,
  IconArrowRight,
  IconQr,
  IconMail,
  IconInbox,
  IconLanguages,
} from "@/components/ui/icons";

type Item = { title: string; body: string };
type StatItem = { value: string; label: string };
type FeatureItem = {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  cta: string;
};
type TestimonialItem = { quote: string; name: string; role: string; city: string };

export async function TrustStrip() {
  const t = await getTranslations("landing");
  return (
    <div className="border-y border-line">
      <p className="mx-auto max-w-[1120px] px-6 py-5 text-center text-[13px] text-ink-500">
        {t("trust")}
      </p>
    </div>
  );
}

export async function Problem() {
  const t = await getTranslations("landing.problem");
  // Placeholder stats — replace with sourced figures before launch.
  const stats = t.raw("stats") as StatItem[];
  return (
    <section className="mx-auto max-w-[1120px] px-6 py-16 md:py-24">
      <Reveal>
        <h2 className="max-w-[24ch] font-display text-[clamp(2.1rem,1.5rem+2vw,3.25rem)] font-semibold leading-[1.12] text-ink-900">
          {t("title")}
        </h2>
        <p className="lh-body mt-5 max-w-[58ch] text-[1.0625rem] text-ink-700">
          {t("body")}
        </p>
      </Reveal>
      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 60}>
            <Tilt max={4} className="h-full">
              <div className="h-full rounded-xl border border-line bg-surface p-6 shadow-xs transition-[box-shadow] duration-200 hover:shadow-md">
                <p className="font-display text-[clamp(2.1rem,1.5rem+2vw,3.25rem)] font-semibold leading-none text-terracotta-500">
                  {s.value}
                </p>
                <p className="mt-3 max-w-[24ch] text-[13px] leading-relaxed text-ink-500">
                  {s.label}
                </p>
              </div>
            </Tilt>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export async function HowItWorks() {
  const t = await getTranslations("landing.how");
  const steps = t.raw("steps") as Item[];
  return (
    <section id="how" className="border-t border-line">
      <div className="mx-auto max-w-[1120px] px-6 py-16 md:py-24">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.08em] text-terracotta-500">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 font-display text-[clamp(2.1rem,1.5rem+2vw,3.25rem)] font-semibold leading-[1.12] text-ink-900">
            {t("title")}
          </h2>
        </Reveal>
        <Reveal className="relative mt-14">
          <div className="relative grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            {/* connecting hairline on desktop; a terracotta line draws
             * itself across it when the section becomes visible */}
            <div
              aria-hidden="true"
              className="absolute left-0 right-0 top-7 hidden border-t border-line md:block"
            />
            <div
              aria-hidden="true"
              className="how-line absolute left-0 right-0 top-7 hidden h-px md:block"
            />
            {steps.map((step, i) => (
              <Reveal key={step.title} delay={300 + i * 120} className="relative">
                <span className="step-circle relative z-10 flex size-14 items-center justify-center rounded-full border border-line-strong bg-surface font-display text-lg font-semibold text-ink-900 shadow-xs">
                  {`0${i + 1}`}
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold text-ink-900">
                  {step.title}
                </h3>
                <p className="lh-body mt-2 max-w-[34ch] text-sm text-ink-700">
                  {step.body}
                </p>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Small authored proof mockups for the feature sections (§7.10 rules:
 * inline SVG line art + type, no raster, no stock). */
function InboxProof() {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      {[
        { dot: "bg-success-600", answered: true },
        { dot: "bg-danger-600", answered: false },
        { dot: "bg-ink-300", answered: true },
      ].map((row, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-line py-3 last:border-0"
        >
          <span className={`size-2 shrink-0 rounded-full ${row.dot}`} aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-2 rounded-full bg-sunken" style={{ width: `${88 - i * 14}%` }} />
            <div className="h-2 rounded-full bg-sunken" style={{ width: `${62 - i * 10}%` }} />
          </div>
          {row.answered && <IconCheck className="size-4 shrink-0 text-success-600" />}
        </div>
      ))}
    </div>
  );
}

function DraftProof() {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-[10px] font-semibold tracking-[0.08em] text-aegean-600">
        Πρόταση AI
      </p>
      <div className="mt-2 space-y-1.5">
        <div className="h-2 rounded-full bg-sunken" style={{ width: "94%" }} />
        <div className="h-2 rounded-full bg-sunken" style={{ width: "78%" }} />
        <div className="h-2 rounded-full bg-sunken" style={{ width: "52%" }} />
      </div>
      <div className="mt-3 flex gap-2">
        {["Φιλικό", "Επίσημο", "Απολογητικό"].map((tone) => (
          <span
            key={tone}
            className="rounded-full border border-line-strong px-2.5 py-1 text-[10px] font-medium text-ink-700"
          >
            {tone}
          </span>
        ))}
      </div>
    </div>
  );
}

function QrProof() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex size-16 shrink-0 items-center justify-center rounded-md border border-line bg-sunken">
        <IconQr className="size-8 text-ink-700" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold text-ink-900">
          Σκανάρετε και πείτε μας
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          {[5, 4, 3].map((n) => (
            <span
              key={n}
              className={`flex size-7 items-center justify-center rounded-md border text-[11px] font-semibold ${
                n >= 4
                  ? "border-star-400 bg-terracotta-100 text-terracotta-500"
                  : "border-line-strong bg-sunken text-ink-500"
              }`}
            >
              {n}★
            </span>
          ))}
          <span className="ml-1 text-[10px] text-ink-500">→ Google / εσάς</span>
        </div>
      </div>
    </div>
  );
}

function MailProof() {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <IconMail className="size-4 text-ink-500" />
        <span className="text-[11px] font-medium text-ink-500">Κάθε Δευτέρα 09:00</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-2xl font-semibold tabular-nums text-ink-900">
            4,8<span className="text-sm text-ink-500">★</span>
          </p>
          <p className="mt-1 text-[10px] text-ink-500">92% απαντήθηκαν</p>
        </div>
        <div className="flex h-12 items-end gap-1" aria-hidden="true">
          {[8, 12, 10, 16, 14, 18, 20].map((h, i) => (
            <span
              key={i}
              className="w-2 rounded-sm bg-aegean-600/70"
              style={{ height: `${h * 4}px` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const PROOFS = [InboxProof, DraftProof, QrProof, MailProof];
const PROOF_ICONS = [IconInbox, IconLanguages, IconQr, IconMail];

export async function Features() {
  const t = await getTranslations("landing.features");
  const items = t.raw("items") as FeatureItem[];
  return (
    <section id="features" className="border-t border-line">
      <div className="mx-auto max-w-[1120px] px-6 py-16 md:py-24">
        <Reveal>
          <h2 className="max-w-[28ch] font-display text-[clamp(2.1rem,1.5rem+2vw,3.25rem)] font-semibold leading-[1.12] text-ink-900">
            {t("title")}
          </h2>
        </Reveal>
        <div className="mt-14 space-y-16 md:space-y-24">
          {items.map((feature, i) => {
            const Proof = PROOFS[i % PROOFS.length];
            const Icon = PROOF_ICONS[i % PROOF_ICONS.length];
            return (
              <div
                key={feature.title}
                className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16"
              >
                <Reveal
                  className={i % 2 === 1 ? "md:order-2" : undefined}
                >
                  <p className="text-xs font-semibold tracking-[0.08em] text-terracotta-500">
                    {feature.eyebrow}
                  </p>
                  <h3 className="mt-3 font-display text-[clamp(1.75rem,1.2rem+1.5vw,2.5rem)] font-semibold leading-[1.15] text-ink-900">
                    {feature.title}
                  </h3>
                  <p className="lh-body mt-4 max-w-[52ch] text-[1.0625rem] text-ink-700">
                    {feature.body}
                  </p>
                  <ul className="mt-6 space-y-3">
                    {feature.bullets.map((bullet, b) => (
                      <li
                        key={bullet}
                        className="bullet-in flex items-start gap-3 text-sm text-ink-700"
                        style={{ transitionDelay: `${b * 70}ms` }}
                      >
                        <IconCheck className="mt-0.5 size-4 shrink-0 text-aegean-600" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className="link-grow mt-7 inline-flex items-center gap-2 text-sm font-semibold text-aegean-600"
                  >
                    {feature.cta}
                    <IconArrowRight className="size-4" />
                  </Link>
                </Reveal>
                <Reveal delay={80} className={i % 2 === 1 ? "md:order-1" : undefined}>
                  <Tilt max={5} className="relative">
                    <div className="relative">
                      <div
                        aria-hidden="true"
                        className="mb-4 inline-flex size-9 items-center justify-center rounded-md border border-line bg-surface text-ink-500 shadow-xs"
                      >
                        <Icon className="size-5" />
                      </div>
                      <Proof />
                    </div>
                  </Tilt>
                </Reveal>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export async function StatsBand() {
  const t = await getTranslations("landing.statsBand");
  // Placeholder metrics — replace with real customer aggregates pre-launch.
  const items = t.raw("items") as StatItem[];
  return (
    <section className="border-t border-line bg-ink-900">
      <div className="mx-auto grid max-w-[1120px] grid-cols-2 gap-x-6 gap-y-10 px-6 py-14 md:grid-cols-4 md:py-16">
        {items.map((s, i) => (
          <Reveal key={s.label} delay={i * 60}>
            <div className="group rounded-xl border border-white/10 bg-white/[0.04] p-5 transition-[transform,border-color,background-color] duration-200 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.07]">
              <p className="font-display text-[clamp(2rem,1.4rem+1.5vw,3rem)] font-semibold leading-none text-white">
                {s.value}
              </p>
              <p className="mt-3 max-w-[20ch] text-[13px] leading-relaxed text-white/60">
                {s.label}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export async function Testimonials() {
  const t = await getTranslations("landing.testimonials");
  const items = t.raw("items") as TestimonialItem[];
  return (
    <section className="overflow-hidden py-16 md:py-24">
      <div className="mx-auto max-w-[1120px] px-6">
        <Reveal>
          <h2 className="text-center font-display text-[clamp(2.1rem,1.5rem+2vw,3.25rem)] font-semibold leading-[1.12] text-ink-900">
            {t("title")}
          </h2>
        </Reveal>
      </div>
      {/* Infinite marquee — hover pauses it; edges fade out */}
      <Reveal delay={100} className="mt-12">
        <Marquee duration={38} itemClassName="gap-6 pr-6">
          {items.map((item) => (
            <figure
              key={item.name}
              className="flex w-[300px] shrink-0 flex-col rounded-xl border border-line bg-surface p-6 shadow-xs transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-md sm:w-[340px]"
            >
              <div className="flex text-star-400" aria-label="5/5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <IconStarFilled key={s} className="size-3.5" />
                ))}
              </div>
              <blockquote className="lh-body mt-4 flex-1 text-[15px] leading-relaxed text-ink-700">
                «{item.quote}»
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-line pt-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-aegean-100 text-[13px] font-semibold text-aegean-600">
                  {item.name.slice(0, 1)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{item.name}</p>
                  <p className="text-[13px] text-ink-500">
                    {item.role} · {item.city}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </Marquee>
      </Reveal>
    </section>
  );
}
