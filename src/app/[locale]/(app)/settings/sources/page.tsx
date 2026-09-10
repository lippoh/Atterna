// src/app/[locale]/(app)/settings/sources/page.tsx — Settings → Data
// Sources (spec §38): Connected / Available / Coming soon, with honest
// capability labels, the CSV import form and the import history. Google
// stays one entry among many — the page reads the provider registry.
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/db";
import { buildGbpAuthUrl } from "@/integrations/gbp/oauth";
import { env } from "@/lib/env";
import {
  SOURCES,
  COMING_SOON_SOURCES,
  sourceLabel,
} from "@/lib/sources/registry";
import { CsvImportForm } from "@/components/sources/csv-import-form";
import { IconCheckCircle, IconUpload } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { SettingsSubnav } from "@/components/settings/settings-subnav";
import { cn } from "@/lib/utils";

export default async function DataSourcesPage() {
  const { orgId } = await requireOrg();
  const locale = await getLocale();
  const t = await getTranslations({ namespace: "sources", locale });

  const business = await prisma.business.findFirst({
    where: { organizationId: orgId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { gbpConnection: { select: { status: true, locationName: true, lastSyncAt: true } } },
  });

  const [csvCount, qrCount, qrSubmissions, imports] = await Promise.all([
    prisma.review.count({
      where: { organizationId: orgId, source: { in: ["csv", "manual"] }, deletedAt: null },
    }),
    prisma.feedbackRequest.count({
      where: { businessId: business?.id ?? "", active: true },
    }),
    prisma.feedbackSubmission.count({ where: { businessId: business?.id ?? "" } }),
    prisma.reportLog.findMany({
      where: { organizationId: orgId, kind: "CSV_IMPORT" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { metrics: true, createdAt: true },
    }),
  ]);

  const googleConnected = Boolean(business?.gbpConnection);
  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const capLabel = (key: string) => t(`cap.${key}`);

  return (
    <main id="main-content" className="mx-auto max-w-[840px] px-4 py-8 sm:px-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="mt-6">
        <SettingsSubnav />
      </div>

      <div className="mt-6 space-y-6">
        {/* ── Connected ─────────────────────────────────────────────── */}
        <SectionCard title={t("connected")} labelledBy="sources-connected">
          <ul className="space-y-3">
            {/* Google */}
            <li className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-sunken/60 p-4">
              <span className="flex size-9 items-center justify-center rounded-md border border-line bg-surface font-mono text-[12px] font-bold text-ink-700">
                G
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900">
                  {SOURCES.google.label[locale === "en" ? "en" : "el"]}
                </p>
                <p className="text-[12px] text-ink-500">
                  {googleConnected
                    ? `${business?.gbpConnection?.locationName ?? ""} · ${business?.gbpConnection?.status ?? ""}${
                        business?.gbpConnection?.lastSyncAt
                          ? ` · ${t("lastSync")}: ${dateFmt.format(business.gbpConnection.lastSyncAt)}`
                          : ""
                      }`
                    : t("googleNotConnected")}
                </p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  {["sync", "reply", "oauth"].map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-line-strong px-2 py-0.5 text-[10px] font-medium text-ink-500"
                    >
                      {capLabel(c)}
                    </span>
                  ))}
                </p>
              </div>
              {googleConnected ? (
                <IconCheckCircle className="size-5 shrink-0 text-success-600" />
              ) : (
                <form action={async () => {
                  "use server";
                  const { orgId: currentOrg } = await requireOrg();
                  const url = buildGbpAuthUrl(currentOrg, `${env.APP_URL}/api/gbp/callback`);
                  redirect(url);
                }}>
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center rounded-md bg-aegean-600 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-aegean-700"
                  >
                    {t("connect")}
                  </button>
                </form>
              )}
            </li>

            {/* CSV / manual */}
            <li className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-sunken/60 p-4">
              <span className="flex size-9 items-center justify-center rounded-md border border-line bg-surface">
                <IconUpload className="size-4 text-ink-700" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900">
                  {SOURCES.csv.label[locale === "en" ? "en" : "el"]}
                </p>
                <p className="text-[12px] text-ink-500">
                  {t("csvImported", { count: csvCount })}
                </p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  {["import"].map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-line-strong px-2 py-0.5 text-[10px] font-medium text-ink-500"
                    >
                      {capLabel(c)}
                    </span>
                  ))}
                </p>
              </div>
              {csvCount > 0 && <IconCheckCircle className="size-5 shrink-0 text-success-600" />}
            </li>

            {/* Atterna feedback */}
            <li className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-sunken/60 p-4">
              <span className="flex size-9 items-center justify-center rounded-md border border-line bg-surface font-mono text-[12px] font-bold text-ink-700">
                QR
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900">
                  {SOURCES.qr_feedback.label[locale === "en" ? "en" : "el"]}
                </p>
                <p className="text-[12px] text-ink-500">
                  {t("qrStats", { tokens: qrCount, submissions: qrSubmissions })}
                </p>
              </div>
              {qrSubmissions > 0 && <IconCheckCircle className="size-5 shrink-0 text-success-600" />}
              <Link
                href="/feedback"
                className="link-grow text-[13px] font-semibold text-aegean-600"
              >
                {t("manageQr")}
              </Link>
            </li>
          </ul>
        </SectionCard>

        {/* ── Available: the CSV importer ───────────────────────────── */}
        <SectionCard
          title={t("available")}
          description={SOURCES.csv.description[locale === "en" ? "en" : "el"]}
          labelledBy="sources-available"
        >
          <div>
            <CsvImportForm />
          </div>
          {imports.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-[12px] font-semibold tracking-wide text-ink-500">
                {t("history")}
              </p>
              <ul className="mt-2 space-y-1">
                {imports.map((log, i) => {
                  const m = (log.metrics ?? {}) as {
                    totalRows?: number;
                    imported?: number;
                    invalid?: number;
                  };
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-3 font-mono text-[11px] text-ink-500"
                    >
                      <span className="tabular-nums">{dateFmt.format(log.createdAt)}</span>
                      <span>
                        {t("historyRow", {
                          total: m.totalRows ?? 0,
                          imported: m.imported ?? 0,
                          invalid: m.invalid ?? 0,
                        })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </SectionCard>

        {/* ── Coming soon (honest availability, §38) ────────────────── */}
        <SectionCard title={t("comingSoon")} labelledBy="sources-coming">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {COMING_SOON_SOURCES.map((key) => {
              const meta = SOURCES[key];
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-lg border border-line bg-sunken/60 p-4 opacity-80"
                  )}
                >
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    {meta.label[locale === "en" ? "en" : "el"]}
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-ink-300">
                      {t("soonBadge")}
                    </span>
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-ink-500">
                    {meta.description[locale === "en" ? "en" : "el"]}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] leading-snug text-ink-300">{t("soonNote")}</p>
        </SectionCard>
      </div>
    </main>
  );
}
