// src/components/feedback/comment-form.tsx — public QR comment + submit
// useActionState against the submitFeedback server action; the negative
// branch asks "what could we improve?" privately; the positive branch
// shows the fixed, neutral public invitation (compliance guardrail — the
// text cannot be edited into pressure, Section 16).
"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedback } from "@/app/[locale]/f/[token]/action";
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
<div className="space-y-4 text-center">
<p className="text-lg font-semibold text-emerald-700">{labels.thanks}</p>
{state.positive && (
<div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
<p className="text-sm text-slate-700">{labels.invitation}</p>
{invitationUrl && (
<a
href={invitationUrl}
target="_blank"
rel="noopener noreferrer"
className="mt-2 inline-block text-sm font-semibold text-blue-700 underline"
>
{labels.invitationCta}
</a>
)}
</div>
)}
</div>
);
}
const negative = rating <= 3;
return (
<form action={formAction} className="space-y-3">
<input type="hidden" name="token" value={token} />
<input type="hidden" name="rating" value={rating} />
<p className="text-sm font-medium text-slate-700">
{negative ? labels.negativePrompt : labels.positivePrompt}
</p>
{negative && (
<Textarea
name="comment"
rows={4}
maxLength={1000}
placeholder="..."
className="bg-white"
/>
)}
{state && !state.ok && (
<p className="text-xs font-medium text-rose-600">{labels.error}</p>
)}
<Button type="submit" size="lg" className="w-full" disabled={pending}>
{pending ? labels.submitting : labels.submit}
</Button>
</form>
);
}