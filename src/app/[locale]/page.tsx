// src/app/[locale]/page.tsx — Aegean Premium marketing landing page
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const featureKeys = ["feature1", "feature2", "feature3", "feature4"] as const;
const planKeys = ["starter", "growth", "pro"] as const;
const faqKeys = ["one", "two", "three", "four", "five", "six"] as const;

function PreviewCard() {
  return (
    <div className="relative mx-auto w-full max-w-[520px] pb-8 pl-4 sm:pl-10">
      <div className="absolute bottom-0 left-0 z-0 w-[72%] translate-y-2 rotate-2 rounded-xl border border-line bg-surface p-5 shadow-md sm:left-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <span className="text-[11px] font-semibold text-ink-500">AI DRAFT</span>
          <span className="rounded-full bg-success-100 px-2 py-1 text-[10px] font-semibold text-success-600">Ready</span>
        </div>
        <p className="mt-4 font-display text-lg leading-tight text-ink-900">“Thank you for making our evening special...”</p>
        <div className="mt-4 h-2 w-3/4 rounded-full bg-sunken" />
      </div>
      <div className="relative z-10 rounded-xl border border-line bg-surface p-5 shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="font-semibold text-ink-900">Ταβέρνα «Κύμα»</p>
            <p className="mt-1 text-xs text-ink-500">Χανιά · Google Business Profile</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-success-100 px-2.5 py-1 text-[11px] font-semibold text-success-600">
            <span className="h-1.5 w-1.5 rounded-full bg-success-600" /> Synced
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 py-5">
          <div><p className="font-mono text-xl font-medium tabular-nums text-ink-900">4,8<span className="text-star-400">★</span></p><p className="mt-1 text-[11px] text-ink-500">Rating</p></div>
          <div><p className="font-mono text-xl font-medium tabular-nums text-ink-900">92%</p><p className="mt-1 text-[11px] text-ink-500">Answered</p></div>
          <div><p className="font-mono text-xl font-medium tabular-nums text-success-600">+11</p><p className="mt-1 text-[11px] text-ink-500">This week</p></div>
        </div>
        <div className="rounded-lg bg-sunken px-3 py-4">
          <div className="flex h-20 items-end gap-2">
            {[28, 35, 32, 44, 47, 58, 62, 73, 69, 84, 88, 96].map((height, index) => <span key={index} className="flex-1 rounded-t-sm bg-aegean-600/70" style={{ height: `${height}%` }} />)}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[9px] text-ink-300"><span>JUN 01</span><span>JUN 30</span></div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-success-600" /><span className="text-sm text-ink-700">“Wonderful food and service...”</span></div>
          <span className="text-xs font-semibold text-success-600">Answered</span>
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const other = locale === "el" ? "en" : "el";

  return (
    <main className="overflow-hidden bg-background">
      <nav className="sticky top-0 z-40 border-b border-line bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
          <Link href="/" className="font-display text-[22px] font-semibold tracking-tight text-ink-900">Atterna<span className="text-terracotta-500">.</span></Link>
          <div className="hidden items-center gap-7 md:flex">
            <a href="#how-it-works" className="text-sm font-medium text-ink-700 transition-colors hover:text-aegean-600">{t("howItWorks")}</a>
            <a href="#pricing" className="text-sm font-medium text-ink-700 transition-colors hover:text-aegean-600">{t("pricing.title")}</a>
            <Link locale={other} href="/" className="font-mono text-xs font-medium text-ink-500 hover:text-aegean-600">{other.toUpperCase()}</Link>
            <Link href="/login" className="text-sm font-medium text-ink-700 hover:text-aegean-600">{t("login")}</Link>
            <Link href="/register" className="rounded-sm bg-aegean-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:-translate-y-px hover:bg-aegean-700">{t("cta")}</Link>
          </div>
          <div className="flex items-center gap-3 md:hidden"><Link locale={other} href="/" className="font-mono text-xs text-ink-500">{other.toUpperCase()}</Link><Link href="/register" className="rounded-sm bg-aegean-600 px-3 py-2 text-xs font-semibold text-white">{t("cta")}</Link></div>
        </div>
      </nav>

      <section className="relative mx-auto grid max-w-[1120px] items-center gap-12 px-6 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_.95fr] lg:gap-8 lg:pb-28 lg:pt-24">
        <div className="relative z-10">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[.12em] text-terracotta-500">{t("kicker")}</p>
          <h1 className="max-w-[680px] font-display text-[clamp(2.6rem,1.6rem+4vw,4.6rem)] font-semibold leading-[1.05] tracking-[-.015em] text-ink-900">{t("title")}</h1>
          <p className="mt-7 max-w-[58ch] text-[17px] leading-8 text-ink-700">{t("subtitle")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3"><Link href="/register" className="rounded-sm bg-aegean-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-aegean-700">{t("cta")}</Link><a href="#how-it-works" className="rounded-sm border border-line-strong bg-surface px-5 py-3 text-sm font-semibold text-ink-900 transition hover:border-ink-500">{t("ctaSecondary")}</a></div>
          <p className="mt-5 text-[13px] text-ink-500">{t("microTrust")}</p>
        </div>
        <div className="relative lg:pl-4"><div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-aegean-100/60 blur-3xl" /><PreviewCard /></div>
      </section>
      <div className="meander-divider" />

      <section className="border-y border-line bg-surface"><div className="mx-auto max-w-[1120px] px-6 py-5 text-center text-[13px] text-ink-500">{t("trust")}</div></section>

      <section className="mx-auto grid max-w-[1120px] gap-10 px-6 py-20 sm:py-24 lg:grid-cols-[.8fr_1.2fr] lg:gap-24">
        <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-terracotta-500">{t("problemEyebrow")}</p><h2 className="mt-4 font-display text-4xl font-semibold leading-tight text-ink-900 sm:text-5xl">{t("problemTitle")}</h2></div>
        <div><p className="max-w-[62ch] text-lg leading-8 text-ink-700">{t("problemBody")}</p><div className="mt-10 grid gap-6 border-t border-line pt-6 sm:grid-cols-3"><div><p className="font-display text-4xl text-terracotta-500">81%</p><p className="mt-2 text-sm leading-6 text-ink-500">{t("problemStats.read")}</p></div><div><p className="font-display text-4xl text-terracotta-500">1 in 3</p><p className="mt-2 text-sm leading-6 text-ink-500">{t("problemStats.book")}</p></div><div><p className="font-display text-4xl text-terracotta-500">24h</p><p className="mt-2 text-sm leading-6 text-ink-500">{t("problemStats.return")}</p></div></div></div>
      </section>

      <section id="how-it-works" className="bg-ink-900 py-20 text-white sm:py-24"><div className="mx-auto max-w-[1120px] px-6"><p className="text-xs font-semibold uppercase tracking-[.12em] text-terracotta-500">{t("howItWorks")}</p><div className="mt-10 grid gap-10 md:grid-cols-4">{(["connect", "analyze", "understand", "respond"] as const).map((step, index) => <div key={step} className="relative border-t border-white/20 pt-5"><p className="font-display text-3xl text-white/60">0{index + 1}</p><h3 className="mt-5 text-lg font-semibold">{t(`steps.${step}`)}</h3><p className="mt-2 text-sm leading-6 text-white/60">{index === 0 ? "One official connection." : index === 1 ? "Signal, not noise." : index === 2 ? "A clear next move." : "You stay in control."}</p></div>)}</div></div></section>

      <section className="mx-auto max-w-[1120px] px-6 py-20 sm:py-28"><p className="text-xs font-semibold uppercase tracking-[.12em] text-terracotta-500">{t("featuresEyebrow")}</p><div className="mt-14 space-y-24">{featureKeys.map((key, index) => { const points = t(`${key}.points`).split("|"); return <div key={key} className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-20 ${index % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}><div><p className="text-sm font-semibold text-aegean-600">{t(`${key}.eyebrow`)}</p><h2 className="mt-4 max-w-[12ch] font-display text-4xl font-semibold leading-tight text-ink-900 sm:text-5xl">{t(`${key}.title`)}</h2><p className="mt-5 max-w-[54ch] leading-7 text-ink-700">{t(`${key}.body`)}</p><ul className="mt-6 space-y-3">{points.map((point) => <li key={point} className="flex gap-3 text-sm text-ink-700"><span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-aegean-100 text-xs font-bold text-aegean-600">+</span>{point}</li>)}</ul></div><div className="min-h-[260px] rounded-xl border border-line bg-sunken p-5 shadow-xs">{index === 0 ? <div className="space-y-3 pt-4"><div className="flex items-center justify-between border-b border-line pb-4"><span className="font-semibold text-ink-900">Reviews</span><span className="rounded-full bg-terracotta-100 px-2 py-1 text-xs text-terracotta-500">3 unanswered</span></div>{["Wonderful evening...", "Too slow for lunch", "We will come back"].map((item, i) => <div key={item} className="flex items-center justify-between border-b border-line py-4"><div className="flex items-center gap-3"><span className={`h-2 w-2 rounded-full ${i === 1 ? "bg-danger-600" : "bg-success-600"}`} /><span className="text-sm text-ink-700">{item}</span></div><span className="font-mono text-[10px] text-ink-300">{i + 1}h</span></div>)}</div> : index === 1 ? <div className="mx-auto max-w-sm rounded-lg border border-line bg-surface p-5 shadow-sm"><div className="flex gap-2"><span className="rounded-full bg-aegean-100 px-3 py-1 text-xs text-aegean-700">Friendly</span><span className="rounded-full bg-sunken px-3 py-1 text-xs text-ink-500">Ελληνικά</span></div><p className="mt-5 font-display text-2xl leading-tight text-ink-900">«Σας ευχαριστούμε που μοιραστήκατε την εμπειρία σας...»</p><div className="mt-5 flex justify-end"><span className="rounded-sm bg-aegean-600 px-3 py-2 text-xs font-semibold text-white">Approve</span></div></div> : index === 2 ? <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-4 py-8 text-center"><div className="grid h-28 w-20 place-items-center rounded-2xl border-4 border-ink-900 bg-surface shadow-sm"><div className="h-12 w-12 border-4 border-dashed border-aegean-600" /></div><p className="text-sm font-semibold text-ink-900">Private first. Public when earned.</p><p className="text-xs text-ink-500">QR → feedback → the right next step</p></div> : <div className="mx-auto max-w-sm bg-surface p-5 shadow-sm"><div className="flex items-center justify-between border-b border-line pb-4"><span className="font-display text-xl text-ink-900">Your Monday signal</span><span className="font-mono text-[10px] text-ink-300">07:30</span></div><div className="mt-5 grid grid-cols-3 gap-3 text-center"><div><p className="font-mono text-xl text-ink-900">4,8★</p><p className="text-[10px] text-ink-500">rating</p></div><div><p className="font-mono text-xl text-success-600">+12</p><p className="text-[10px] text-ink-500">new reviews</p></div><div><p className="font-mono text-xl text-terracotta-500">2</p><p className="text-[10px] text-ink-500">to improve</p></div></div></div>}</div></div> })}</div></section>

      <section className="bg-ink-900 py-16 text-white sm:py-20"><div className="mx-auto grid max-w-[1120px] grid-cols-2 gap-8 px-6 sm:grid-cols-4">{(["one", "two", "three", "four"] as const).map((stat) => <div key={stat} className="border-l border-white/20 pl-4"><p className="font-display text-3xl sm:text-4xl">{stat === "one" ? "1" : stat === "two" ? "2" : stat === "three" ? "1" : "Every"}</p><p className="mt-2 text-sm text-white/60">{t(`stats.${stat}`)}</p></div>)}</div></section>

      <section className="mx-auto max-w-[1120px] px-6 py-20 sm:py-24"><p className="text-xs font-semibold uppercase tracking-[.12em] text-terracotta-500">{t("testimonialsEyebrow")}</p><div className="mt-10 grid gap-4 md:grid-cols-3">{(["one", "two", "three"] as const).map((key) => <figure key={key} className="rounded-lg border border-line bg-surface p-6 shadow-xs"><div className="flex gap-1 text-sm text-star-400">★★★★★</div><blockquote className="mt-6 font-display text-xl leading-snug text-ink-900">“{t(`testimonials.${key}.quote`)}”</blockquote><figcaption className="mt-8 border-t border-line pt-4"><p className="text-sm font-semibold text-ink-900">{t(`testimonials.${key}.name`)}</p><p className="mt-1 text-xs text-ink-500">{t(`testimonials.${key}.business`)}</p></figcaption></figure>)}</div></section>

      <section id="pricing" className="bg-sunken py-20 sm:py-24"><div className="mx-auto max-w-[1120px] px-6"><p className="text-xs font-semibold uppercase tracking-[.12em] text-terracotta-500">{t("pricing.eyebrow")}</p><h2 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-tight text-ink-900 sm:text-5xl">{t("pricing.title")}</h2><div className="mt-10 grid gap-4 lg:grid-cols-3">{planKeys.map((plan, index) => <div key={plan} className={`relative flex flex-col rounded-lg border bg-surface p-6 shadow-xs ${index === 1 ? "border-aegean-600 shadow-md lg:-translate-y-2" : "border-line"}`}>{index === 1 && <span className="absolute -top-3 left-6 rounded-full bg-aegean-600 px-3 py-1 text-xs font-semibold text-white">{t("pricing.popular")}</span>}<p className="text-sm font-semibold text-ink-500">{t(`pricing.${plan}.name`)}</p><p className="mt-5 font-display text-4xl text-ink-900">{t(`pricing.${plan}.price`)}</p><p className="mt-2 text-sm text-ink-500">{t(`pricing.${plan}.desc`)}</p><ul className="mt-7 flex-1 space-y-3 border-t border-line pt-5">{t(`pricing.${plan}.features`).split("|").map((feature) => <li key={feature} className="flex gap-3 text-sm text-ink-700"><span className="text-aegean-600">✓</span>{feature}</li>)}</ul><Link href="/register" className={`mt-8 block rounded-sm px-4 py-3 text-center text-sm font-semibold ${index === 1 ? "bg-aegean-600 text-white hover:bg-aegean-700" : "border border-line-strong text-ink-900 hover:bg-sunken"}`}>{t("cta")}</Link></div>)}</div><p className="mt-6 text-center text-xs text-ink-500">{t("pricing.finePrint")}</p></div></section>

      <section className="mx-auto max-w-[800px] px-6 py-20 sm:py-24"><p className="text-xs font-semibold uppercase tracking-[.12em] text-terracotta-500">{t("faqEyebrow")}</p><div className="mt-8 divide-y divide-line border-y border-line">{faqKeys.map((key) => <details key={key} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-base font-semibold text-ink-900 marker:hidden"><span>{t(`faq.${key}Q`)}</span><span className="text-xl font-normal text-terracotta-500 transition group-open:rotate-45">+</span></summary><p className="max-w-[66ch] pt-4 text-sm leading-7 text-ink-700">{t(`faq.${key}A`)}</p></details>)}</div></section>

      <section className="bg-ink-900 py-20 text-center text-white sm:py-24"><div className="mx-auto max-w-[700px] px-6"><h2 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">{t("finalTitle")}</h2><p className="mx-auto mt-5 max-w-[48ch] text-white/65">{t("finalBody")}</p><Link href="/register" className="mt-8 inline-flex rounded-sm bg-surface px-6 py-3 text-sm font-semibold text-ink-900 transition hover:-translate-y-px">{t("cta")}</Link></div></section>

      <footer className="mx-auto max-w-[1120px] px-6 py-10"><div className="meander-divider mb-10" /><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><Link href="/" className="font-display text-xl font-semibold text-ink-900">Atterna<span className="text-terracotta-500">.</span></Link><div className="flex flex-wrap gap-5 text-sm text-ink-500"><Link href="/login" className="hover:text-aegean-600">{t("login")}</Link><Link href="/register" className="hover:text-aegean-600">{t("cta")}</Link><span>{t("footerTag")}</span></div></div><p className="mt-8 text-xs text-ink-300">© 2026 Atterna · {t("footerTag")}</p></footer>
    </main>
  );
}
