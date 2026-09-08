// src/components/reviews/language-badge.tsx — detected-language chip
export function LanguageBadge({ language }: { language: string | null | undefined }) {
  const code = (language ?? "—").slice(0, 2).toUpperCase();
  const styles: Record<string, string> = {
    EL: "border-aegean-600/30 bg-aegean-100 text-aegean-700",
    EN: "border-line-strong bg-sunken text-ink-700",
    DE: "border-terracotta-500/30 bg-terracotta-100 text-terracotta-500",
    FR: "border-line-strong bg-sunken text-ink-700",
    IT: "border-success-600/30 bg-success-100 text-success-600",
  };
  const style = styles[code] ?? "border-line-strong bg-sunken text-ink-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 font-mono text-[10px] font-bold ${style}`}>
      {code}
    </span>
  );
}