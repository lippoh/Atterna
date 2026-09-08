// src/components/marketing/footer.tsx — final CTA band + footer (§9.1)
// Final CTA: ink-900 band with a display-lg white line and a surface
// button. Footer: four columns, 13px ink-500 on canvas, meander hairline
// on top, bottom row with © + "Designed in Athens" + locale pill.
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/ui/reveal";
import { Logo } from "@/components/ui/logo";
import { IconArrowRight } from "@/components/ui/icons";

type Column = { title: string; links: { label: string; href: string }[] };

export async function FinalCta() {
  const t = await getTranslations("landing.cta");
  return (
    <section className="bg-ink-900">
      <div className="mx-auto max-w-[1120px] px-6 py-20 text-center md:py-28">
        <Reveal>
          <h2 className="mx-auto max-w-[22ch] font-display text-[clamp(2.1rem,1.5rem+2vw,3.25rem)] font-semibold leading-[1.12] text-white">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-relaxed text-white/60">
            {t("subtitle")}
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/register"
              className="inline-flex h-12 items-center gap-2 rounded-md bg-surface px-7 text-base font-semibold text-ink-900 shadow-md transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-lg active:translate-y-0"
            >
              {t("button")}
              <IconArrowRight className="size-4" />
            </Link>
          </div>
          <p className="mt-5 text-[13px] text-white/50">{t("micro")}</p>
        </Reveal>
      </div>
    </section>
  );
}

export async function MarketingFooter() {
  const t = await getTranslations("landing.footer");
  const locale = await getLocale();
  const other = locale === "el" ? "en" : "el";
  const columns = t.raw("columns") as Column[];

  return (
    <footer className="bg-background">
      <div className="meander-strip" aria-hidden="true" />
      <div className="mx-auto max-w-[1120px] px-6 pb-10 pt-14">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-[13px] font-semibold text-ink-900">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[13px] text-ink-500 transition-colors hover:text-aegean-600"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-6 border-t border-line pt-6 sm:flex-row sm:items-center">
          <Logo size="sm" />
          <div className="flex flex-wrap items-center gap-4 text-[13px] text-ink-500">
            <span>© 2026 Atterna</span>
            <span aria-hidden="true">·</span>
            <span>{t("designedIn")}</span>
            <span aria-hidden="true">·</span>
            <Link
              locale={other}
              href="/"
              className="rounded-full border border-line-strong px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-ink-500 transition-colors hover:border-ink-500"
            >
              {other.toUpperCase()}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
