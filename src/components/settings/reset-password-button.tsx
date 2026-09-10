// src/components/settings/reset-password-button.tsx — Security section
// island (Stage F): sends the real reset email via requestResetAction
// (rate-limited 3/h, 60-minute token). Pending/sent/error states; the
// email + locale travel as hidden fields.
"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { requestResetAction, type ActionState } from "@/app/[locale]/(app)/actions";

const INITIAL: ActionState = {};

export function ResetPasswordButton({ email, locale }: { email: string; locale: string }) {
  const t = useTranslations("settings");
  const [state, action, pending] = useActionState(requestResetAction, INITIAL);

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          disabled={pending || state.ok}
          className="inline-flex h-10 items-center rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-ink-900 shadow-xs transition-colors hover:bg-sunken disabled:opacity-60"
        >
          {pending ? t("resetSending") : t("sendReset")}
        </button>
      </form>
      <p className="mt-2 text-[13px] text-ink-500">{t("resetHint", { email })}</p>
      {state.ok && (
        <p className="mt-2 text-[13px] font-medium text-success-600">{t("resetSent")}</p>
      )}
      {state.error && !state.ok && (
        <p className="mt-2 text-[13px] font-medium text-danger-600">{t("resetError")}</p>
      )}
    </div>
  );
}
