// src/app/[locale]/(app)/reviews/page.tsx — the review list + filters
import { getTranslations, getLocale } from "next-intl/server";
import { requireOrg } from "@/lib/session";
import { ReviewList, type ReviewListRow } from "@/components/reviews/review-list";
import { prisma } from "@/lib/db";
import { Link } from "@/i18n/navigation";
type Filter = "all" | "unanswered" | "negative" | "published";
const FILTERS: Filter[] = ["all", "unanswered", "negative", "published"];
export default async function ReviewsPage({
searchParams,
}: {
searchParams: Promise<{ filter?: string }>;
}) {
const { orgId } = await requireOrg();
const locale = await getLocale();
const { filter } = await searchParams;
const active = (FILTERS.includes(filter as Filter) ? filter : "all") as Filter;
const t = await getTranslations({ namespace: "reviews", locale });
const where = {
organizationId: orgId,
deletedAt: null,
...(active === "unanswered" ? { repliedAt: null } : {}),
...(active === "negative" ? { rating: { lte: 3 } } : {}),
...(active === "published" ? { repliedAt: { not: null } } : {}),
};
const reviews = await prisma.review.findMany({
where,
orderBy: { receivedAt: "desc" },
take: 50,
include: {
analysis: { select: { sentiment: true } },
drafts: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
},
});
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
receivedAt: r.receivedAt,
replyStatus,
sentiment: r.analysis?.sentiment ?? null,
};
});
return (
<main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
<div><p className="text-xs font-semibold uppercase tracking-[.12em] text-terracotta-500">Atterna / inbox</p><h1 className="mt-2 font-display text-4xl font-semibold text-ink-900">{t("title")}</h1><p className="mt-2 text-sm text-ink-500">{locale === "en" ? "The reviews that need your attention, in one calm place." : "Οι κριτικές που χρειάζονται την προσοχή σας, σε ένα ήσυχο μέρος."}</p></div>
<nav className="flex flex-wrap gap-2 border-b border-line pb-4" aria-label="Review filters">
{FILTERS.map((f) => (
<Link
key={f}
href={{ pathname: "/reviews", query: f === "all" ? {} : { filter: f } }}
className={`rounded-full px-3 py-1 text-xs font-semibold ${
f === active
? "bg-aegean-600 text-white"
: "border border-line-strong bg-surface text-ink-500 hover:border-aegean-600"
}`}
>
{t(`filter.${f}`)}
</Link>
))}
</nav>
{rows.length === 0 ? (
<p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm
text-slate-500">
{t("empty")}
</p>
) : (
<ReviewList rows={rows} locale={locale} />
)}
</main>
);
}