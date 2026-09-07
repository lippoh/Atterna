// src/app/[locale]/(app)/reviews/[id]/page.tsx — review detail + draft editor
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireOrg } from "@/lib/session";
import { getScopedReview } from "@/lib/tenant";
import { LanguageBadge } from "@/components/reviews/language-badge";
import { DraftEditor } from "@/components/reviews/draft-editor";
import { generateDraft, saveDraft, approveDraft } from "./actions";
import { categoryLabel } from "@/lib/metrics";
import { Badge } from "@/components/ui/badge";

interface ComplaintItem {
  category: string;
  severity: number;
  summary: string;
}

interface ComplimentItem {
  category: string;
  summary: string;
}

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
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

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={review.rating <= 2 ? "text-rose-500" : review.rating >= 4 ? "text-amber-500" : "text-slate-400"}>
            {"★".repeat(review.rating) + "☆".repeat(5 - review.rating)}
          </span>
          <LanguageBadge language={review.language} />
          <span className="ml-auto text-xs text-slate-400">
            {review.receivedAt.toLocaleDateString(locale === "en" ? "en-GB" : "el-GR")}
          </span>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{review.text ?? "—"}</p>
        <p className="mt-2 text-xs text-slate-400">
          {review.reviewerName ?? (locale === "en" ? "Guest" : "Επισκέπτης")}
        </p>
      </section>

      {review.analysis && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold text-slate-900">{t("analysis")}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={review.analysis.sentiment === "NEGATIVE" ? "destructive" : review.analysis.sentiment === "POSITIVE" ? "success" : "secondary"}>
              {review.analysis.sentiment}
            </Badge>
            <Badge variant="outline">{t("urgency")}: {review.analysis.urgency}</Badge>
          </div>

          {topics.length > 0 && (
            <>
              <p className="mt-3 text-xs font-semibold text-slate-500">{t("topics")}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {topics.map((topic) => (
                  <Badge key={topic} variant="secondary">
                    {categoryLabel(topic, locale)}
                  </Badge>
                ))}
              </div>
            </>
          )}

          {complaints.length > 0 && (
            <>
              <p className="mt-3 text-xs font-semibold text-slate-500">{t("complaints")}</p>
              <ul className="mt-1 space-y-1.5">
                {complaints.map((c, i) => (
                  <li key={i} className="rounded-lg bg-rose-50 p-2 text-xs text-slate-700">
                    <strong>{categoryLabel(c.category, locale)}</strong> · {c.severity}/5 — {c.summary}
                  </li>
                ))}
              </ul>
            </>
          )}

          {compliments.length > 0 && (
            <>
              <p className="mt-3 text-xs font-semibold text-slate-500">{t("compliments")}</p>
              <ul className="mt-1 space-y-1.5">
                {compliments.map((c, i) => (
                  <li key={i} className="rounded-lg bg-emerald-50 p-2 text-xs text-slate-700">
                    <strong>{categoryLabel(c.category, locale)}</strong> — {c.summary}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

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
        }}
        actions={{ generateDraft, saveDraft, approveDraft }}
      />
    </main>
  );
}