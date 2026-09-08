// src/components/feedback/comment-form.tsx — public QR comment + submit
// (§9.7): optional comment with a character counter, full-width primary
// «Αποστολή», and the success state that replaces the form without
// navigation — an SVG check that draws itself (400ms), then «Ευχαριστούμε!»
// and the Google nudge for 4-5★ (the fixed, neutral invitation —
// compliance guardrail, Section 16).
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IconArrowRight } from "@/components/ui/icons";
import { submitFeedback } from "@/app/[locale]/f/[token]/actions";

export interface CommentFormProps {
  token: string;
  rating: number;
  labels: {
    negativePrompt: string;
    positivePrompt: string;
    submit: string;
    submitting: string;
    thanks: string;
    invitation: string;
    invitationCta: string;
    error: string;
    commentPlaceholder?: string;
    quietClose?: string;
  };
  invitationUrl?: string;
}

type State = { ok: boolean; positive: boolean; error?: string } | null;

export function CommentForm({ token, rating, labels, invitationUrl }: CommentFormProps) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const comment = (formData.get("comment") as string | null)?.trim() || undefined;
      const result = await submitFeedback({ token, rating, comment });
      return result.ok
        ? { ok: true, positive: result.positive ?? false }
        : { ok: false, positive: false, error: result.error };
    },
    null
  );

  if (state?.ok) {
    return (
      <div className="space-y-6 text-center">
        {/* the check draws itself */}
        <svg
          viewBox="0 0 52 52"
          className="mx-auto size-14"
          role="img"
          aria-label={labels.thanks}
        >
          <circle
            cx="26"
            cy="26"
            r="24"
            fill="none"
            stroke="var(--success-600)"
            strokeWidth="2"
            opacity="0.25"
          />
          <path
            d="M15 27l7.5 7.5L37 19"
            fill="none"
            stroke="var(--success-600)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={60}
            className="check-draw"
          />
        </svg>
        <p className="font-display text-2xl font-semibold text-ink-900">
          {labels.thanks}
        </p>

        {state.positive ? (
          invitationUrl && (
            <div className="rounded-lg border border-aegean-100 bg-aegean-100/50 p-5 text-left">
              <p className="text-sm leading-relaxed text-ink-700">{labels.invitation}</p>
              <a
                href={invitationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-aegean-600 text-sm font-semibold text-aegean-600 transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-aegean-600 hover:text-white"
              >
                {labels.invitationCta}
                <IconArrowRight className="size-4" />
              </a>
            </div>
          )
        ) : (
          <p className="text-sm leading-relaxed text-ink-500">
            {labels.quietClose ?? ""}
          </p>
        )}
      </div>
    );
  }

  const negative = rating <= 3;
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="rating" value={rating} />
      <p className="text-[15px] font-medium leading-relaxed text-ink-700">
        {negative ? labels.negativePrompt : labels.positivePrompt}
      </p>
      {negative && (
        <div className="space-y-1.5">
          <Textarea
            name="comment"
            rows={4}
            maxLength={1000}
            placeholder={labels.commentPlaceholder ?? "…"}
            aria-label={labels.negativePrompt}
            className="min-h-[110px]"
          />
        </div>
      )}
      {state && !state.ok && (
        <p role="alert" className="text-[13px] font-medium text-danger-600">
          {labels.error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}
