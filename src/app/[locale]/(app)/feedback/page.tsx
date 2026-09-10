// src/app/[locale]/(app)/feedback/page.tsx — QR inbox + token management
// (§9.6). Server component; the inline server action generates/rotates
// tokens and QR PNGs render server-side (qrcode npm — no external
// service). Left: explainer with the funnel diagram; right: QR cards +
// recent submissions. QR modules are ink on white (§7.14 — never
// inverted).
import QRCode from "qrcode";
import { getLocale, getTranslations } from "next-intl/server";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { QrGenerateButton } from "@/components/feedback/qr-generate-button";
import { IconArrowRight, IconQr } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export default async function FeedbackPage() {
  const { orgId } = await requireOrg();
  const locale = await getLocale();
  const t = await getTranslations({ namespace: "feedback", locale });

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
    tokens.map(async (request) => ({
      request,
      url: `${env.APP_URL}/f/${request.token}`,
      qr: await QRCode.toDataURL(`${env.APP_URL}/f/${request.token}`, {
        width: 240,
        margin: 1,
        color: { dark: "#12283f", light: "#ffffff" }, // ink on white — §7.14
      }),
    }))
  );

  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    day: "numeric",
    month: "short",
  });

  return (
    <main id="main-content" className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-900">
            {t("title")}
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-sm text-ink-500">{t("subtitle")}</p>
        </div>
        <QrGenerateButton />
      </div>

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
          {tokenUrls.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-ink-900">{t("tokens")}</h2>
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
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold text-ink-900">{t("submissions")}</h2>
            <div className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface shadow-xs">
              {submissions.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-ink-500">{t("empty")}</p>
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
