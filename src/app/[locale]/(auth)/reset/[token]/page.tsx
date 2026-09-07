// src/app/[locale]/(auth)/reset/[token]/page.tsx — set a new password
"use client";

import { useActionState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction, type ActionState } from "../../actions";

export default function ResetTokenPage() {
  const params = useParams<{ token: string; locale: string }>();
  const t = useTranslations("auth.reset");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(resetPasswordAction, {});

  if (state.ok) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 text-center">
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {t("ok")}
        </p>
        <Link href="/login" className="mt-4 text-sm font-medium text-blue-700 underline">
          login
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-bold text-slate-900">{t("newTitle")}</h1>
      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="token" value={params.token} />
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("newSubmit")}</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        </div>
        <div className="space-y-1.5">
          <Input name="confirm" type="password" autoComplete="new-password" minLength={10} required />
        </div>
        {state.error && <p className="text-sm font-medium text-rose-600">{t(state.error)}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {t("newSubmit")}
        </Button>
      </form>
    </main>
  );
}