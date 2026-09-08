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
import { IconCheckCircle } from "@/components/ui/icons";

const SELECT_CLASS =
  "flex h-10 w-full appearance-none rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink-900 transition-[border-color,box-shadow] duration-150 focus-visible:border-aegean-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-aegean-100";

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
      <h1 className="font-display text-3xl font-semibold text-ink-900">{t("title")}</h1>

      <div className="mt-8 space-y-6">
        {/* Profile */}
        <section className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
          <h2 className="text-lg font-semibold text-ink-900">{t("profile")}</h2>
          <form action={saveProfile} className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" value={user.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locale">{t("locale")}</Label>
              <select id="locale" name="locale" defaultValue={locale} className={SELECT_CLASS}>
                <option value="el">Ελληνικά</option>
                <option value="en">English</option>
              </select>
            </div>
            <Button type="submit" size="sm">
              {t("save")}
            </Button>
          </form>
        </section>

        {/* Business + AI tone */}
        {business && (
          <section className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
            <h2 className="text-lg font-semibold text-ink-900">{t("business")}</h2>
            <form action={saveBusiness} className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tone">{t("tone")}</Label>
                <select
                  id="tone"
                  name="tone"
                  defaultValue={aiSettings.tone ?? "friendly"}
                  className={SELECT_CLASS}
                >
                  <option value="friendly">{t("toneFriendly")}</option>
                  <option value="formal">{t("toneFormal")}</option>
                </select>
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
          </section>
        )}

        {/* Google Business Profile connection */}
        <section className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
          <h2 className="text-lg font-semibold text-ink-900">{t("gbp")}</h2>
          <div className="mt-4 flex items-center gap-3">
            {business?.gbpConnection ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2.5 py-1 text-[13px] font-semibold text-success-600">
                  <IconCheckCircle className="size-4" />
                  {t("gbpConnected")}
                </span>
                <p className="text-sm text-ink-500">
                  {business.gbpConnection.locationName} · {business.gbpConnection.status}
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-500">{t("gbpNotConnected")}</p>
            )}
          </div>
          {!business?.gbpConnection && (
            <a
              href="/api/gbp/callback"
              className="link-grow mt-4 inline-block text-sm font-semibold text-aegean-600"
            >
              {t("connect")}
            </a>
          )}
        </section>
      </div>
    </main>
  );
}
