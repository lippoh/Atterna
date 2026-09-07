// src/components/reviews/language-badge.tsx — detected-language chip
export function LanguageBadge({ language }: { language: string | null | undefined }) {
  const code = (language ?? "—").slice(0, 2).toUpperCase();
  const styles: Record<string, string> = {
    EL: "bg-blue-100 text-blue-800",
    EN: "bg-slate-100 text-slate-700",
    DE: "bg-amber-100 text-amber-800",
    FR: "bg-indigo-100 text-indigo-800",
    IT: "bg-emerald-100 text-emerald-800",
  };
  const style = styles[code] ?? "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${style}`}>
      {code}
    </span>
  );
}