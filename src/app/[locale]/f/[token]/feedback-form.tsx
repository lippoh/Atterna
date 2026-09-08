// src/app/[locale]/f/[token]/feedback-form.tsx — client state bridge
// Holds the chosen rating between RatingInput and CommentForm (two taps
// total). V2.1 fix kept: invitationUrl threads through to CommentForm.
// V2.2: threads the per-star labels + quiet close line too.
"use client";

import { useState } from "react";
import { RatingInput } from "@/components/feedback/rating-input";
import { CommentForm } from "@/components/feedback/comment-form";

export interface FeedbackFormLabels {
  question: string;
  low: string;
  high: string;
  starLabels: string[];
  negativePrompt: string;
  positivePrompt: string;
  submit: string;
  submitting: string;
  thanks: string;
  invitation: string;
  invitationCta: string;
  error: string;
  commentPlaceholder: string;
  quietClose: string;
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
        labels={{
          low: labels.low,
          high: labels.high,
          question: labels.question,
          starLabels: labels.starLabels,
        }}
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
