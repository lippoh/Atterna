// src/app/[locale]/(app)/settings/page.tsx — profile, locale, business tone
// (settings surface): sectioned cards with labels above inputs (§7.2),
// select fields styled to match inputs, and the GBP connection card
// with a status chip. Inline server actions preserved verbatim.
import { getLocale, getTranslations } from "next-intl/server";
import { requireOrg, requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { updateLocaleAction } from "../../(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { SettingsSubnav } from "@/components/settings/settings-subnav";
import { IconCheckCircle } from "@/components/ui/icons";

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
    <main id="main-content" className="mx-auto max-w-[840px] px-4 py-8 sm:px-6">
      <PageHeader title={t("title")} />
      <div className="mt-6">
        <SettingsSubnav />
      </div>

      <div className="mt-6 space-y-6">
        {/* Profile */}
        <SectionCard title={t("profile")} labelledBy="settings-profile">
          <form action={saveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" value={user.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locale">{t("locale")}</Label>
              <Select id="locale" name="locale" defaultValue={locale}>
                <option value="el">Ελληνικά</option>
                <option value="en">English</option>
              </Select>
            </div>
            <Button type="submit" size="sm">
              {t("save")}
            </Button>
          </form>
        </SectionCard>

        {/* Business + AI tone */}
        {business && (
          <SectionCard title={t("business")} labelledBy="settings-business">
            <form action={saveBusiness} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tone">{t("tone")}</Label>
                <Select
                  id="tone"
                  name="tone"
                  defaultValue={aiSettings.tone ?? "friendly"}
                >
                  <option value="friendly">{t("toneFriendly")}</option>
                  <option value="formal">{t("toneFormal")}</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signature">{t("signature")}</Label>
                <Input id="signature" name="signature" defaultValue={aiSettings.signature ?? ""} />
                <p className="text-[13px] text-ink-500">{t("signatureHint")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="forbidden">{t("forbidden")}</Label>
                <Input
                  id="forbidden"
                  name="forbidden"
                  defaultValue={(aiSettings.forbiddenPhrases ?? []).join(", ")}
                />
                <p className="text-[13px] text-ink-500">{t("forbiddenHint")}</p>
              </div>
              <Button type="submit" size="sm">
                {t("save")}
              </Button>
            </form>
          </SectionCard>
        )}

        {/* Google Business Profile connection */}
        <SectionCard
          title={t("gbp")}
          labelledBy="settings-gbp"
          trailing={
            business?.gbpConnection ? (
              <StatusChip tone="ok">
                <IconCheckCircle className="size-4" />
                {t("gbpConnected")}
              </StatusChip>
            ) : (
              <StatusChip tone="neutral">{t("gbpNotConnected")}</StatusChip>
            )
          }
        >
          {business?.gbpConnection ? (
            <p className="text-sm text-ink-500">
              {business.gbpConnection.locationName} · {business.gbpConnection.status}
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-500">{t("gbpNotConnectedDetail")}</p>
              <a
                href="/api/gbp/callback"
                className="link-grow mt-4 inline-block text-sm font-semibold text-aegean-600"
              >
                {t("connect")}
              </a>
            </>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
