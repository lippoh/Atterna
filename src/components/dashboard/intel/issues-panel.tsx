// src/components/dashboard/intel/issues-panel.tsx — Recurring / Emerging
// issues + Recommended actions with the owner's status workflow (spec §18–20).
// Status changes are plain <form> server actions — no client JS needed.
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { categoryLabel } from "@/lib/metrics";
import { sourceLabel } from "@/lib/sources/registry";
import {
  setIssueStatusAction,
  setRecommendationStatusAction,
} from "@/app/[locale]/(app)/dashboard/actions";
import type { Issue, Recommendation } from "@prisma/client";

const SEVERITY_CLASS: Record<string, string> = {
  HIGH: "bg-danger-100 text-danger-600",
  MEDIUM: "bg-terracotta-100 text-terracotta-500",
  LOW: "bg-sunken text-ink-500",
};

const KIND_LABEL: Record<string, { el: string; en: string }> = {
  RECURRING: { el: "Επαναλαμβανόμενο", en: "Recurring" },
  EMERGING: { el: "Νεοεμφανιζόμενο", en: "Emerging" },
};

const TREND_LABEL: Record<string, { el: string; en: string }> = {
  UP: { el: "αυξανόμενο", en: "increasing" },
  DOWN: { el: "μειούμενο", en: "declining" },
  STABLE: { el: "σταθερό", en: "stable" },
};

function StatusButton({
  action,
  hidden,
  label,
  primary,
}: {
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={action}>
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <button
        type="submit"
        className={cn(
          "h-8 rounded-md px-3 text-[12px] font-semibold transition-colors",
          primary
            ? "bg-aegean-600 text-white hover:bg-aegean-700"
            : "border border-line-strong text-ink-700 hover:border-ink-500"
        )}
      >
        {label}
      </button>
    </form>
  );
}

export async function IssuesPanel({
  issues,
  recommendations,
  locale,
}: {
  issues: Issue[];
  recommendations: Recommendation[];
  locale: string;
}) {
  const t = await getTranslations({ namespace: "dashboard.intel", locale });
  const ti = await getTranslations({ namespace: "dashboard.intel.issues", locale });
  const tr = await getTranslations({ namespace: "dashboard.intel.recommendations", locale });
  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    month: "short",
    year: "numeric",
  });
  const visible = issues.filter((i) => i.status !== "DISMISSED" && i.status !== "RESOLVED");

  return (
    <div className="space-y-6">
      {/* ── Issues ─────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
        <h2 className="text-lg font-semibold text-ink-900">{ti("title")}</h2>
        {visible.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-500">{ti("empty")}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {visible.map((issue) => (
              <li
                key={issue.id}
                className="rounded-lg border border-line bg-sunken/60 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      SEVERITY_CLASS[issue.severity] ?? SEVERITY_CLASS.LOW
                    )}
                  >
                    {issue.kind === "EMERGING"
                      ? KIND_LABEL.EMERGING[locale === "en" ? "en" : "el"]
                      : KIND_LABEL.RECURRING[locale === "en" ? "en" : "el"]}
                    {" · "}
                    {issue.severity}
                  </span>
                  <p className="text-[15px] font-semibold text-ink-900">
                    {categoryLabel(issue.category, locale)}
                  </p>
                  <span className="ml-auto font-mono text-[12px] tabular-nums text-ink-500">
                    {ti("mentions", { count: issue.mentionsCurrent })}
                  </span>
                </div>
                {/* Stage D drill-down: the evidence link lands on the reviews
                    list pre-filtered to this issue's category. */}
                <Link
                  href={{
                    pathname: "/reviews",
                    query: { topic: issue.category, filter: "negative" },
                  }}
                  className="link-grow mt-1 inline-block text-[12px] font-semibold text-aegean-600"
                >
                  {ti("viewEvidence")}
                </Link>
                <p className="mt-1.5 text-[12px] text-ink-500">
                  {issue.trend === "UP" ? "↑ " : issue.trend === "DOWN" ? "↓ " : "→ "}
                  {locale === "en"
                    ? TREND_LABEL[issue.trend]?.en
                    : TREND_LABEL[issue.trend]?.el}
                  {issue.kind === "EMERGING" ? ` · ${ti("vs90")}` : ""}
                  {" · "}
                  {issue.sources
                    .slice(0, 3)
                    .map((s) => sourceLabel(s, locale))
                    .join(", ")}
                  {" · "}
                  {ti("firstDetected", { date: dateFmt.format(issue.firstDetectedAt) })}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {issue.status === "OPEN" && (
                    <StatusButton
                      action={setIssueStatusAction}
                      hidden={{ issueId: issue.id, status: "IN_PROGRESS" }}
                      label={ti("start")}
                      primary
                    />
                  )}
                  <StatusButton
                    action={setIssueStatusAction}
                    hidden={{ issueId: issue.id, status: "RESOLVED" }}
                    label={ti("resolve")}
                  />
                  <StatusButton
                    action={setIssueStatusAction}
                    hidden={{ issueId: issue.id, status: "DISMISSED" }}
                    label={ti("dismiss")}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Recommended actions ─────────────────────────────────────── */}
      <section className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
        <h2 className="text-lg font-semibold text-ink-900">{tr("title")}</h2>
        {recommendations.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-500">{tr("empty")}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {recommendations.map((rec) => (
              <li
                key={rec.id}
                className={cn(
                  "rounded-lg border bg-sunken/60 p-4",
                  rec.impact === "HIGH" ? "border-danger-600/30" : "border-line"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      SEVERITY_CLASS[rec.impact] ?? SEVERITY_CLASS.LOW
                    )}
                  >
                    {tr(`impact.${rec.impact}`)}
                  </span>
                  <p className="text-[15px] font-semibold text-ink-900">{rec.title}</p>
                </div>
                {rec.steps.length > 0 && (
                  <ol className="mt-2.5 space-y-1.5">
                    {rec.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[10px] font-semibold text-ink-500">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {rec.status === "OPEN" && (
                    <StatusButton
                      action={setRecommendationStatusAction}
                      hidden={{ recommendationId: rec.id, status: "IN_PROGRESS" }}
                      label={tr("start")}
                      primary
                    />
                  )}
                  <StatusButton
                    action={setRecommendationStatusAction}
                    hidden={{ recommendationId: rec.id, status: "RESOLVED" }}
                    label={tr("resolve")}
                  />
                  <StatusButton
                    action={setRecommendationStatusAction}
                    hidden={{ recommendationId: rec.id, status: "DISMISSED" }}
                    label={tr("dismiss")}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[11px] leading-snug text-ink-300">{t("loopHint")}</p>
      </section>
    </div>
  );
}
