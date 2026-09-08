// src/app/[locale]/(app)/reviews/[id]/page.tsx — review detail + draft editor
// (§9.5): breadcrumbs, two columns 7/5 — left: review panel + AI analysis
// (sentiment chip, topic chips, complaints/compliments) + status timeline;
// right: the sticky DraftEditor.
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireOrg } from "@/lib/session";
import { getScopedReview } from "@/lib/tenant";
import { LanguageBadge } from "@/components/reviews/language-badge";
import { DraftEditor } from "@/components/reviews/draft-editor";
import { generateDraft, saveDraft, approveDraft } from "./actions";
import { categoryLabel } from "@/lib/metrics";
import { Link } from "@/i18n/navigation";
import { IconStarFilled, IconThumbsDown, IconThumbsUp, IconArrowLeft } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface ComplaintItem {
  category: string;
  severity: number;
  summary: string;
}
interface ComplimentItem {
  category: string;
  summary: string;
}

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const { orgId } = await requireOrg();

  let review;
  try {
    review = await getScopedReview(orgId, id);
  } catch {
    notFound();
  }

  const locale = await getLocale();
  const t = await getTranslations({ namespace: "reviews", locale });
  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const complaints = Array.isArray(review.analysis?.complaints)
    ? (review.analysis.complaints as unknown as ComplaintItem[])
    : [];
  const compliments = Array.isArray(review.analysis?.compliments)
    ? (review.analysis.compliments as unknown as ComplimentItem[])
    : [];
  const topics = review.analysis?.topics ?? [];

  const latestDraft = review.drafts
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const draftStatus: "none" | "DRAFT" | "EDITED" | "APPROVED" | "PUBLISHED" | "FAILED" =
    latestDraft
      ? latestDraft.status === "REJECTED"
        ? "none"
        : (latestDraft.status as "DRAFT" | "EDITED" | "APPROVED" | "PUBLISHED" | "FAILED")
      : "none";
  const draftText = latestDraft?.editedText ?? latestDraft?.text ?? null;

  const sentiment = review.analysis?.sentiment;
  const sentimentVariant =
    sentiment === "NEGATIVE" ? "destructive" : sentiment === "POSITIVE" ? "success" : "secondary";

  return (
    <main id="main-content" className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
      {/* breadcrumbs */}
      <nav className="flex items-center gap-2 text-[13px] text-ink-500" aria-label="Breadcrumb">
        <Link href="/reviews" className="inline-flex items-center gap-1.5 transition-colors hover:text-aegean-600">
          <IconArrowLeft className="size-3.5" />
          {t("title")}
        </Link>
      </nav>

      <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-[7fr_5fr]">
        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Review panel */}
          <section className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex text-star-400" aria-label={`${review.rating}/5`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <IconStarFilled
                    key={i}
                    className={cn("size-4", i >= review.rating && "text-ink-300")}
                  />
                ))}
              </span>
              <LanguageBadge language={review.language} />
              <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-300">
                {dateFmt.format(review.receivedAt)}
              </span>
            </div>
            <p className="lh-body mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-700">
              {review.text ?? "—"}
            </p>
            <p className="mt-3 text-[13px] font-medium text-ink-500">
              {review.reviewerName ?? (locale === "en" ? "Guest" : "Επισκέπτης")}
            </p>
          </section>

          {/* AI analysis */}
          {review.analysis && (
            <section className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
              <h2 className="text-lg font-semibold text-ink-900">{t("analysis")}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold",
                    sentimentVariant === "destructive" && "bg-danger-100 text-danger-600",
                    sentimentVariant === "success" && "bg-success-100 text-success-600",
                    sentimentVariant === "secondary" && "bg-sunken text-ink-700"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2 rounded-full",
                      sentiment === "NEGATIVE" && "bg-danger-600",
                      sentiment === "POSITIVE" && "bg-success-600",
                      sentiment !== "NEGATIVE" && sentiment !== "POSITIVE" && "bg-ink-300"
                    )}
                  />
                  {review.analysis.sentiment}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 text-[13px] font-medium text-ink-700">
                  {t("urgency")}: {review.analysis.urgency}
                </span>
              </div>

              {topics.length > 0 && (
                <>
                  <p className="mt-4 text-[13px] font-semibold text-ink-500">{t("topics")}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {topics.map((topic) => (
                      <span
                        key={topic}
                        className="rounded-full bg-sunken px-2.5 py-1 text-[12px] font-medium text-ink-700"
                      >
                        {categoryLabel(topic, locale)}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {complaints.length > 0 && (
                <>
                  <p className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-ink-500">
                    <IconThumbsDown className="size-3.5 text-danger-600" />
                    {t("complaints")}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {complaints.map((c, i) => (
                      <li
                        key={i}
                        className="rounded-md bg-danger-100/70 px-3 py-2.5 text-[13px] leading-relaxed text-ink-700"
                      >
                        <strong className="text-ink-900">{categoryLabel(c.category, locale)}</strong>{" "}
                        · {c.severity}/5 — {c.summary}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {compliments.length > 0 && (
                <>
                  <p className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-ink-500">
                    <IconThumbsUp className="size-3.5 text-success-600" />
                    {t("compliments")}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {compliments.map((c, i) => (
                      <li
                        key={i}
                        className="rounded-md bg-success-100/70 px-3 py-2.5 text-[13px] leading-relaxed text-ink-700"
                      >
                        <strong className="text-ink-900">{categoryLabel(c.category, locale)}</strong>{" "}
                        — {c.summary}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {review.analysis.model && (
                <p className="mt-5 border-t border-line pt-3 font-mono text-[11px] text-ink-300">
                  {review.analysis.model} · prompt v{review.analysis.promptVersion}
                </p>
              )}
            </section>
          )}
        </div>

        {/* ── Right column: sticky draft editor ───────────────────────── */}
        <div className="lg:sticky lg:top-20">
          <DraftEditor
            reviewId={review.id}
            initialText={draftText}
            status={draftStatus}
            labels={{
              aiSuggestion: t("draft.aiSuggestion"),
              generate: t("draft.generate"),
              save: t("draft.save"),
              approve: t("draft.approve"),
              published: t("draft.published"),
              failed: t("draft.failed"),
              generating: t("draft.generating"),
              emptyHint: t("draft.emptyHint"),
              confirm: t("draft.confirm"),
              confirmYes: t("draft.confirmYes"),
              confirmNo: t("draft.confirmNo"),
              chars: t("draft.chars"),
            }}
            actions={{ generateDraft, saveDraft, approveDraft }}
          />
        </div>
      </div>
    </main>
  );
}
