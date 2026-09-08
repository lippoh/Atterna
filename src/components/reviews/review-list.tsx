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
  none: { el: "χωρίς απάντηση", en: "unanswered", cls: "bg-danger-100 text-danger-600" },
  draft: { el: "πρόχειρο", en: "draft", cls: "bg-terracotta-100 text-terracotta-500" },
  approved: { el: "εγκεκριμένο", en: "approved", cls: "bg-aegean-100 text-aegean-700" },
  published: { el: "δημοσιεύτηκε", en: "published", cls: "bg-success-100 text-success-600" },
  failed: { el: "απέτυχε", en: "failed", cls: "bg-sunken text-ink-700" },
};
function stars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}
export function ReviewList({ rows, locale = "el" }: { rows: ReviewListRow[]; locale?: string }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-surface p-6 text-center text-sm text-ink-500">
        {locale === "en" ? "No reviews in this view yet." : "Δεν υπάρχουν κριτικές σε αυτή την προβολή."}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface shadow-xs">
      {rows.map((row) => {
        const reply = REPLY_LABEL[row.replyStatus];

        return (
          <li key={row.id}>
            <Link
              locale={locale === "en" ? "en" : "el"}
              href={`/reviews/${row.id}`}
              className="block p-5 transition-colors hover:bg-sunken focus-visible:bg-sunken"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    row.rating <= 2
                      ? "text-danger-600"
                      : row.rating >= 4
                        ? "text-star-400"
                        : "text-ink-300"
                  }
                >
                  {stars(row.rating)}
                </span>
                <LanguageBadge language={row.language} />
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${reply.cls}`}>
                  {locale === "en" ? reply.en : reply.el}
                </span>
                <span className="ml-auto font-mono text-xs text-ink-300">
                  {new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", { dateStyle: "medium" }).format(row.receivedAt)}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-ink-700">
                {row.text ?? (locale === "en" ? "(no text — rating only)" : "(χωρίς κείμενο — μόνο βαθμολογία)")}
              </p>
              <p className="mt-2 text-xs text-ink-500">
                {row.reviewerName ?? (locale === "en" ? "Guest" : "Επισκέπτης")}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}