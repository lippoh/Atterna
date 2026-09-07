// src/app/[locale]/(app)/settings/page.tsx — profile, locale, business tone
import { getLocale, getTranslations } from "next-intl/server";
import { requireOrg, requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { updateLocaleAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export default async function SettingsPage() {
const user = await requireUser();
const { orgId } = await requireOrg();
const locale = await getLocale();
const t = await getTranslations({ namespace: "settings", locale });
const business = await prisma.business.findFirst({
where: { organizationId: orgId, deletedAt: null },
orderBy: { createdAt: "asc" },
include: { gbpConnection: { select: { status: true, locationName: true } } },
});
async function saveProfile(formData: FormData) {
"use server";
const current = await requireUser();
const locale = String(formData.get("locale") ?? "el") === "en" ? "EN" : "EL";
await prisma.user.update({
where: { id: current.id },
data: { locale },
});
await updateLocaleAction(locale === "EN" ? "en" : "el");
}
async function saveBusiness(formData: FormData) {
"use server";
const { orgId: currentOrg } = await requireOrg();
const business = await prisma.business.findFirst({
where: { organizationId: currentOrg, deletedAt: null },
orderBy: { createdAt: "asc" },
});
if (!business) return;
const tone = String(formData.get("tone") ?? "friendly");
const signature = String(formData.get("signature") ?? "").slice(0, 120);
const forbidden = String(formData.get("forbidden") ?? "")
.split(",")
.map((s) => s.trim())
.filter(Boolean)
.slice(0, 20);
await prisma.business.update({
where: { id: business.id },
data: { aiSettings: { tone, signature, forbiddenPhrases: forbidden } },
});
}
const aiSettings = (business?.aiSettings ?? {}) as {
tone?: string;
signature?: string;
forbiddenPhrases?: string[];
};
return (
<main className="mx-auto max-w-2xl space-y-5 p-4">
<h1 className="text-xl font-semibold">{t("title")}</h1>
<section className="rounded-xl border border-slate-200 bg-white p-4">
<h2 className="text-sm font-bold text-slate-900">{t("profile")}</h2>
<form action={saveProfile} className="mt-3 space-y-3">
<div className="space-y-1.5">
<Label htmlFor="email">{t("profile")}</Label>
<Input id="email" value={user.email} disabled />
</div>
<div className="space-y-1.5">
<Label htmlFor="locale">{t("locale")}</Label>
<select
id="locale"
name="locale"
defaultValue={locale}
className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
>
<option value="el">Ελληνικά</option>
<option value="en">English</option>
</select>
</div>
<Button type="submit" size="sm">{t("save")}</Button>
</form>
</section>
{business && (
<section className="rounded-xl border border-slate-200 bg-white p-4">
<h2 className="text-sm font-bold text-slate-900">{t("business")}</h2>
<form action={saveBusiness} className="mt-3 space-y-3">
<div className="space-y-1.5">
<Label htmlFor="tone">{t("tone")}</Label>
<select
id="tone"
name="tone"
defaultValue={aiSettings.tone ?? "friendly"}
className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
>
<option value="friendly">{t("toneFriendly")}</option>
<option value="formal">{t("toneFormal")}</option>
</select>
</div>
<div className="space-y-1.5">
<Label htmlFor="signature">{t("signature")}</Label>
<Input id="signature" name="signature" defaultValue={aiSettings.signature ?? ""} />
</div>
<div className="space-y-1.5">
<Label htmlFor="forbidden">forbidden phrases (comma-separated)</Label>
<Input
id="forbidden"
name="forbidden"
defaultValue={(aiSettings.forbiddenPhrases ?? []).join(", ")}
/>
</div>
<Button type="submit" size="sm">{t("save")}</Button>
</form>
</section>
)}
<section className="rounded-xl border border-slate-200 bg-white p-4">
<h2 className="text-sm font-bold text-slate-900">{t("gbp")}</h2>
<p className="mt-2 text-sm text-slate-600">
{business?.gbpConnection
? `${t("gbpConnected")} — ${business.gbpConnection.locationName}
(${business.gbpConnection.status})`
: t("gbpNotConnected")}
</p>
{!business?.gbpConnection && (
<a
href="/api/gbp/callback"
className="mt-2 inline-block text-sm font-medium text-blue-700 underline"
>
{t("connect")} — /onboarding
</a>
)}
</section>
</main>
);
}