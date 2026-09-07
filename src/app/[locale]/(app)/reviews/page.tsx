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
<main className="mx-auto max-w-2xl space-y-4 p-4">
<h1 className="text-xl font-semibold">{t("title")}</h1>
<nav className="flex flex-wrap gap-2">
{FILTERS.map((f) => (
<Link
key={f}
href={{ pathname: "/reviews", query: f === "all" ? {} : { filter: f } }}
className={`rounded-full px-3 py-1 text-xs font-semibold ${
f === active
? "bg-blue-700 text-white"
: "border border-slate-300 bg-white text-slate-600"
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