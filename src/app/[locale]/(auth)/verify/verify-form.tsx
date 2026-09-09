// src/app/[locale]/(auth)/verify/verify-form.tsx — the verify client island
// Landing point of the verify link (?token=) and manual paste fallback.
// Lives in its own module so the page can wrap it in <Suspense> —
// useSearchParams must sit below a suspense boundary or `next build`
// refuses to prerender the route (V2.1 split, logic unchanged).
// V2.2 design: AuthShell wrapper, auto-progress strip, result states.
"use client";

import { useActionState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconCheckCircle, IconXCircle } from "@/components/ui/icons";
import { verifyEmailAction, resendVerificationAction, type ActionState } from "../actions";

export function VerifyForm() {
  const t = useTranslations("auth.verify");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    verifyEmailAction,
    {}
  );
  // Step 7: the resend lane for a lost/failed signup email.
  const [resendState, resendFormAction, resendPending] =
    useActionState<ActionState, FormData>(resendVerificationAction, {});

  const tokenFromUrl = searchParams.get("token") ?? "";

  // Auto-submit when arriving from the email link.
  useEffect(() => {
    if (!tokenFromUrl) return;
    const data = new FormData();
    data.set("token", tokenFromUrl);
    formAction(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFromUrl]);

  if (state.ok) {
    return (
      <AuthShell locale={locale}>
        <main id="main-content" className="text-center">
          <IconCheckCircle className="mx-auto size-12 text-aegean-600" />
          <h1 className="mt-5 font-display text-2xl font-semibold text-ink-900">
            {t("okTitle")}
          </h1>
          <p className="lh-body mt-3 text-sm text-ink-700">{t("ok")}</p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-10 items-center rounded-md bg-aegean-600 px-5 text-sm font-semibold text-white shadow-xs transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-aegean-700"
          >
            {t("goLogin")}
          </Link>
        </main>
      </AuthShell>
    );
  }

  return (
    <AuthShell locale={locale}>
      <main id="main-content">
        <h1 className="font-display text-3xl font-semibold text-ink-900">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-ink-500">{t("body")}</p>

        {/* auto-progress strip while the link token verifies */}
        {pending && tokenFromUrl && (
          <div className="mt-6 h-1 overflow-hidden rounded-full bg-sunken">
            <div className="skeleton h-full w-full" />
          </div>
        )}

        {tokenFromUrl ? (
          state.error && (
            <div className="mt-6 flex items-start gap-3 rounded-md bg-danger-100 px-4 py-3">
              <IconXCircle className="mt-0.5 size-5 shrink-0 text-danger-600" />
              <div>
                <p className="text-sm font-medium text-danger-600">{t("bad")}</p>
                <p className="mt-1 text-[13px] text-ink-700">{t("pasteFallback")}</p>
              </div>
            </div>
          )
        ) : (
          <form action={formAction} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Input
                name="token"
                defaultValue={tokenFromUrl}
                placeholder={t("tokenPlaceholder")}
                className="font-mono text-[13px]"
                autoFocus
                required
                minLength={10}
                aria-label={t("tokenLabel")}
              />
            </div>
            {state.error && (
              <p role="alert" className="text-[13px] font-medium text-danger-600">
                {t("bad")}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t("checking") : t("submit")}
            </Button>
          </form>
        )}

        {/* Step 7: didn't get the email? request a fresh verification link. */}
        <div className="mt-8 border-t border-line pt-6">
          <p className="text-[13px] font-medium text-ink-700">{t("resendTitle")}</p>
          <form action={resendFormAction} className="mt-3 flex items-start gap-2">
            <input type="hidden" name="locale" value={locale} />
            <div className="flex-1">
              <Input
                name="email"
                type="email"
                autoComplete="email"
                placeholder={t("resendEmailPlaceholder")}
                aria-label={t("resendEmailLabel")}
                required
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={resendPending}
            >
              {resendPending ? t("resendSending") : t("resendSubmit")}
            </Button>
          </form>
          {resendState.ok && (
            <p role="status" className="mt-2 text-[13px] font-medium text-aegean-700">
              {t("resendOk")}
            </p>
          )}
          {resendState.error && (
            <p role="alert" className="mt-2 text-[13px] font-medium text-danger-600">
              {resendState.error === "rateLimited" ? t("rateLimited") : t("serverError")}
            </p>
          )}
        </div>
      </main>
    </AuthShell>
  );
}
