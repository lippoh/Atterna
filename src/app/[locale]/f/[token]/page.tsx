// src/app/[locale]/f/[token]/page.tsx — PUBLIC QR feedback page (no auth)
// No app chrome, no session, noindex, business-locale copy. The entire
// interaction is two taps (§13). No PII beyond an optional comment.
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { FeedbackForm } from "./feedback-form";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
export default async function FeedbackTokenPage({
  params,
}: {
  params: Promise<{ token: string; locale: string }>;
}) {
  const { token } = await params;
  const request = await prisma.feedbackRequest.findUnique({
    where: { token },
    include: {
      business: {
        select: { name: true, locale: true, reviewUrl: true },
      },
    },
  });
  const locale = request?.business.locale.toLowerCase() === "en" ? "en" : "el";
  const t = await getTranslations({ namespace: "f", locale });
  if (!request || !request.active) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4
    text-center">
        <p className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm
    text-slate-600">
          {t("notFound")}
        </p>
      </main>
    );
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-center text-lg font-bold text-slate-900">
          {request.business.name}
        </p>
        <p className="mb-6 mt-1 text-center text-xs text-slate-400">
          {locale === "en" ? "Private feedback" : "Ιδιωτική ανατροφοδότηση"}
        </p>
        <FeedbackForm
          token={request.token}
          invitationUrl={request.business.reviewUrl ?? undefined}
          labels={{
            question: t("question"),
            low: t("low"),
            high: t("high"),
            negativePrompt: t("negativePrompt"),
            positivePrompt: t("positivePrompt"),
            submit: t("submit"),
            submitting: t("submitting"),
            thanks: t("thanks"),
            invitation: t("invitation"),
            invitationCta: t("invitationCta"),
            error: t("error"),
          }}
        />
      </div>
    </main>
  );
}