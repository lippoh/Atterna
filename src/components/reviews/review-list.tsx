// src/components/reviews/review-list.tsx — compact review rows (server)
// Summary → "see reviews" → filters → raw data (progressive disclosure,
// Table 11.1). Stars render as text pairs, never color-only.
// V2.1 fix: next/link is swapped for the i18n-aware Link — with
// localePrefix "as-needed" the default locale must stay unprefixed, so
// hand-built /{locale}/... hrefs forced a redirect on every Greek row.
import { Link } from "@/i18n/navigation";
import { LanguageBadge } from "./language-badge";
export interface ReviewListRow {
  id: string;
  rating: number;
  text: string | null;
  language: string | null;
  reviewerName: string | null;
  receivedAt: Date;
  replyStatus: "none" | "draft" | "approved" | "published" | "failed";
  sentiment?: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null;
}
const REPLY_LABEL: Record<ReviewListRow["replyStatus"], { el: string; en: string; cls: string }>
    = {
  none: { el: "χωρίς απάντηση", en: "unanswered", cls: "bg-rose-100 text-rose-800" },
  draft: { el: "πρόχειρο", en: "draft", cls: "bg-amber-100 text-amber-800" },
  approved: { el: "εγκεκριμένο", en: "approved", cls: "bg-blue-100 text-blue-800" },
  published: { el: "δημοσιεύτηκε", en: "published", cls: "bg-emerald-100 text-emerald-800" },
  failed: { el: "απέτυχε", en: "failed", cls: "bg-slate-200 text-slate-800" },
};
function stars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}
export function ReviewList({ rows, locale = "el" }: { rows: ReviewListRow[]; locale?: string }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        {locale === "en" ? "No reviews in this view yet." : "Δεν υπάρχουν κριτικές σε αυτή την προβολή."}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const reply = REPLY_LABEL[row.replyStatus];

        return (
          <li key={row.id}>
            <Link
              locale={locale === "en" ? "en" : "el"}
              href={`/reviews/${row.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    row.rating <= 2
                      ? "text-rose-500"
                      : row.rating >= 4
                        ? "text-amber-500"
                        : "text-slate-400"
                  }
                >
                  {stars(row.rating)}
                </span>
                <LanguageBadge language={row.language} />
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${reply.cls}`}>
                  {locale === "en" ? reply.en : reply.el}
                </span>
                <span className="ml-auto text-xs text-slate-400">
                  {row.receivedAt.toLocaleDateString(locale === "en" ? "en-GB" : "el-GR")}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-700">
                {row.text ?? (locale === "en" ? "(no text — rating only)" : "(χωρίς κείμενο — μόνο βαθμολογία)")}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {row.reviewerName ?? (locale === "en" ? "Guest" : "Επισκέπτης")}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}