// src/app/[locale]/(auth)/reset/[token]/page.tsx — set a new password
// AuthShell layout; success state with aegean check + login link.
"use client";

import { useActionState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconCheckCircle } from "@/components/ui/icons";
import { resetPasswordAction, type ActionState } from "../../actions";

export default function ResetTokenPage() {
  const params = useParams<{ token: string; locale: string }>();
  const locale = useLocale();
  const t = useTranslations("auth.reset");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    resetPasswordAction,
    {}
  );

  if (state.ok) {
    return (
      <AuthShell locale={locale}>
        <main id="main-content" className="text-center">
          <IconCheckCircle className="mx-auto size-12 text-aegean-600" />
          <h1 className="mt-5 font-display text-2xl font-semibold text-ink-900">
            {t("okTitle")}
          </h1>
          <p className="mt-3 text-sm text-ink-700">{t("ok")}</p>
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
          {t("newTitle")}
        </h1>

        <form action={formAction} className="mt-8 space-y-5">
          <input type="hidden" name="token" value={params.token} />
          <div className="space-y-2">
            <Label htmlFor="password">{t("newPassword")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">{t("confirm")}</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </div>
          {state.error && (
            <p
              role="alert"
              aria-live="polite"
              className="rounded-md bg-danger-100 px-3 py-2 text-[13px] font-medium text-danger-600"
            >
              {t(state.error)}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("saving") : t("newSubmit")}
          </Button>
        </form>
      </main>
    </AuthShell>
  );
}
