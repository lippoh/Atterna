// src/components/reviews/draft-editor.tsx — AI draft → edit → approve
// (§9.5). Client island: status chip, autosizing textarea, character
// count (mono, right-aligned), and a two-step inline confirmation before
// publishing — the action is irreversible. Published/failed states render
// as result panels. Server actions come from the page module as props.
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IconCheckCircle, IconXCircle, IconRefresh } from "@/components/ui/icons";

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
    confirm?: string;
    confirmYes?: string;
    confirmNo?: string;
    chars?: string;
  };
  actions: {
    generateDraft: (reviewId: string) => Promise<{ ok: boolean; text?: string; error?: string }>;
    saveDraft: (reviewId: string, text: string) => Promise<{ ok: boolean; error?: string }>;
    approveDraft: (reviewId: string, text: string) => Promise<{ ok: boolean; error?: string }>;
  };
}

export function DraftEditor({ reviewId, initialText, status, labels, actions }: DraftEditorProps) {
  const [text, setText] = useState(initialText ?? "");
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [publishedAt, setPublishedAt] = useState<Date | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) setError(result.error ?? "error");
    });
  };

  const busy = pending;

  // ── Published: a calm success panel ──────────────────────────────────
  if (current === "PUBLISHED") {
    return (
      <div className="rounded-lg border border-success-600/40 bg-success-100/60 p-5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <IconCheckCircle className="size-5 shrink-0 text-success-600" />
          <p className="text-[15px] font-semibold text-success-600">{labels.published}</p>
        </div>
        <p className="lh-body mt-3 whitespace-pre-wrap rounded-md bg-surface p-4 text-sm leading-relaxed text-ink-700">
          {text}
        </p>
        {publishedAt && (
          <p className="mt-3 font-mono text-[11px] tabular-nums text-ink-500">
            {publishedAt.toLocaleString()}
          </p>
        )}
      </div>
    );
  }

  // ── Failed: danger panel with the reason + retry ─────────────────────
  const showFailedPanel = current === "FAILED" && error === null && initialText;

  return (
    <div className="rounded-lg border border-line bg-surface p-5 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-aegean-100 px-2.5 py-1 text-[11px] font-semibold text-aegean-600">
          {labels.aiSuggestion}
        </span>
        {current === "FAILED" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-100 px-2.5 py-1 text-[11px] font-semibold text-danger-600">
            <IconXCircle className="size-3" />
            {labels.failed}
          </span>
        )}
        {current === "EDITED" && (
          <span className="rounded-full bg-sunken px-2.5 py-1 text-[11px] font-semibold text-ink-700">
            edit
          </span>
        )}
      </div>

      {showFailedPanel && (
        <div className="mt-4 flex items-start gap-3 rounded-md bg-danger-100/70 px-4 py-3 text-[13px] leading-relaxed text-danger-600">
          <IconXCircle className="mt-0.5 size-4 shrink-0" />
          <span>{labels.failed}</span>
        </div>
      )}

      <Textarea
        className="mt-4 min-h-[140px] font-[inherit]"
        rows={6}
        value={text}
        placeholder={labels.emptyHint}
        aria-label={labels.aiSuggestion}
        onChange={(e) => {
          setText(e.target.value);
          if (current === "DRAFT") setCurrent("EDITED");
        }}
        disabled={busy}
      />

      {/* character count — mono, right-aligned */}
      <p className="mt-2 text-right font-mono text-[11px] tabular-nums text-ink-300">
        {text.trim().length} {labels.chars ?? ""}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setConfirming(false);
            run(async () => {
              const r = await actions.generateDraft(reviewId);
              if (r.ok && r.text) {
                setText(r.text);
                setCurrent("DRAFT");
              }
              return r;
            });
          }}
        >
          <IconRefresh className="size-4" />
          {busy ? labels.generating : labels.generate}
        </Button>
        {text.trim().length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
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
          <Button
            size="sm"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            {labels.approve}
          </Button>
        )}
      </div>

      {/* Two-step inline confirmation — publishing is irreversible. */}
      {confirming && (
        <div className="mt-4 rounded-md border border-star-400/50 bg-terracotta-100/60 p-4" role="alertdialog" aria-live="polite">
          <p className="text-[13px] font-medium leading-relaxed text-ink-700">
            {labels.confirm ?? ""}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await actions.approveDraft(reviewId, text);
                  if (r.ok) {
                    setCurrent("PUBLISHED");
                    setPublishedAt(new Date());
                    setConfirming(false);
                  }
                  return r;
                })
              }
            >
              {labels.confirmYes ?? "OK"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              {labels.confirmNo ?? "×"}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-danger-100 px-3 py-2 text-[13px] font-medium text-danger-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
