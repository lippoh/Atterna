// src/components/reviews/draft-editor.tsx — AI draft → edit → approve
// Client component: the owner sees the draft labeled "Πρόταση AI", edits
// in one tap, approves (never auto-publishes). Server actions come from
// the page module and are passed as props.
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
export interface DraftEditorProps {
reviewId: string;
initialText: string | null;
status: "none" | "DRAFT" | "EDITED" | "APPROVED" | "PUBLISHED" | "FAILED";
labels: {
aiSuggestion: string;
generate: string;
save: string;
approve: string;
published: string;
failed: string;
generating: string;
emptyHint: string;
};
actions: {
generateDraft: (reviewId: string) => Promise<{ ok: boolean; text?: string; error?: string }>;
saveDraft: (reviewId: string, text: string) => Promise<{ ok: boolean; error?: string }>;
approveDraft: (reviewId: string, text: string) => Promise<{ ok: boolean; error?: string }>;
};
}
export function DraftEditor({ reviewId, initialText, status, labels, actions }:
DraftEditorProps) {
const [text, setText] = useState(initialText ?? "");
const [current, setCurrent] = useState(status);
const [error, setError] = useState<string | null>(null);
const [pending, startTransition] = useTransition();
const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
startTransition(async () => {
setError(null);
const result = await fn();
if (!result.ok) setError(result.error ?? "error");
});
};
return (
<div className="rounded-xl border border-slate-200 bg-white p-4">
<div className="flex items-center gap-2">
<Badge variant="secondary">{labels.aiSuggestion}</Badge>
{current === "PUBLISHED" && <Badge variant="success">{labels.published}</Badge>}
{current === "FAILED" && <Badge variant="destructive">{labels.failed}</Badge>}
</div>
{current === "PUBLISHED" ? (
<p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{text}</p>
) : (
<>
<Textarea
className="mt-3"
rows={6}
value={text}
placeholder={labels.emptyHint}
onChange={(e) => {
setText(e.target.value);
if (current === "DRAFT") setCurrent("EDITED");
}}
disabled={pending}
/>
<div className="mt-3 flex flex-wrap gap-2">
<Button
variant="outline"
size="sm"
disabled={pending}
onClick={() =>
run(async () => {
const r = await actions.generateDraft(reviewId);
if (r.ok && r.text) {
setText(r.text);
setCurrent("DRAFT");
}
return r;
})
}
>
{pending ? labels.generating : labels.generate}
</Button>
{text.trim().length > 0 && (
<Button variant="secondary" size="sm" disabled={pending}
onClick={() =>
run(async () => {
const r = await actions.saveDraft(reviewId, text);
if (r.ok) setCurrent("EDITED");
return r;
})
}
>
{labels.save}
</Button>
)}
{text.trim().length > 0 && current !== "APPROVED" && (
<Button size="sm" disabled={pending}
onClick={() =>
run(async () => {
const r = await actions.approveDraft(reviewId, text);
if (r.ok) setCurrent("APPROVED");
return r;
})
}
>
{labels.approve}
</Button>
)}
</div>
</>
)}
{error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
</div>
);
}