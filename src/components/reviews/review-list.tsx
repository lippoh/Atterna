// src/components/reviews/review-list.tsx — review rows (server)
// Desktop: table-like rows with hairline separators (§7.7). Mobile: the
// same rows collapse gracefully (flex-wrap). Stars are SVG glyphs, the
// reply status pairs a chip with a check/dot, and the whole row is a
// link with a visible focus ring. Dates Intl-formatted.
import { Link } from "@/i18n/navigation";
import { LanguageBadge } from "./language-badge";
import { IconCheck, IconStarFilled } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

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

const REPLY_LABEL: Record<
  ReviewListRow["replyStatus"],
  { el: string; en: string; cls: string; icon?: "check" | "dot" }
> = {
  none: { el: "χωρίς απάντηση", en: "unanswered", cls: "bg-terracotta-100 text-terracotta-500", icon: "dot" },
  draft: { el: "πρόχειρο", en: "draft", cls: "bg-sunken text-ink-700" },
  approved: { el: "εγκεκριμένο", en: "approved", cls: "bg-aegean-100 text-aegean-600" },
  published: { el: "απαντήθηκε", en: "answered", cls: "bg-success-100 text-success-600", icon: "check" },
  failed: { el: "απέτυχε", en: "failed", cls: "bg-danger-100 text-danger-600" },
};

const SENTIMENT_DOT: Record<string, string> = {
  POSITIVE: "bg-success-600",
  NEUTRAL: "bg-ink-300",
  NEGATIVE: "bg-danger-600",
};

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="flex shrink-0 text-star-400"
      aria-label={`${rating}/5`}
      title={`${rating}/5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <IconStarFilled
          key={i}
          className={cn("size-3.5", i >= rating && "text-ink-300")}
        />
      ))}
    </span>
  );
}

export function ReviewList({
  rows,
  locale = "el",
}: {
  rows: ReviewListRow[];
  locale?: string;
}) {
  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    day: "numeric",
    month: "short",
  });

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-surface p-6 text-center text-sm text-ink-500">
        {locale === "en"
          ? "No reviews in this view yet."
          : "Δεν υπάρχουν κριτικές σε αυτή την προβολή."}
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
              className="block p-4 transition-colors duration-150 hover:bg-sunken focus-visible:bg-sunken sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {row.sentiment && (
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      SENTIMENT_DOT[row.sentiment]
                    )}
                    aria-label={row.sentiment}
                    title={row.sentiment}
                  />
                )}
                <Stars rating={row.rating} />
                <LanguageBadge language={row.language} />
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    reply.cls
                  )}
                >
                  {reply.icon === "check" && <IconCheck className="size-3" />}
                  {reply.icon === "dot" && (
                    <span className="pulse-dot size-1.5 rounded-full bg-current" aria-hidden="true" />
                  )}
                  {locale === "en" ? reply.en : reply.el}
                </span>
                <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-300">
                  {dateFmt.format(row.receivedAt)}
                </span>
              </div>
              <p className="mt-2.5 line-clamp-2 max-w-[75ch] text-sm leading-relaxed text-ink-700">
                {row.text ??
                  (locale === "en"
                    ? "(no text — rating only)"
                    : "(χωρίς κείμενο — μόνο βαθμολογία)")}
              </p>
              <p className="mt-1.5 text-[13px] text-ink-500">
                {row.reviewerName ?? (locale === "en" ? "Guest" : "Επισκέπτης")}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
