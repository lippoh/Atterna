// src/app/[locale]/f/[token]/page.tsx — PUBLIC QR feedback page (§9.7)
// No app chrome, no session, noindex, business-locale copy. Mobile-first,
// centered max-w-420 on canvas: business header (name + «Ιδιωτική
// ανατροφοδότηση»), the two-tap flow, and the 12px privacy footer. The
// expired state is a calm card with no retry.
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { FeedbackForm } from "./feedback-form";
import { Logo } from "@/components/ui/logo";

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
      <main
        id="main-content"
        className="mx-auto flex min-h-dvh max-w-[420px] flex-col items-center justify-center px-4 text-center"
      >
        <div className="w-full rounded-lg border border-line bg-surface p-8 shadow-xs">
          <Logo size="md" />
          <p className="mt-5 text-[15px] leading-relaxed text-ink-500">
            {t("notFound")}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center px-4 py-10"
    >
      <div className="rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <p className="text-center font-display text-xl font-semibold text-ink-900">
          {request.business.name}
        </p>
        <p className="mt-1 text-center text-[13px] text-ink-300">
          {locale === "en" ? "Private feedback" : "Ιδιωτική ανατροφοδότηση"}
        </p>
        <div className="mt-8">
          <FeedbackForm
            token={request.token}
            invitationUrl={request.business.reviewUrl ?? undefined}
            labels={{
              question: t("question"),
              low: t("low"),
              high: t("high"),
              starLabels: t.raw("starLabels") as string[],
              negativePrompt: t("negativePrompt"),
              positivePrompt: t("positivePrompt"),
              submit: t("submit"),
              submitting: t("submitting"),
              thanks: t("thanks"),
              invitation: t("invitation"),
              invitationCta: t("invitationCta"),
              error: t("error"),
              commentPlaceholder: t("commentPlaceholder"),
              quietClose: t("quietClose"),
            }}
          />
        </div>
      </div>
      <p className="mt-5 px-2 text-center text-xs leading-relaxed text-ink-300">
        {t("privacy")}
      </p>
    </main>
  );
}
