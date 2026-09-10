// src/components/feedback/qr-generate-button.tsx — Stage B (Phase 6 preview).
// Client island over the QR token server action: acknowledges the click
// immediately (pending label + spinner, duplicate-submit guard) instead of
// leaving the button unchanged while the server mints the token.
"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { IconPlus } from "@/components/ui/icons";
import { generateQrToken } from "@/app/[locale]/(app)/feedback/actions";

export interface QrGenerateState {
  ok?: boolean;
  error?: string;
}

const initial: QrGenerateState = {};

export function QrGenerateButton() {
  const t = useTranslations("feedback");
  const [state, action, pending] = useActionState(generateQrToken, initial);
  const announced = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!pending && state.error && announced.current) {
      announced.current.focus();
    }
  }, [pending, state.error]);

  return (
    <div>
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-aegean-600 px-4 text-sm font-semibold text-white shadow-xs transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:bg-aegean-700 hover:shadow-sm active:translate-y-0 disabled:translate-y-0 disabled:opacity-60"
        >
          {pending ? (
            <span
              className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              aria-hidden="true"
            />
          ) : (
            <IconPlus className="size-4" />
          )}
          {pending ? t("generating") : t("generate")}
        </button>
      </form>
      {state.error && (
        <p
          ref={announced}
          tabIndex={-1}
          role="alert"
          className="mt-2 text-[13px] font-medium text-danger-600"
        >
          {t(`generateError.${state.error}`)}
        </p>
      )}
      <span aria-live="polite" className="sr-only">
        {pending ? t("generating") : ""}
      </span>
    </div>
  );
}
