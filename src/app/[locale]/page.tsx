// src/app/[locale]/page.tsx — landing (el/en)
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
export default async function LandingPage({
params,
}: {
params: Promise<{ locale: string }>;
}) {
const { locale } = await params;
setRequestLocale(locale);
const other = locale === "el" ? "en" : "el";
const t = await getTranslations("landing");
return (
<main className="mx-auto max-w-2xl px-4 py-10 pb-24">
<header className="flex items-center justify-between">
<span className="text-sm font-bold text-blue-800">ΦΗΜΗ</span>
<nav className="flex items-center gap-3 text-sm">
<Link locale={other} href="/" className="text-slate-500 underline">
{other.toUpperCase()}
</Link>
<Link
href="/register"
className="rounded-md bg-blue-700 px-3 py-1.5 font-medium text-white"
>
{t("cta")}
</Link>
</nav>
</header>
<section className="mt-12">
<p className="text-xs font-semibold uppercase tracking-widest text-blue-700">
{t("kicker")}
</p>
<h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900">
{t("title")}
</h1>
<p className="mt-4 text-base leading-relaxed text-slate-600">
{t("subtitle")}
</p>
<div className="mt-6 flex flex-wrap gap-3">
<Link
href="/register"
className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white shadow
hover:bg-blue-800"
>
{t("cta")}
</Link>
</div>
</section>
<section className="mt-14">
<h2 className="text-lg font-bold text-slate-900">{t("howItWorks")}</h2>
<ol className="mt-4 space-y-3">
{(["connect", "analyze", "understand", "respond"] as const).map((step, i) => (
<li key={step} className="flex gap-3 rounded-xl border border-slate-200 bg-white
p-4">
<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
bg-blue-100 text-sm font-bold text-blue-800">
{i + 1}
</span>
<p className="text-sm text-slate-700">{t(`steps.${step}`)}</p>
</li>
))}
</ol>
</section>
<section className="mt-14">
<h2 className="text-lg font-bold text-slate-900">{t("pricing.title")}</h2>
<div className="mt-4 grid gap-3">
{(["starter", "growth", "pro"] as const).map((plan) => (
<div key={plan} className="rounded-xl border border-slate-200 bg-white p-4">
<div className="flex items-baseline justify-between">
<p className="font-bold text-slate-900">{t(`pricing.${plan}.name`)}</p>
<p className="text-lg font-bold text-blue-800">
{t(`pricing.${plan}.price`)}
</p>
</div>
<p className="mt-1 text-sm text-slate-600">{t(`pricing.${plan}.desc`)}</p>
</div>
))}
</div>
<p className="mt-3 text-center text-xs text-slate-400">{t("trustedBy")}</p>
</section>
</main>
);
}