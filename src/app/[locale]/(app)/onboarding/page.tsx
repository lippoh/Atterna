// src/app/[locale]/(app)/onboarding/page.tsx — the guided wizard
// Step 1: organization + business (name, category, city) → subscription
// TRIALING (30 days). Step 2: connect Google Business Profile via the
// OAuth flow (connectGbp action → buildGbpAuthUrl → Google → callback).
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireUser, requireOrg } from "@/lib/session";
import { prisma } from "@/lib/db";
import { trialEndsAt } from "@/lib/billing/trial";
import { buildGbpAuthUrl } from "@/integrations/gbp/oauth";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
subscription: { create: { planKey: "STARTER", status: "TRIALING", currentPeriodEnd:
trialEndsAt(30) } },
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
return (
<main className="mx-auto max-w-xl space-y-6 p-4">
<h1 className="text-xl font-semibold">{t("title")}</h1>
{error === "no-business" && (
<p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
{locale === "en"
  ? "Create your business first (step 1)."
  : "Δημιουργήστε πρώτα την επιχείρηση (βήμα 1)."}
</p>
)}
{!hasOrg ? (
<section className="rounded-xl border border-slate-200 bg-white p-4">
<h2 className="text-sm font-bold text-slate-900">
{t("step1")} — 1/2
</h2>
<form action={createOrganization} className="mt-3 space-y-3">
<div className="space-y-1.5">
<Label htmlFor="orgName">{t("orgName")}</Label>
<Input id="orgName" name="orgName" required maxLength={120} />
</div>
<div className="space-y-1.5">
<Label htmlFor="businessName">{t("businessName")}</Label>
<Input id="businessName" name="businessName" required maxLength={120} />
</div>
<div className="grid grid-cols-2 gap-3">
<div className="space-y-1.5">
<Label htmlFor="category">{t("category")}</Label>
<Input id="category" name="category" placeholder="taverna / hotel / ..." required
/>
</div>
<div className="space-y-1.5">
<Label htmlFor="city">{t("city")}</Label>
<Input id="city" name="city" placeholder="Αθήνα" required />
</div>
</div>
<Button type="submit">{t("submit")}</Button>
</form>
</section>
) : (
<section className="rounded-xl border border-slate-200 bg-white p-4">
<h2 className="text-sm font-bold text-slate-900">
{t("step2")} — {step === "import" ? "2/2" : "2/2"}
</h2>
<p className="mt-2 text-sm text-slate-600">{t("connectHint")}</p>
{step === "import" && business?.gbpConnection && (
<p className="mt-2 text-sm font-medium text-emerald-700">{t("importing")}</p>
)}
<form action={connectGbp} className="mt-4">
<Button type="submit">{t("connectGbp")}</Button>
</form>
{business?.gbpConnection && (
<a
href={`/${locale}/dashboard`}
className="mt-3 inline-block text-sm font-semibold text-blue-700 underline"
>
{t("goDashboard")} →
</a>
)}
</section>
)}
</main>
);
}