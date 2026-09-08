// src/components/marketing/live-demo.tsx — the interactive showpiece (§9.1)
// A simulated Atterna session: a Google review arrives, the AI analyzes it,
// types the reply character by character, and the VISITOR presses publish
// (auto-publishes after a grace period so the loop never stalls). Cycles
// through three scripted reviews — including one in English, showing the
// bilingual promise. Pauses when scrolled off-screen; reduced motion skips
// straight to the ready state.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/reveal";
import {
  IconSparkles,
  IconCheck,
  IconStarFilled,
  IconStar,
  IconRefresh,
  IconSend,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type DemoReview = {
  name: string;
  stars: number;
  meta: string;
  text: string;
  analysis: string;
  reply: string;
};

type Phase = "arriving" | "analyzing" | "typing" | "ready" | "publishing" | "published";

export function LiveDemo() {
  const t = useTranslations("landing.demo");
  const reviews = t.raw("reviews") as DemoReview[];

  const stageRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("arriving");
  const [typed, setTyped] = useState(0);

  const review = reviews[idx] ?? reviews[0];

  // Visibility: the demo only runs while it is on screen.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? false),
      { threshold: 0.25 }
    );
    io.observe(el);
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    return () => io.disconnect();
  }, []);

  const next = useCallback(() => {
    setIdx((i) => (i + 1) % reviews.length);
    setTyped(0);
    setPhase("arriving");
  }, [reviews.length]);

  const publish = useCallback(() => {
    setPhase((p) => (p === "ready" ? "publishing" : p));
  }, []);

  const replay = useCallback(() => {
    setIdx(0);
    setTyped(0);
    setPhase("arriving");
  }, []);

  // The state machine. Reduced motion skips the theatre: each review lands
  // instantly in the ready state with the full reply typed.
  useEffect(() => {
    if (!inView || !review) return;
    let timer: ReturnType<typeof setTimeout>;
    if (reduced) {
      if (phase === "arriving" || phase === "analyzing" || phase === "typing") {
        setTyped(review.reply.length);
        setPhase("ready");
      } else if (phase === "ready") {
        timer = setTimeout(() => setPhase("publishing"), 2500);
      } else if (phase === "publishing") {
        timer = setTimeout(() => setPhase("published"), 400);
      } else if (phase === "published") {
        timer = setTimeout(next, 1400);
      }
      return () => clearTimeout(timer);
    }

    switch (phase) {
      case "arriving":
        timer = setTimeout(() => setPhase("analyzing"), 600);
        break;
      case "analyzing":
        timer = setTimeout(() => setPhase("typing"), 1200);
        break;
      case "typing":
        if (typed < review.reply.length) {
          // human-ish cadence with slight jitter
          timer = setTimeout(() => setTyped((c) => c + 1), 12 + Math.random() * 26);
        } else {
          setPhase("ready");
        }
        break;
      case "ready":
        // the visitor may publish; otherwise the demo continues by itself
        timer = setTimeout(() => setPhase("publishing"), 6500);
        break;
      case "publishing":
        timer = setTimeout(() => setPhase("published"), 800);
        break;
      case "published":
        timer = setTimeout(next, 2200);
        break;
    }
    return () => clearTimeout(timer);
  }, [phase, typed, idx, inView, reduced, review, next]);

  if (!review) return null;

  const doneTyping = typed >= review.reply.length;
  const analysisChips = review.analysis.split("·").map((c) => c.trim());

  return (
    <section id="demo" className="relative border-t border-line">
      <div className="mx-auto max-w-[1120px] px-6 py-16 md:py-24">
        <Reveal>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 text-[11px] font-semibold tracking-[0.06em] text-ink-700">
              <span className="pulse-dot size-1.5 rounded-full bg-success-600" aria-hidden="true" />
              {t("liveLabel")}
            </span>
            <p className="text-xs font-semibold tracking-[0.08em] text-terracotta-500">
              {t("eyebrow")}
            </p>
          </div>
          <h2 className="mt-3 font-display text-[clamp(2.1rem,1.5rem+2vw,3.25rem)] font-semibold leading-[1.12] text-ink-900">
            {t("title")}
          </h2>
          <p className="lh-body mt-4 max-w-[56ch] text-[1.0625rem] text-ink-700">
            {t("subtitle")}
          </p>
        </Reveal>

        {/* ── The stage: browser-like window ─────────────────────────── */}
        <Reveal delay={120} className="mt-12">
          <div
            ref={stageRef}
            className="demo-in overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
            aria-label={t("title")}
          >
            {/* window chrome */}
            <div className="flex items-center gap-3 border-b border-line bg-sunken px-4 py-3">
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-terracotta-500/70" />
                <span className="size-2.5 rounded-full bg-star-400/70" />
                <span className="size-2.5 rounded-full bg-success-600/70" />
              </span>
              <p className="font-mono text-[11px] text-ink-500">
                atterna.app · <span className="text-ink-700">Ταβέρνα «Κύμα»</span>
              </p>
            </div>

            <div className="grid grid-cols-1 gap-0 lg:grid-cols-[5fr_7fr]">
              {/* ── Review column ─────────────────────────────────── */}
              <div
                key={idx}
                className="demo-slide border-b border-line p-5 sm:p-6 lg:border-b-0 lg:border-r"
              >
                <p className="font-mono text-[10px] font-semibold tracking-[0.08em] text-ink-300">
                  {t("inboxLabel")}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="flex text-star-400" aria-label={`${review.stars}/5`}>
                    {Array.from({ length: 5 }).map((_, i) =>
                      i < review.stars ? (
                        <IconStarFilled key={i} className="size-3.5" />
                      ) : (
                        <IconStar key={i} className="size-3.5 text-ink-300" />
                      )
                    )}
                  </span>
                  <span className="text-[13px] font-semibold text-ink-900">
                    {review.name}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-ink-300">{review.meta}</p>
                <blockquote className="lh-body mt-3 text-[15px] leading-relaxed text-ink-700">
                  «{review.text}»
                </blockquote>
              </div>

              {/* ── AI column ─────────────────────────────────────── */}
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-md bg-aegean-100 text-aegean-600">
                    <IconSparkles className="size-4" />
                  </span>
                  <p className="text-[13px] font-semibold text-ink-900">{t("aiLabel")}</p>
                </div>

                {phase === "analyzing" || phase === "arriving" ? (
                  <div className="mt-5 flex items-center gap-2 text-[13px] text-ink-500">
                    <span className="flex gap-1" aria-hidden="true">
                      <span className="dot-flash size-1.5 rounded-full bg-aegean-600" />
                      <span className="dot-flash size-1.5 rounded-full bg-aegean-600" />
                      <span className="dot-flash size-1.5 rounded-full bg-aegean-600" />
                    </span>
                    {t("analyzing")}
                  </div>
                ) : (
                  <>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {analysisChips.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full bg-sunken px-2.5 py-1 font-mono text-[10px] font-medium text-ink-700"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                    <p className="mt-5 font-mono text-[10px] font-semibold tracking-[0.08em] text-aegean-600">
                      {t("draftLabel")}
                    </p>
                    <p className="lh-body mt-2 min-h-[96px] text-[15px] leading-relaxed text-ink-700">
                      {review.reply.slice(0, typed)}
                      {phase === "typing" && (
                        <span className="type-caret" aria-hidden="true" />
                      )}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* ── Action bar ─────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-4 border-t border-line bg-sunken px-5 py-4">
              {phase === "published" ? (
                <p className="flex items-center gap-2 text-[13px] font-semibold text-success-600">
                  <IconCheck className="size-4" />
                  {t("published")}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={publish}
                  disabled={phase !== "ready"}
                  className={cn(
                    "inline-flex h-10 min-w-[14.5rem] items-center justify-center gap-2 whitespace-nowrap rounded-md px-5 text-sm font-semibold transition-[background-color,transform,box-shadow,opacity] duration-200",
                    phase === "ready"
                      ? "bg-aegean-600 text-white shadow-sm hover:-translate-y-px hover:bg-aegean-700 hover:shadow-md active:translate-y-0"
                      : "cursor-default bg-ink-300/40 text-ink-300"
                  )}
                >
                  {phase === "publishing" || phase === "typing" || phase === "analyzing" ? (
                    <IconRefresh className="size-4" />
                  ) : (
                    <IconSend className="size-4" />
                  )}
                  {phase === "publishing" ? t("publishing") : t("publish")}
                </button>
              )}

              <p className="hidden text-[12px] text-ink-300 sm:block">{t("autoHint")}</p>

              <div className="ml-auto flex items-center gap-3">
                <span className="flex gap-1.5" aria-hidden="true">
                  {reviews.map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        i === idx ? "w-5 bg-aegean-600" : "w-1.5 bg-ink-300/50"
                      )}
                    />
                  ))}
                </span>
                <button
                  type="button"
                  onClick={replay}
                  className="flex size-8 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-surface hover:text-ink-900"
                  aria-label={t("replay")}
                  title={t("replay")}
                >
                  <IconRefresh className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
