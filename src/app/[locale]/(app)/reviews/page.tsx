// src/app/[locale]/(app)/reviews/page.tsx — the review list + filters
// Same data pipeline (prisma + filters); the toolbar is a segmented
// chip row, rows render via the redesigned ReviewList, and the empty
// state follows §7.13 (icon, one line, one action).
import { getTranslations, getLocale } from "next-intl/server";
import { requireOrg } from "@/lib/session";
import { ReviewList, type ReviewListRow } from "@/components/reviews/review-list";
import { prisma } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { IconInbox, IconX } from "@/components/ui/icons";
import { normalizeSourceKey, sourceLabel } from "@/lib/sources/registry";
import { CATEGORY_VOCAB } from "@/ai/schemas";
import { categoryLabel } from "@/lib/metrics";
import { cn } from "@/lib/utils";

type Filter = "all" | "unanswered" | "negative" | "published";

const FILTERS: Filter[] = ["all", "unanswered", "negative", "published"];

const TOPICS = new Set<string>(CATEGORY_VOCAB);

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; source?: string; topic?: string }>;
}) {
  const { orgId } = await requireOrg();
  const locale = await getLocale();
  const { filter, source, topic } = await searchParams;
  const active = (FILTERS.includes(filter as Filter) ? filter : "all") as Filter;
  const activeSource = normalizeSourceKey(source ?? ""); // null when "all"/unknown
  // Stage D (issue drill-down): topic is validated against the closed
  // analysis vocabulary — unknown values are ignored, never error.
  const activeTopic = topic && TOPICS.has(topic) ? topic : null;
  const t = await getTranslations({ namespace: "reviews", locale });

  // Legacy rows (e.g. sync writes "GOOGLE") and new normalized keys both match.
  const sourceFilter = activeSource
    ? { source: { in: [activeSource, activeSource.toUpperCase()] } }
    : {};

  const where = {
    organizationId: orgId,
    deletedAt: null,
    ...(active === "unanswered" ? { repliedAt: null } : {}),
    ...(active === "negative" ? { rating: { lte: 3 } } : {}),
    ...(active === "published" ? { repliedAt: { not: null } } : {}),
    ...sourceFilter,
    ...(activeTopic ? { analysis: { topics: { has: activeTopic } } } : {}),
  };

  // Stage B: reviews list + source chips run in parallel (were sequential).
  const [reviews, sourceGroups] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: 50,
      include: {
        analysis: { select: { sentiment: true } },
        drafts: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    // Per-source filter chips — only shown when more than one source exists.
    prisma.review.groupBy({
      by: ["source"],
      where: { organizationId: orgId, deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const rows: ReviewListRow[] = reviews.map((r) => {
    const draft = r.drafts[0]?.status;
    const replyStatus: ReviewListRow["replyStatus"] = r.repliedAt
      ? "published"
      : draft === "FAILED"
        ? "failed"
        : draft === "APPROVED"
          ? "approved"
          : draft
            ? "draft"
            : "none";
    return {
      id: r.id,
      rating: r.rating,
      text: r.text,
      language: r.language,
      reviewerName: r.reviewerName,
      source: r.source,
      receivedAt: r.receivedAt,
      replyStatus,
      sentiment: r.analysis?.sentiment ?? null,
    };
  });

  // Per-source filter chips — only when more than one source is present.
  const showSourceChips = sourceGroups.length > 1;

  return (
    <main id="main-content" className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-ink-900">
        {t("title")}
      </h1>

      {/* Stage D: issue drill-down landing banner — shows which topic the
          dashboard linked from, with a one-click clear preserving filters. */}
      {activeTopic && (
        <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-aegean-600/30 bg-aegean-100 px-3.5 py-1.5 text-[13px] font-medium text-ink-700">
          {t("topicFilter", { topic: categoryLabel(activeTopic, locale) })}
          <Link
            href={{
              pathname: "/reviews",
              query: {
                ...(active === "all" ? {} : { filter: active }),
                ...(activeSource ? { source: activeSource } : {}),
              },
            }}
            aria-label={t("topicClear")}
            className="inline-flex size-5 items-center justify-center rounded-full text-aegean-600 transition-colors hover:bg-aegean-600 hover:text-white"
          >
            <IconX className="size-3" />
          </Link>
        </p>
      )}

      {/* segmented filter chips */}
      <nav className="mt-6 flex flex-wrap gap-2" aria-label={t("filter.ariaLabel")}>
        {FILTERS.map((f) => {
          const isActive = f === active;
          return (
            <Link
              key={f}
              href={{ pathname: "/reviews", query: { ...(f === "all" ? {} : { filter: f }), ...(activeSource ? { source: activeSource } : {}) } }}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-9 items-center rounded-full px-4 text-[13px] font-semibold transition-[background-color,border-color,color] duration-150",
                isActive
                  ? "bg-ink-900 text-white"
                  : "border border-line-strong bg-surface text-ink-700 hover:border-ink-500"
              )}
            >
              {t(`filter.${f}`)}
            </Link>
          );
        })}
      </nav>

      {/* per-source chips (multi-source, spec §24) */}
      {showSourceChips && (
        <nav className="mt-3 flex flex-wrap gap-2" aria-label={t("sourceFilter.ariaLabel")}>
          <Link
            href={{ pathname: "/reviews", query: active === "all" ? {} : { filter: active } }}
            aria-current={!activeSource ? "page" : undefined}
            className={cn(
              "flex h-8 items-center rounded-full px-3.5 text-[12px] font-semibold transition-[background-color,border-color,color] duration-150",
              !activeSource
                ? "bg-aegean-600 text-white"
                : "border border-line-strong bg-surface text-ink-500 hover:border-aegean-600"
            )}
          >
            {t("sourceFilter.all")}
          </Link>
          {sourceGroups.map((g) => {
            const key = normalizeSourceKey(g.source);
            if (!key) return null;
            const isActive = activeSource === key;
            return (
              <Link
                key={g.source}
                href={{ pathname: "/reviews", query: { ...(active === "all" ? {} : { filter: active }), source: key } }}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold transition-[background-color,border-color,color] duration-150",
                  isActive
                    ? "bg-aegean-600 text-white"
                    : "border border-line-strong bg-surface text-ink-500 hover:border-aegean-600"
                )}
              >
                {sourceLabel(g.source, locale)}
                <span className="font-mono text-[10px] tabular-nums opacity-70">
                  {g._count._all}
                </span>
              </Link>
            );
          })}
        </nav>
      )}

      <div className="mt-6">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-line bg-surface px-6 py-14 text-center">
            <IconInbox className="mx-auto size-10 text-ink-300" />
            <p className="mt-4 text-[15px] font-semibold text-ink-900">
              {t("emptyTitle")}
            </p>
            <p className="mt-1.5 text-sm text-ink-500">{t("empty")}</p>
            <Link
              href="/settings/sources"
              className="mt-5 inline-flex h-10 items-center rounded-md bg-aegean-600 px-4 text-sm font-semibold text-white shadow-xs transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:bg-aegean-700"
            >
              {t("emptySources")}
            </Link>
          </div>
        ) : (
          <ReviewList rows={rows} locale={locale} />
        )}
      </div>
    </main>
  );
}
