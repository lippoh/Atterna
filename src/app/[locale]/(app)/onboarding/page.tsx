// src/app/[locale]/(app)/onboarding/page.tsx — the guided wizard (§9.3)
// Step 1: organization + business → subscription TRIALING (30 days).
// Step 2: connect GBP via OAuth. Numbered serif step markers on a
// hairline progress rail; actions preserved verbatim.
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireUser, requireOrg } from "@/lib/session";
import { prisma } from "@/lib/db";
import { trialEndsAt } from "@/lib/billing/trial";
import { buildGbpAuthUrl } from "@/integrations/gbp/oauth";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconArrowRight, IconCheckCircle } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { step, error } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations({ namespace: "onboarding", locale });

  // Existing org? Jump to the connect step (or done).
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: {
      organization: {
        include: {
          businesses: { where: { deletedAt: null }, take: 1, include: { gbpConnection: true } },
        },
      },
    },
  });
  const business = membership?.organization.businesses[0];

  async function createOrganization(formData: FormData) {
    "use server";
    const currentUser = await requireUser();
    const orgName = String(formData.get("orgName") ?? "").slice(0, 120);
    const businessName = String(formData.get("businessName") ?? "").slice(0, 120);
    const category = String(formData.get("category") ?? "").slice(0, 60);
    const city = String(formData.get("city") ?? "").slice(0, 60);
    if (!orgName || !businessName || !city) redirect(`/${locale}/onboarding?error=missing`);

    const org = await prisma.organization.create({
      data: {
        name: orgName,
        businesses: { create: { name: businessName, category, city } },
        memberships: { create: { userId: currentUser.id, role: "OWNER" } },
        // Pre-Stripe INITIAL state — the documented single exception to
        // "the webhook is the only writer of subscription state" (see
        // docs/ARCHITECTURE-BILLING.md § Onboarding trial). This is the
        // local 30-day product trial, created atomically with the
        // organization, BEFORE any Stripe customer exists; every
        // subsequent billing-state transition belongs to the Stripe
        // webhook. Do not add other writers here.
        subscription: { create: { planKey: "STARTER", status: "TRIALING", currentPeriodEnd: trialEndsAt(30) } },
      },
    });
    await audit("onboarding.organization_created", {
      userId: currentUser.id,
      organizationId: org.id,
    });
    redirect(`/${locale}/onboarding?step=import`);
  }

  async function connectGbp() {
    "use server";
    const { orgId } = await requireOrg();
    const url = buildGbpAuthUrl(orgId, `${env.APP_URL}/api/gbp/callback`);
    redirect(url);
  }

  if (business?.gbpConnection && step !== "import") {
    redirect(`/${locale}/dashboard`);
  }

  const hasOrg = Boolean(membership);
  const hasAnyData = business
    ? Boolean(business.gbpConnection) || step === "import"
    : false;

  return (
    <main id="main-content" className="mx-auto max-w-[560px] px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-ink-900">{t("title")}</h1>

      {error === "no-business" && (
        <p className="mt-5 rounded-lg bg-danger-100/70 px-4 py-3 text-sm font-medium text-danger-600">
          {locale === "en"
            ? "Create your business first (step 1)."
            : "Δημιουργήστε πρώτα την επιχείρηση (βήμα 1)."}
        </p>
      )}

      {/* Step rail */}
      <div className="mt-8 flex items-center gap-3" aria-hidden="true">
        {(["1", "2"] as const).map((n, i) => {
          const done = hasOrg && i === 0;
          const activeStep = hasOrg ? 1 : 0;
          const current = i === activeStep;
          return (
            <div key={n} className="flex flex-1 items-center gap-3">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full border font-display text-[15px] font-semibold",
                  done
                    ? "border-success-600 bg-success-100 text-success-600"
                    : current
                      ? "border-ink-900 bg-ink-900 text-white"
                      : "border-line-strong bg-surface text-ink-300"
                )}
              >
                {done ? <IconCheckCircle className="size-4" /> : n}
              </span>
              {i === 0 && (
                <span className={cn("h-px flex-1", done ? "bg-success-600/40" : "bg-line")} />
              )}
            </div>
          );
        })}
      </div>

      {!hasOrg ? (
        <section className="mt-8 rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
          <h2 className="text-lg font-semibold text-ink-900">{t("step1")}</h2>
          <form action={createOrganization} className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">{t("orgName")}</Label>
              <Input id="orgName" name="orgName" autoFocus required maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessName">{t("businessName")}</Label>
              <Input id="businessName" name="businessName" required maxLength={120} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">{t("category")}</Label>
                <Input id="category" name="category" placeholder="taverna / hotel / …" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">{t("city")}</Label>
                <Input id="city" name="city" placeholder="Αθήνα" required />
              </div>
            </div>
            <Button type="submit">
              {t("submit")}
              <IconArrowRight className="size-4" />
            </Button>
          </form>
        </section>
      ) : (
        /* Step 2 — "Add your customer feedback" (spec §34): the customer
         * chooses ANY source; Google is one option, never a gate. CSV
         * import and skip-to-dashboard keep onboarding unblocked. */
        <section className="mt-8 rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
          <h2 className="text-lg font-semibold text-ink-900">{t("step2")}</h2>
          <p className="lh-body mt-2 text-sm leading-relaxed text-ink-700">{t("feedbackHint")}</p>

          {hasAnyData && (
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-success-600">
              <IconCheckCircle className="size-4" />
              {t("importing")}
            </p>
          )}

          <div className="mt-5 space-y-3">
            <form action={connectGbp}>
              <Button type="submit" className="w-full sm:w-auto">
                {t("connectGbp")}
              </Button>
            </form>

            <Link
              href="/settings/sources"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-ink-700 transition-colors hover:border-aegean-600 hover:text-aegean-600 sm:w-auto"
            >
              {t("importCsv")}
              <IconArrowRight className="size-4" />
            </Link>

            <p className="text-[12px] text-ink-300">{t("comingSoonNote")}</p>

            <Link
              href="/dashboard"
              className="link-grow inline-block text-sm font-semibold text-aegean-600"
            >
              {t("skipToDashboard")}
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
