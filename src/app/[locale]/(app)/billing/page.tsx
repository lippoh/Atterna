// src/app/[locale]/(app)/billing/page.tsx — plan, usage, checkout, portal
// (Stage F: premium billing feel, § billing): current-plan hero with
// status chip + review-quota progress (real review count vs plan quota),
// three plan cards with Current/Popular markers, Stripe error banners
// (impersonation + no-customer now surface instead of silent redirects),
// invoices from webhook-written rows, portal access. Checkout/portal
// actions preserved verbatim; impersonated sessions stay blocked from
// money actions. Route stays /billing — Stripe success/cancel/return
// URLs bake it in.
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
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { SettingsSubnav } from "@/components/settings/settings-subnav";
import { cn } from "@/lib/utils";

const SUB_TONE: Record<string, "ok" | "warn" | "bad" | "info" | "neutral"> = {
  ACTIVE: "ok",
  TRIALING: "info",
  PAST_DUE: "warn",
  CANCELED: "neutral",
  INCOMPLETE: "bad",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; error?: string }>;
}) {
  const { orgId } = await requireOrg();
  const locale = await getLocale();
  const { success, canceled, error } = await searchParams;
  const t = await getTranslations({ namespace: "billing", locale });

  const [session, org, usage, reviewsThisMonth, invoices] = await Promise.all([
    auth(),
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      include: { subscription: true },
    }),
    monthlyUsage(orgId),
    // Real reviews received since the 1st (the quota unit plans are sold in).
    prisma.review.count({
      where: {
        organizationId: orgId,
        deletedAt: null,
        receivedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
    prisma.invoice.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        totalCents: true,
        currency: true,
        status: true,
        hostedUrl: true,
        createdAt: true,
      },
    }),
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
  const planKey = (sub?.planKey ?? "STARTER") as PlanKey;
  const quota = PLAN_LIMITS[planKey].reviewQuota;
  const pct = Math.min(100, Math.round((reviewsThisMonth / quota) * 100));
  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const periodEnds = sub?.currentPeriodEnd ? dateFmt.format(sub.currentPeriodEnd) : "";
  const numberFmt = new Intl.NumberFormat(locale === "en" ? "en-GB" : "el-GR");
  const moneyFmt = (cents: number | null, currency: string | null) =>
    cents === null
      ? "—"
      : new Intl.NumberFormat(locale === "en" ? "en-GB" : "el-GR", {
          style: "currency",
          currency: (currency ?? "EUR").toUpperCase(),
        }).format(cents / 100);
  const invoiceDate = (d: Date) => dateFmt.format(d);

  return (
    <main id="main-content" className="mx-auto max-w-[840px] px-4 py-8 sm:px-6">
      <PageHeader title={t("title")} />
      <div className="mt-6">
        <SettingsSubnav />
      </div>

      {success && (
        <p role="status" className="mt-6 flex items-start gap-2.5 rounded-lg bg-success-100/70 px-4 py-3 text-sm font-medium text-success-600">
          <IconCheckCircle className="mt-0.5 size-4 shrink-0" />
          {t("success")}
        </p>
      )}
      {canceled && (
        <p role="status" className="mt-6 flex items-start gap-2.5 rounded-lg bg-terracotta-100/70 px-4 py-3 text-sm font-medium text-terracotta-500">
          <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
          {t("canceled")}
        </p>
      )}
      {/* Stage F: Stripe redirect errors now surface as banners instead of
          a silent reload with nothing explained. */}
      {error === "impersonation" && (
        <p role="alert" className="mt-6 flex items-start gap-2.5 rounded-lg bg-terracotta-100/70 px-4 py-3 text-sm font-medium text-terracotta-500">
          <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
          {t("impersonationBlocked")}
        </p>
      )}
      {error === "no-customer" && (
        <p role="alert" className="mt-6 flex items-start gap-2.5 rounded-lg bg-terracotta-100/70 px-4 py-3 text-sm font-medium text-terracotta-500">
          <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
          {t("noCustomer")}
        </p>
      )}

      {/* Current plan hero + quota progress */}
      <div className="mt-6">
        <SectionCard
          title={t("currentPlan")}
          labelledBy="billing-current"
          trailing={
            sub ? (
              <StatusChip tone={SUB_TONE[sub.status] ?? "neutral"}>
                {t(`status.${sub.status}`)}
              </StatusChip>
            ) : (
              <StatusChip tone="neutral">{t("noPlan")}</StatusChip>
            )
          }
        >
          <p className="font-display text-2xl font-semibold text-ink-900">{planKey}</p>
          {sub?.status === "TRIALING" && sub.currentPeriodEnd && (
            <p className="mt-1 text-sm text-ink-500">
              {t("trialEnds", { date: periodEnds })}
            </p>
          )}
          {sub?.status === "ACTIVE" && sub.currentPeriodEnd && !sub.cancelAtPeriodEnd && (
            <p className="mt-1 text-sm text-ink-500">{t("renewsOn", { date: periodEnds })}</p>
          )}
          {sub?.cancelAtPeriodEnd && sub.currentPeriodEnd && (
            <p className="mt-1 text-sm text-terracotta-500">
              {t("cancelAtPeriod", { date: periodEnds })}
            </p>
          )}
          {sub?.status === "CANCELED" && sub.accessEndsAt && new Date(sub.accessEndsAt) < new Date() && (
            <p className="mt-1 text-sm text-terracotta-500">
              {t("canceledEnded", { date: dateFmt.format(sub.accessEndsAt) })}
            </p>
          )}

          {/* Quota progress: real reviews received vs the plan's quota. */}
          <div className="mt-4 rounded-md bg-sunken px-4 py-3">
            <p className="text-[13px] font-medium text-ink-500">
              {t("usageQuota", {
                used: numberFmt.format(reviewsThisMonth),
                quota: numberFmt.format(quota),
              })}
            </p>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-aegean-600" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 font-mono text-[12px] tabular-nums text-ink-500">
              {t("usageCalls", {
                calls: numberFmt.format(usage.calls),
                tokens: numberFmt.format(usage.tokensIn + usage.tokensOut),
              })}
            </p>
          </div>
        </SectionCard>
      </div>

      {/* Plan selection */}
      <section className="mt-6" aria-labelledby="billing-choose">
        <h2 id="billing-choose" className="text-lg font-semibold text-ink-900">{t("choose")}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(["STARTER", "GROWTH", "PRO"] as const).map((key) => {
            const plan = PLAN_LIMITS[key];
            const popular = key === "GROWTH";
            const current = sub?.planKey === key;
            return (
              <form
                key={key}
                action={checkoutAction}
                className={cn(
                  "relative flex flex-col rounded-lg border bg-surface p-5 shadow-xs transition-[transform,box-shadow] duration-[220ms] ease-out hover:-translate-y-0.5 hover:shadow-md",
                  popular ? "border-aegean-600" : "border-line"
                )}
              >
                <input type="hidden" name="plan" value={key} />
                <span
                  className={cn(
                    "absolute -top-2.5 left-4 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                    current ? "bg-success-600 text-white" : popular ? "bg-aegean-600 text-white" : "hidden"
                  )}
                >
                  {current ? t("currentTag") : t("popularTag")}
                </span>
                <p className="font-display text-lg font-semibold text-ink-900">{key}</p>
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
        <p className="mt-4 text-center text-[13px] text-ink-500">{t("vatNote")}</p>
        {sub && <p className="mt-1 text-center text-[12px] text-ink-300">{t("switchNote")}</p>}
      </section>

      {/* Invoices — webhook-written rows only; honest empty state. */}
      <div className="mt-6">
        <SectionCard title={t("invoices")} labelledBy="billing-invoices">
          {invoices.length > 0 ? (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <p className="font-mono text-[12px] tabular-nums text-ink-500">
                    {invoiceDate(inv.createdAt)}
                  </p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-ink-900">
                    {moneyFmt(inv.totalCents, inv.currency)}
                  </p>
                  <span className="ml-auto">
                    <StatusChip tone={inv.status === "PAID" ? "ok" : "warn"}>
                      {inv.status === "PAID" ? t("invoicePaid") : t("invoiceOpen")}
                    </StatusChip>
                  </span>
                  {inv.hostedUrl && (
                    <a
                      href={inv.hostedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="link-grow text-[13px] font-semibold text-aegean-600"
                    >
                      PDF
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">{t("invoicesEmpty")}</p>
          )}
        </SectionCard>
      </div>

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
