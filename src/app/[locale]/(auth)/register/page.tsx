// src/app/[locale]/(auth)/register/page.tsx — signup (client form)
// AuthShell split layout; success state is an aegean check panel with a
// link to login (§9.2 success states).
"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconCheckCircle } from "@/components/ui/icons";
import { registerAction, type ActionState } from "../actions";

export default function RegisterPage() {
  const locale = useLocale();
  const t = useTranslations("auth.register");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    registerAction,
    {}
  );

  if (state.ok) {
    return (
      <AuthShell locale={locale}>
        <main id="main-content" className="text-center">
          <IconCheckCircle className="mx-auto size-12 text-aegean-600" />
          <h1 className="mt-5 font-display text-2xl font-semibold text-ink-900">
            {t("checkInbox")}
          </h1>
          <p className="lh-body mt-3 text-sm text-ink-700">{t("done")}</p>
          <Link
            href="/login"
            className="link-grow mt-6 inline-block text-sm font-semibold text-aegean-600"
          >
            {locale === "en" ? "Sign in" : "Σύνδεση"}
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
        <p className="mt-2 text-sm text-ink-500">{t("subtitle")}</p>

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
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
            <p className="text-[13px] text-ink-500">{t("passwordHint")}</p>
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

        <p className="mt-3 text-center text-[13px] text-ink-500">
          {t("terms")}
        </p>
        <p className="mt-5 text-center text-sm text-ink-500">
          {t("hasAccount")}{" "}
          <Link href="/login" className="link-grow font-semibold text-aegean-600">
            {t("login")}
          </Link>
        </p>
      </main>
    </AuthShell>
  );
}
