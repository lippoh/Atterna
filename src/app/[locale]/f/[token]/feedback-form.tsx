// src/app/[locale]/f/[token]/feedback-form.tsx — client state bridge
// Holds the chosen rating between RatingInput and CommentForm (two taps
// total). V2 addition — the public page needs exactly one client island.
// V2.1 fix: threads invitationUrl through to CommentForm — without it
// the positive branch showed the neutral invitation text but the CTA
// link never rendered, leaving the growth loop's final step dark.
"use client";
import { useState } from "react";
import { RatingInput } from "@/components/feedback/rating-input";
import { CommentForm } from "@/components/feedback/comment-form";
export interface FeedbackFormLabels {
  question: string;
  low: string;
  high: string;
  negativePrompt: string;
  positivePrompt: string;
  submit: string;
  submitting: string;
  thanks: string;
  invitation: string;
  invitationCta: string;
  error: string;
}
export function FeedbackForm({
  token,
  labels,
  invitationUrl,
}: {
  token: string;
  labels: FeedbackFormLabels;
  invitationUrl?: string;
}) {
  const [rating, setRating] = useState<number | null>(null);
  if (rating === null) {
    return (
      <RatingInput
        value={null}
        onChange={setRating}
        labels={{ low: labels.low, high: labels.high, question: labels.question }}
      />
    );
  }
  return (
    <CommentForm
      token={token}
      rating={rating}
      labels={labels}
      invitationUrl={invitationUrl}
    />
  );
}