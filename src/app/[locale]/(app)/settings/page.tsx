// src/app/[locale]/(app)/settings/page.tsx — General settings (Stage F)
// Profile (email + language) · Reply style (AI tone/signature/forbidden)
// · Weekly report (last-sent from ReportLog, recipient = owner email) ·
// Security (reset email via requestResetAction, 60-min token) · Data
// sources summary (deep cards live on /settings/sources). Inline server
// actions preserved verbatim; only Grouped/real sections, no fake
// Notifications/Team/Danger Zone (no backing exists).
import { getLocale, getTranslations } from "next-intl/server";
import { requireOrg, requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { updateLocaleAction } from "../../(auth)/actions";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { SettingsSubnav } from "@/components/settings/settings-subnav";
import { ResetPasswordButton } from "@/components/settings/reset-password-button";
import { IconCheckCircle } from "@/components/ui/icons";

export default async function SettingsPage() {
  const user = await requireUser();
  const { orgId } = await requireOrg();
  const locale = await getLocale();
  const t = await getTranslations({ namespace: "settings", locale });

  const [business, lastReport] = await Promise.all([
    prisma.business.findFirst({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: { gbpConnection: { select: { status: true, locationName: true } } },
    }),
    prisma.reportLog.findFirst({
      where: { organizationId: orgId, kind: "WEEKLY" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

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
  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main id="main-content" className="mx-auto max-w-[840px] px-4 py-8 sm:px-6">
      <PageHeader title={t("title")} description={t("profileDesc")} />
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

        {/* Reply style — AI tone */}
        {business && (
          <SectionCard
            title={t("replyStyle")}
            description={t("replyStyleDesc")}
            labelledBy="settings-reply"
          >
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

        {/* Weekly report — real last-sent state */}
        <SectionCard
          title={t("report")}
          description={t("reportDesc")}
          labelledBy="settings-report"
          trailing={
            lastReport ? (
              <StatusChip tone="ok">
                <IconCheckCircle className="size-4" />
                {t("reportLast", { date: dateFmt.format(lastReport.createdAt) })}
              </StatusChip>
            ) : (
              <StatusChip tone="neutral">{t("reportNever")}</StatusChip>
            )
          }
        >
          <p className="text-sm text-ink-500">{t("reportDesc")}</p>
        </SectionCard>

        {/* Security — reset email (real flow, 60-min token) */}
        <SectionCard
          title={t("security")}
          description={t("securityDesc")}
          labelledBy="settings-security"
        >
          <ResetPasswordButton email={user.email} locale={locale} />
        </SectionCard>

        {/* Data sources — summary + deep link */}
        <SectionCard
          title={t("sourcesCard")}
          description={t("sourcesCardDesc")}
          labelledBy="settings-sources"
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
          <p className="text-sm text-ink-500">{t("gbpHint")}</p>
          <Link
            href="/settings/sources"
            className="link-grow mt-3 inline-block text-sm font-semibold text-aegean-600"
          >
            {t("gbpManage")}
          </Link>
        </SectionCard>
      </div>
    </main>
  );
}
