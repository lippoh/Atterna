// src/components/reviews/language-badge.tsx — detected-language chip (§7.4)
// Mono 11px 600, hairline border, radius-full. Neutral ink styling for
// every language — the chip is metadata, not sentiment.
export function LanguageBadge({ language }: { language: string | null | undefined }) {
  const code = (language ?? "—").slice(0, 2).toUpperCase();
  return (
    <span className="inline-flex items-center rounded-full border border-line-strong px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-ink-500">
      {code}
    </span>
  );
}
