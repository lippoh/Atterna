// src/components/dashboard/intel/signals-feed.tsx — Recent customer signals
// (Stage D): the latest voices, not just metrics. Merges the newest
// reviews with the newest direct-feedback submissions into one
// time-ordered feed. Every row links to its detail; unanswered reviews
// carry a visible reply flag. Pure display over bounded queries.
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  IconStarFilled,
  IconArrowRight,
  IconQr,
} from "@/components/ui/icons";
import { sourceLabel } from "@/lib/sources/registry";
import { cn } from "@/lib/utils";

export interface SignalReview {
  kind: "review";
  id: string;
  rating: number;
  text: string | null;
  reviewerName: string | null;
  source: string | null;
  receivedAt: Date;
  replied: boolean;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null;
}

export interface SignalFeedback {
  kind: "feedback";
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

export type SignalItem = SignalReview | SignalFeedback;

const SENTIMENT_DOT: Record<string, string> = {
  POSITIVE: "bg-success-600",
  NEUTRAL: "bg-ink-300",
  NEGATIVE: "bg-danger-600",
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex shrink-0 text-star-400" aria-label={`${rating}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <IconStarFilled
          key={i}
          className={cn("size-3.5", i >= rating && "text-ink-300")}
        />
      ))}
    </span>
  );
}

export async function SignalsFeed({
  items,
  locale,
}: {
  items: SignalItem[];
  locale: string;
}) {
  const t = await getTranslations({ namespace: "dashboard.intel.signals", locale });
  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    day: "numeric",
    month: "short",
  });

  return (
    <section
      aria-labelledby="signals-title"
      className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="signals-title" className="text-lg font-semibold text-ink-900">
          {t("title")}
        </h2>
        <Link
          href="/reviews"
          className="link-grow inline-flex items-center gap-1 text-[13px] font-semibold text-aegean-600"
        >
          {t("viewAll")}
          <IconArrowRight className="size-3.5" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-500">{t("empty")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {items.map((item) => {
            const at = item.kind === "review" ? item.receivedAt : item.createdAt;
            return (
              <li key={`${item.kind}-${item.id}`} className="py-3 first:pt-0 last:pb-0">
                {item.kind === "review" ? (
                  <Link
                    href={`/reviews/${item.id}`}
                    className="group block rounded-md transition-colors focus-visible:bg-sunken"
                  >
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <Stars rating={item.rating} />
                      {item.sentiment && (
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            SENTIMENT_DOT[item.sentiment]
                          )}
                          aria-label={item.sentiment}
                          title={item.sentiment}
                        />
                      )}
                      {item.source && (
                        <span className="rounded-full border border-line-strong px-2 py-0.5 text-[10px] font-medium text-ink-500">
                          {sourceLabel(item.source, locale)}
                        </span>
                      )}
                      {!item.replied && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta-100 px-2.5 py-0.5 text-[11px] font-semibold text-terracotta-500">
                          <span className="pulse-dot size-1.5 rounded-full bg-current" aria-hidden="true" />
                          {t("needsReply")}
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-300">
                        {dateFmt.format(at)}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 max-w-[70ch] text-sm leading-relaxed text-ink-700 group-hover:text-ink-900">
                      {item.text ??
                        (locale === "en"
                          ? "(no text — rating only)"
                          : "(χωρίς κείμενο — μόνο βαθμολογία)")}
                    </p>
                    <p className="mt-1 text-[13px] text-ink-500">
                      {item.reviewerName ?? (locale === "en" ? "Guest" : "Επισκέπτης")}
                    </p>
                  </Link>
                ) : (
                  <div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <Stars rating={item.rating} />
                      <span className="inline-flex items-center gap-1 rounded-full bg-aegean-100 px-2 py-0.5 text-[10px] font-semibold text-aegean-600">
                        <IconQr className="size-3" />
                        {t("direct")}
                      </span>
                      <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-300">
                        {dateFmt.format(at)}
                      </span>
                    </div>
                    {item.comment && (
                      <p className="mt-1.5 line-clamp-2 max-w-[70ch] text-sm leading-relaxed text-ink-700">
                        {item.comment}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
