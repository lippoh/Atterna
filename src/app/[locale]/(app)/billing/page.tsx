// src/app/[locale]/(app)/billing/page.tsx — plan, usage, checkout, portal
// (§ billing): current plan card with status chip + usage, three plan
// cards (middle highlighted), portal access. Checkout/portal actions
// preserved verbatim; impersonated sessions are blocked from money
// actions.
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/db";
import { monthlyUsage } from "@/ai/usage";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe";
import { PLAN_LIMITS, type PlanKey } from "@/lib/billing/price-map";
import { stripeTrialEligible } from "@/lib/billing/trial";
import { Button } from "@/components/ui/button";
import { IconCheckCircle, IconAlertTriangle, IconCheck } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

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
    // First-subscription-only trial, enforced server-side: a 30-day
    // Stripe trial is granted only while the organization has never held
    // a Stripe subscription (stripeSubscriptionId is written exclusively
    // by the webhook). Plan changes start billing immediately — the
    // Billing Portal handles plan switches with proration. The form
    // (client input) cannot influence eligibility.
    const existing = await prisma.subscription.findUnique({
      where: { organizationId: currentOrg },
      select: { stripeSubscriptionId: true },
    });
    const trialDays = stripeTrialEligible(existing) ? 30 : undefined;
    const { url } = await createCheckoutSession({
      orgId: currentOrg,
      planKey,
      customerEmail: org?.stripeCustomerId ? undefined : user.email,
      trialDays,
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
  const numberFmt = new Intl.NumberFormat(locale === "en" ? "en-GB" : "el-GR");

  return (
    <main id="main-content" className="mx-auto max-w-[840px] px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-ink-900">{t("title")}</h1>

      {success && (
        <p className="mt-5 flex items-start gap-2.5 rounded-lg bg-success-100/70 px-4 py-3 text-sm font-medium text-success-600">
          <IconCheckCircle className="mt-0.5 size-4 shrink-0" />
          {t("success")}
        </p>
      )}
      {canceled && (
        <p className="mt-5 flex items-start gap-2.5 rounded-lg bg-terracotta-100/70 px-4 py-3 text-sm font-medium text-terracotta-500">
          <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
          {t("canceled")}
        </p>
      )}

      {/* Current plan + usage */}
      <section className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
        <h2 className="text-lg font-semibold text-ink-900">{t("currentPlan")}</h2>
        {sub ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-aegean-100 px-3 py-1 text-[13px] font-semibold text-aegean-600">
              {sub.planKey}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-[13px] font-medium text-ink-700">
              <span className="size-2 rounded-full bg-ink-300" aria-hidden="true" />
              {t(`status.${sub.status}`)}
            </span>
            {sub.status === "TRIALING" && (
              <p className="text-sm text-ink-500">
                {t("trialEnds", { date: trialEnds ?? "" })}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-500">—</p>
        )}
        <div className="mt-5 rounded-md bg-sunken px-4 py-3">
          <p className="text-[13px] font-medium text-ink-500">{t("usage")}</p>
          <p className="mt-1 font-mono text-sm tabular-nums text-ink-900">
            {t("usageCalls", {
              calls: numberFmt.format(usage.calls),
              tokens: numberFmt.format(usage.tokensIn + usage.tokensOut),
            })}
          </p>
        </div>
      </section>

      {/* Plan selection */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-ink-900">{t("choose")}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(["STARTER", "GROWTH", "PRO"] as const).map((planKey) => {
            const plan = PLAN_LIMITS[planKey];
            const popular = planKey === "GROWTH";
            const current = sub?.planKey === planKey;
            return (
              <form
                key={planKey}
                action={checkoutAction}
                className={cn(
                  "relative flex flex-col rounded-lg border bg-surface p-5 shadow-xs transition-[transform,box-shadow] duration-[220ms] ease-out hover:-translate-y-0.5 hover:shadow-md",
                  popular ? "border-aegean-600" : "border-line"
                )}
              >
                <input type="hidden" name="plan" value={planKey} />
                {popular && (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-aegean-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    {locale === "en" ? "Most popular" : "Δημοφιλέστερο"}
                  </span>
                )}
                <p className="font-display text-lg font-semibold text-ink-900">{planKey}</p>
                <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-ink-900">
                  €{plan.priceMonthly}
                  <span className="text-[13px] font-normal text-ink-500">/{locale === "en" ? "mo" : "μήνα"}</span>
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
                  {numberFmt.format(plan.reviewQuota)} {locale === "en" ? "reviews/mo" : "κριτικές/μήνα"} ·{" "}
                  {plan.businessQuota} {locale === "en" ? "business(es)" : "επιχείρηση/σεις"}
                </p>
                <Button
                  type="submit"
                  size="sm"
                  variant={current ? "secondary" : "default"}
                  className="mt-5"
                  disabled={Boolean(session?.user?.impersonatedBy)}
                >
                  {current && <IconCheck className="size-4" />}
                  {t("checkout")}
                </Button>
              </form>
            );
          })}
        </div>
        <p className="mt-4 text-center text-[13px] text-ink-500">
          {locale === "en" ? "VAT included · cancel anytime" : "Με ΦΠΑ · ακύρωση όποτε θέλετε"}
        </p>
      </section>

      {org.stripeCustomerId && (
        <form action={portalAction} className="mt-6">
          <Button type="submit" variant="outline" size="sm">
            {t("portal")}
          </Button>
        </form>
      )}
    </main>
  );
}
