// src/components/dashboard/intel/health-card.tsx — the Reputation Health
// hero (spec §13): deterministic score + change + confidence annotation +
// subscore breakdown + the cached AI narrative (if any). Pure display —
// every number was computed by app code.
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import type { ScoreResult } from "@/lib/reputation/score";
import type { ScoreChange } from "@/lib/reputation/score";

const SUBSCORE_LABELS: Record<string, { el: string; en: string }> = {
  rating: { el: "Βαθμολογία", en: "Rating" },
  sentiment: { el: "Συναισθήματα", en: "Sentiment" },
  response: { el: "Απαντήσεις", en: "Responses" },
  trend: { el: "Τάση", en: "Trend" },
  issues: { el: "Θέματα", en: "Issues" },
  velocity: { el: "Ρυθμός", en: "Velocity" },
};

export async function HealthCard({
  score,
  change,
  narrative,
  locale,
}: {
  score: ScoreResult;
  change: ScoreChange;
  narrative: string | null;
  locale: string;
}) {
  const t = await getTranslations({ namespace: "dashboard.intel.health", locale });
  const tone =
    score.score >= 75 ? "good" : score.score >= 50 ? "warn" : "bad";
  const toneClass =
    tone === "good"
      ? "text-success-600"
      : tone === "warn"
        ? "text-terracotta-500"
        : "text-danger-600";

  const confidenceKey = score.confidence.level;

  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-end gap-4">
          <div>
            <p className="text-[13px] font-medium text-ink-500">{t("label")}</p>
            <p className={cn("font-display text-[64px] leading-none font-semibold tabular-nums", toneClass)}>
              {score.score}
              <span className="text-2xl font-medium text-ink-300">/100</span>
            </p>
          </div>
          <div className="pb-2">
            {change.delta === null ? (
              <p className="text-[13px] text-ink-300">{t("noChange")}</p>
            ) : (
              <p
                className={cn(
                  "font-display text-xl font-semibold tabular-nums",
                  change.delta > 0
                    ? "text-success-600"
                    : change.delta < 0
                      ? "text-danger-600"
                      : "text-ink-500"
                )}
              >
                {change.delta > 0 ? "↑" : change.delta < 0 ? "↓" : "±"}
                {Math.abs(change.delta)}
                <span className="ml-1.5 text-[11px] font-normal text-ink-300">
                  {t("change")}
                </span>
              </p>
            )}
            <p className="mt-1 text-[11px] leading-snug text-ink-300">
              {t(`confidence.${confidenceKey}`, { count: score.confidence.reviews90d })}
            </p>
          </div>
        </div>

        {/* subscore bars — the deterministic recipe, visible at a glance */}
        <div className="min-w-[260px] flex-1">
          <div className="space-y-1.5">
            {score.subscores.map((s) => (
              <div key={s.key} className="flex items-center gap-3">
                <p className="w-[7.5rem] shrink-0 text-[11px] font-medium text-ink-500">
                  {locale === "en"
                    ? SUBSCORE_LABELS[s.key]?.en
                    : SUBSCORE_LABELS[s.key]?.el}
                </p>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                  <div
                    className="h-full rounded-full bg-aegean-600/70"
                    style={{ width: `${Math.round(s.value)}%` }}
                  />
                </div>
                <p className="w-8 shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-500">
                  {Math.round(s.value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {narrative && (
        <p className="lh-body mt-4 border-t border-line pt-4 text-sm leading-relaxed text-ink-700">
          {narrative}
        </p>
      )}
    </section>
  );
}
