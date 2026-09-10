// src/app/[locale]/(app)/feedback/page.tsx — QR inbox + token management
// (Stage G: QR UX): generte → success card with the new QR rendered
// immediately from the returned token (no waiting on revalidation) →
// per-card copy/download/share/print → EmptyState when no codes, honest
// empty submissions. QR PNGs render server-side (qrcode npm — no
// external service). QR modules are ink on white (§7.14 — never
// inverted).
import QRCode from "qrcode";
import { getLocale, getTranslations } from "next-intl/server";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { QrGenerateButton } from "@/components/feedback/qr-generate-button";
import { QrCardActions } from "@/components/feedback/qr-card-actions";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { IconArrowRight, IconQr, IconCheckCircle } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

async function qrFor(token: string) {
  const url = `${env.APP_URL}/f/${token}`;
  const qr = await QRCode.toDataURL(url, {
    width: 280,
    margin: 1,
    color: { dark: "#12283f", light: "#ffffff" }, // ink on white — §7.14
  });
  return { url, qr };
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { orgId } = await requireOrg();
  const locale = await getLocale();
  const t = await getTranslations({ namespace: "feedback", locale });
  const { created } = await searchParams;

  const business = await prisma.business.findFirst({
    where: { organizationId: orgId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  // Stage B: tokens + submissions in parallel (were sequential).
  const [tokens, submissions] = business
    ? await Promise.all([
        prisma.feedbackRequest.findMany({
          where: { businessId: business.id, active: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        prisma.feedbackSubmission.findMany({
          where: { businessId: business.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ])
    : [[], []];

  const tokenUrls = await Promise.all(
    tokens.map(async (request) => ({ request, ...(await qrFor(request.token)) }))
  );

  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    day: "numeric",
    month: "short",
  });

  return (
    <main id="main-content" className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title={t("title")} description={t("subtitle")} />
        <QrGenerateButton />
      </div>

      {/* Success state: the token the action just minted is confirmed by
          ?created= in the URL — render its real QR above the list. */}
      {created && (
        <SuccessCard token={created} createdMsg={t("created")} />
      )}

      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[5fr_7fr]">
        {/* ── Left: explainer + funnel diagram ─────────────────────────── */}
        <section className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
          <h2 className="text-lg font-semibold text-ink-900">{t("howTitle")}</h2>
          <p className="lh-body mt-2 text-sm leading-relaxed text-ink-700">
            {t("howBody")}
          </p>

          {/* funnel diagram: QR → private → 4-5★ public / ≤3★ alert */}
          <div className="mt-6 space-y-3" aria-hidden="true">
            <div className="flex items-center gap-3 rounded-md border border-line bg-sunken px-4 py-3">
              <IconQr className="size-5 shrink-0 text-ink-700" />
              <p className="text-[13px] font-medium text-ink-900">{t("funnelQr")}</p>
            </div>
            <div className="pl-6">
              <IconArrowRight className="size-4 rotate-90 text-ink-300" />
            </div>
            <div className="flex items-center gap-3 rounded-md border border-line bg-sunken px-4 py-3">
              <span className="size-2 shrink-0 rounded-full bg-ink-300" />
              <p className="text-[13px] font-medium text-ink-900">{t("funnelPrivate")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2 rounded-md border border-success-600/30 bg-success-100/50 px-3 py-3">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-success-600" />
                <p className="text-[12px] font-medium leading-snug text-ink-900">
                  {t("funnelPositive")}
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-md border border-danger-600/30 bg-danger-100/50 px-3 py-3">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-danger-600" />
                <p className="text-[12px] font-medium leading-snug text-ink-900">
                  {t("funnelNegative")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Right: QR cards + submissions ────────────────────────────── */}
        <div className="space-y-6">
          {tokenUrls.length > 0 ? (
            <section className="space-y-4" aria-labelledby="feedback-tokens">
              <h2 id="feedback-tokens" className="text-lg font-semibold text-ink-900">{t("tokens")}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {tokenUrls.map(({ request, url, qr }) => (
                  <div
                    key={request.id}
                    className="flex gap-4 rounded-lg border border-line bg-surface p-4 shadow-xs transition-[transform,box-shadow] duration-[220ms] ease-out hover:-translate-y-0.5 hover:shadow-md sm:flex-col"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qr}
                      alt={`QR ${request.label ?? ""}`}
                      width={140}
                      height={140}
                      className="mx-auto size-[140px] shrink-0 rounded-md border border-line"
                    />
                    <div className="min-w-0 flex-1">
                      {request.label && (
                        <p className="truncate text-[13px] font-semibold text-ink-900">
                          {request.label}
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-ink-500">{t("url")}</p>
                      <p className="mt-1 break-all rounded bg-sunken px-2 py-1.5 font-mono text-[11px] leading-snug text-aegean-600">
                        {url}
                      </p>
                      <p className="mt-2 font-mono text-[11px] tabular-nums text-ink-300">
                        {dateFmt.format(request.createdAt)}
                      </p>
                      <QrCardActions qr={qr} url={url} label={request.label ?? ""} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <EmptyState
              icon={<IconQr className="size-6" />}
              title={t("noTokensTitle")}
              body={t("noTokensBody")}
            />
          )}

          <section aria-labelledby="feedback-submissions">
            <h2 id="feedback-submissions" className="text-lg font-semibold text-ink-900">{t("submissions")}</h2>
            <div className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface shadow-xs">
              {submissions.length === 0 ? (
                <EmptyState
                  icon={<IconCheckCircle className="size-6" />}
                  title={t("emptyTitle")}
                  body={t("emptyBody")}
                />
              ) : (
                submissions.map((s) => (
                  <div key={s.id} className="p-4">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-7 shrink-0 items-center rounded-md px-2 font-mono text-[12px] font-semibold tabular-nums",
                          s.rating <= 3
                            ? "bg-danger-100 text-danger-600"
                            : "bg-success-100 text-success-600"
                        )}
                        title={`${s.rating}/5`}
                      >
                        {s.rating}/5
                      </span>
                      <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-300">
                        {new Intl.DateTimeFormat(
                          locale === "en" ? "en-GB" : "el-GR",
                          { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
                        ).format(s.createdAt)}
                      </span>
                    </div>
                    {s.comment && (
                      <p className="lh-body mt-2 text-sm leading-relaxed text-ink-700">
                        {s.comment}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

async function SuccessCard({ token, createdMsg }: { token: string; createdMsg: string }) {
  const { url, qr } = await qrFor(token);
  return (
    <div role="status" className="mt-6 flex flex-wrap items-center gap-4 rounded-lg border border-success-600/30 bg-success-100/50 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="New QR code" width={96} height={96} className="size-24 rounded-md border border-line bg-white" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <IconCheckCircle className="size-4 shrink-0 text-success-600" />
          {createdMsg}
        </p>
        <p className="mt-1 break-all font-mono text-[12px] text-aegean-600">{url}</p>
        <QrCardActions qr={qr} url={url} label="" />
      </div>
    </div>
  );
}
