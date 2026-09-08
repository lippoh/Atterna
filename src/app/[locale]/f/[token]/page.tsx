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
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 text-center">
        <div className="w-full rounded-xl border border-line bg-surface px-6 py-8 shadow-sm">
        <p className="font-display text-2xl font-semibold text-ink-900">
          {t("notFound")}
        </p>
        <p className="mt-3 text-xs text-ink-500">Atterna · {locale === "en" ? "Private feedback" : "Ιδιωτική ανατροφοδότηση"}</p>
        </div>
      </main>
    );
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-8">
      <div className="mb-6 flex items-center justify-between"><span className="font-display text-xl font-semibold text-ink-900">Atterna<span className="text-terracotta-500">.</span></span><span className="font-mono text-[10px] uppercase tracking-widest text-ink-300">PRIVATE / FEEDBACK</span></div>
      <div className="rounded-xl border border-line bg-surface p-6 shadow-md sm:p-8">
        <p className="text-center font-display text-2xl font-semibold text-ink-900">
          {request.business.name}
        </p>
        <p className="mb-8 mt-2 text-center text-xs text-ink-500">
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
            commentPlaceholder: t("commentPlaceholder"),
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