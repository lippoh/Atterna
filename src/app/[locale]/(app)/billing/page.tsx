// src/app/[locale]/(app)/billing/page.tsx — plan, usage, checkout, portal
// createCheckout creates a Stripe Checkout Session (read-only wrt
// subscription state); the webhook is the only writer (Section 27).
// Impersonated sessions are blocked from money actions.
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/db";
import { monthlyUsage } from "@/ai/usage";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe";
import { PLAN_LIMITS, type PlanKey } from "@/lib/billing/price-map";
import { Button } from "@/components/ui/button";
export default async function BillingPage({
searchParams,
}: {
searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
const { orgId } = await requireOrg();
const locale = await getLocale();
const { success, canceled } = await searchParams;
const t = await getTranslations({ namespace: "billing", locale });
const [session, org, usage] = await Promise.all([
auth(),
prisma.organization.findUniqueOrThrow({
where: { id: orgId },
include: { subscription: true },
}),
monthlyUsage(orgId),
]);
async function checkoutAction(formData: FormData) {
"use server";
const currentSession = await auth();
if (currentSession?.user?.impersonatedBy) {
redirect(`/${locale}/billing?error=impersonation`);
}
const { orgId: currentOrg, user } = await requireOrg();
const planKey = String(formData.get("plan") ?? "STARTER") as PlanKey;
const { url } = await createCheckoutSession({
orgId: currentOrg,
planKey,
customerEmail: org?.stripeCustomerId ? undefined : user.email,
trialDays: 30, // 30-day trial, no card charge up front
locale,
});
redirect(url);
}
async function portalAction() {
"use server";
const currentSession = await auth();
if (currentSession?.user?.impersonatedBy) {
redirect(`/${locale}/billing?error=impersonation`);
}
const { orgId: currentOrg } = await requireOrg();
const currentOrg2 = await prisma.organization.findUnique({
where: { id: currentOrg },
select: { stripeCustomerId: true },
});
if (!currentOrg2?.stripeCustomerId) redirect(`/${locale}/billing?error=no-customer`);
const { url } = await createPortalSession({
customerId: currentOrg2.stripeCustomerId,
locale,
});
redirect(url);
}
const sub = org.subscription;
const trialEnds = sub?.currentPeriodEnd?.toLocaleDateString(
locale === "en" ? "en-GB" : "el-GR"
);
return (
<main className="mx-auto max-w-2xl space-y-5 p-4">
<h1 className="text-xl font-semibold">{t("title")}</h1>
{success && (
<p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm
text-emerald-800">
{t("success")}
</p>
)}
{canceled && (
<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
{t("canceled")}
</p>
)}
<section className="rounded-xl border border-slate-200 bg-white p-4">
<h2 className="text-sm font-bold text-slate-900">{t("currentPlan")}</h2>
{sub ? (
<div className="mt-2 space-y-1 text-sm text-slate-700">
<p>
{sub.planKey} — {t(`status.${sub.status}`)}
</p>
{sub.status === "TRIALING" && <p>{t("trialEnds", { date: trialEnds ?? "" })}</p>}
</div>
) : (
<p className="mt-2 text-sm text-slate-500">—</p>
)}
<p className="mt-3 text-xs text-slate-500">
{t("usage")}: {t("usageCalls", { calls: usage.calls, tokens: usage.tokensIn +
usage.tokensOut })}
</p>
</section>
<section className="space-y-3">
<h2 className="text-sm font-bold text-slate-900">{t("choose")}</h2>
{(["STARTER", "GROWTH", "PRO"] as const).map((planKey) => {
const plan = PLAN_LIMITS[planKey];
return (
<form
key={planKey}
action={checkoutAction}
className="rounded-xl border border-slate-200 bg-white p-4"
>
<input type="hidden" name="plan" value={planKey} />
<div className="flex items-baseline justify-between">
<p className="font-bold text-slate-900">{planKey}</p>
<p className="text-lg font-bold text-blue-800">€{plan.priceMonthly}/mo</p>
</div>
<p className="mt-1 text-xs text-slate-500">
{plan.reviewQuota.toLocaleString()} reviews/mo ·{" "}
{plan.businessQuota} business{plan.businessQuota > 1 ? "es" : ""}
</p>
<Button
type="submit"
size="sm"
variant={sub?.planKey === planKey ? "secondary" : "default"}
className="mt-3"
disabled={Boolean(session?.user?.impersonatedBy)}
>
{t("checkout")}
</Button>
</form>
);
})}
</section>
{org.stripeCustomerId && (
<form action={portalAction}>
<Button type="submit" variant="outline" size="sm">
{t("portal")}
</Button>
</form>
)}
</main>
);
}