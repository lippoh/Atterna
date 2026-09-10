// src/app/[locale]/(auth)/login/page.tsx — credentials login (client form)
// Wrapped in the shared AuthShell split layout (§9.2). Labels above
// inputs, full-width primary button, inline errors, forgotten-password
// details block, locale from next-intl (not useState — the route locale
// is the truth).
"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestResetAction, signInAction, type ActionState } from "../actions";

export default function LoginPage() {
  const locale = useLocale();
  const t = useTranslations("auth.login");
  const tReset = useTranslations("auth.reset");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signInAction,
    {}
  );
  const [resetState, resetAction, resetPending] = useActionState<
    ActionState,
    FormData
  >(requestResetAction, {});

  return (
    <AuthShell locale={locale}>
      <main id="main-content">
        <h1 className="font-display text-3xl font-semibold text-ink-900">
          {t("title")}
        </h1>

        <form action={formAction} className="mt-8 space-y-5">
          <input type="hidden" name="locale" value={locale} />
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password">{t("password")}</Label>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
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
            {pending ? t("submitting") : t("submit")}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-500">
          {t("noAccount")}{" "}
          <Link
            href="/register"
            className="link-grow font-semibold text-aegean-600"
          >
            {t("register")}
          </Link>
        </p>

        <details className="group mt-8 rounded-lg border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-ink-700 transition-colors hover:text-ink-900 [&::-webkit-details-marker]:hidden">
            {t("forgot")}
            <span className="text-ink-300 transition-transform duration-200 group-open:rotate-45">
              +
            </span>
          </summary>
          {/* Expanding panel (Stage H, spec item 6): grid-rows expand. */}
          <div className="faq-panel">
            <div>
          <form action={resetAction} className="space-y-3 border-t border-line p-4">
            <input type="hidden" name="locale" value={locale} />
            <Input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="email@example.com"
              aria-label={t("email")}
              required
            />
            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              disabled={resetPending}
            >
              {tReset("requestSubmit")}
            </Button>
            {resetState.ok && (
              <p className="text-[13px] font-medium text-success-600">
                {tReset("sent")}
              </p>
            )}
            {resetState.error && (
              <p className="text-[13px] font-medium text-danger-600">
                {t("rateLimited")}
              </p>
            )}
          </form>
            </div>
          </div>
        </details>
      </main>
    </AuthShell>
  );
}
