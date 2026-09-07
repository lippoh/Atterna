// src/app/[locale]/(app)/feedback/page.tsx — QR inbox + token management
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { getLocale, getTranslations } from "next-intl/server";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";

export default async function FeedbackPage() {
  const { orgId } = await requireOrg();
  const locale = await getLocale();
  const t = await getTranslations({ namespace: "feedback", locale });

  async function generateTokenAction() {
    "use server";
    const { orgId: currentOrg } = await requireOrg();
    const business = await prisma.business.findFirst({
      where: { organizationId: currentOrg, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });

    if (!business) return;

    const token = randomBytes(24).toString("base64url");
    await prisma.feedbackRequest.create({
      data: { businessId: business.id, token },
    });

    await audit("feedback.token_created", {
      organizationId: currentOrg,
      entity: "business",
      entityId: business.id,
    });
  }

  const business = await prisma.business.findFirst({
    where: { organizationId: orgId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const tokens = business
    ? await prisma.feedbackRequest.findMany({
        where: { businessId: business.id, active: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];

  const submissions = business
    ? await prisma.feedbackSubmission.findMany({
        where: { businessId: business.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  const tokenUrls = await Promise.all(
    tokens.map(async (request) => ({
      request,
      url: `${env.APP_URL}/f/${request.token}`,
      qr: await QRCode.toDataURL(`${env.APP_URL}/f/${request.token}`, {
        width: 220,
        margin: 1,
        color: { dark: "#1a4a7a", light: "#ffffff" },
      }),
    })),
  );

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-slate-500">{t("subtitle")}</p>
      </div>

      <form action={generateTokenAction}>
        <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
          + {t("generate")}
        </button>
      </form>

      {tokenUrls.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900">{t("tokens")}</h2>
          {tokenUrls.map(({ request, url, qr }) => (
            <div key={request.id} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={`QR ${request.label ?? ""}`} width={110} height={110} />
              <div className="min-w-0 flex-1">
                {request.label && <p className="text-xs font-semibold text-slate-500">{request.label}</p>}
                <p className="text-[11px] leading-snug text-slate-600">{t("url")}:</p>
                <p className="break-all rounded bg-slate-50 px-2 py-1 text-[11px] text-blue-800">{url}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {request.createdAt.toLocaleDateString(locale === "en" ? "en-GB" : "el-GR")}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-900">{t("submissions")}</h2>
        {submissions.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">{t("empty")}</p>
        ) : (
          submissions.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <span className={s.rating <= 3 ? "font-bold text-rose-600" : "font-bold text-emerald-700"}>
                  {s.rating}/5
                </span>
                <span className="ml-auto text-[11px] text-slate-400">
                  {s.createdAt.toLocaleString(locale === "en" ? "en-GB" : "el-GR")}
                </span>
              </div>
              {s.comment && <p className="mt-1 text-sm text-slate-700">{s.comment}</p>}
            </div>
          ))
        )}
      </section>
    </main>
  );
}