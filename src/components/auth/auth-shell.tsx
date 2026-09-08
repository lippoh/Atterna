// src/components/auth/auth-shell.tsx — shared split layout for auth pages
// (§9.2): form column on canvas (max-w 400) + brand panel in ink-900 with
// the meander pattern and a serif line. Mobile hides the panel and shows
// a compact wordmark header. Pure JSX — importable from client pages.
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

export function AuthShell({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}) {
  const el = locale !== "en";
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[55fr_45fr]">
      {/* ── Form column ───────────────────────────────────────────────── */}
      <div className="flex flex-col px-6 py-8 sm:px-10">
        {/* compact header on mobile (brand panel hidden) */}
        <div className="flex items-center justify-between lg:invisible">
          <Logo size="md" />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </div>

      {/* ── Brand panel ───────────────────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-ink-900 lg:block" aria-hidden="true">
        {/* meander pattern at 4% white */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cpath d='M0 42 Q6 18 12 42 T24 42 T36 42 T48 42' fill='none' stroke='%23ffffff' stroke-width='1.5'/%3E%3C/svg%3E\")",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo size="md" className="text-white" />
          <blockquote>
            <p className="max-w-[22ch] font-display text-[clamp(1.5rem,1rem+1.5vw,2rem)] font-semibold leading-[1.2] text-white">
              {el
                ? "Η φήμη χτίζεται μια κριτική τη φορά."
                : "Reputation is built one review at a time."}
            </p>
          </blockquote>
          <p className="text-[13px] text-white/40">
            {el ? "Σχεδιάστηκε στην Αθήνα" : "Designed in Athens"}
          </p>
        </div>
      </aside>
    </div>
  );
}
