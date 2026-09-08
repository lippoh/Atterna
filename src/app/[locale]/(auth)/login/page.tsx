// src/app/[locale]/(auth)/login/page.tsx — credentials login (client form)
"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestResetAction, signInAction, type ActionState } from "../actions";
export default function LoginPage() {
const [locale, setLocale] = useState("el");
const t = useTranslations("auth.login");
const tReset = useTranslations("auth.reset");
const [state, formAction, pending] = useActionState<ActionState, FormData>(
signInAction,
{}
);
const [resetState, resetAction, resetPending] = useActionState<ActionState, FormData>(
requestResetAction,
{}
);
return (
<main className="grid min-h-dvh lg:grid-cols-[1.1fr_.9fr]">
<section className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20"><div className="mx-auto w-full max-w-md">
<Link href="/" className="font-display text-xl font-semibold tracking-tight text-ink-900">Atterna<span className="text-terracotta-500">.</span></Link>
<p className="mt-16 text-xs font-semibold uppercase tracking-[.12em] text-terracotta-500">{t("title")}</p>
<h1 className="mt-3 font-display text-4xl font-semibold text-ink-900">{t("title")}</h1>
<form action={formAction} className="mt-8 space-y-5">
<input type="hidden" name="locale" value={locale} />
<div className="space-y-1.5">
<Label htmlFor="email">{t("email")}</Label>
<Input id="email" name="email" type="email" autoComplete="email" required />
</div>
<div className="space-y-1.5">
<Label htmlFor="password">{t("password")}</Label>
<Input
id="password"
name="password"
type="password"
autoComplete="current-password"
required
/>
</div>
{state.error && (
<p className="text-sm font-medium text-danger-600" role="alert">{t(state.error)}</p>
)}
<Button type="submit" className="w-full" disabled={pending}>
{pending ? t("submitting") : t("submit")}
</Button>
</form>
<p className="mt-5 text-sm text-ink-500">
{t("noAccount")}{" "}
<Link
href="/register"
className="font-semibold text-aegean-600 underline underline-offset-4"
>
{t("register")}
</Link>
</p>
<details className="mt-8 border-t border-line pt-5">
<summary className="cursor-pointer text-sm font-medium text-ink-700">
{t("forgot")}
</summary>
<form action={resetAction} className="mt-3 space-y-3">
<input type="hidden" name="locale" value={locale} />
<Input name="email" type="email" placeholder="email@example.com" required />
<Button type="submit" variant="secondary" className="w-full" disabled={resetPending}>
{tReset("requestSubmit")}
</Button>
{resetState.ok && (
<p className="text-xs text-success-600">{tReset("sent")}</p>
)}
{resetState.error && (
<p className="text-xs font-medium text-danger-600">{t("rateLimited")}</p>
)}
</form>
</details>
<div className="mt-8">
<button
type="button"
onClick={() => setLocale(locale === "el" ? "en" : "el")}
className="text-xs text-ink-500 underline underline-offset-4"
>
{locale === "el" ? "English" : "Ελληνικά"}
</button>
</div>
</div></section>
<aside className="hidden bg-ink-900 px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between"><Link href="/" className="font-display text-2xl font-semibold">Atterna<span className="text-terracotta-500">.</span></Link><div><p className="max-w-md font-display text-4xl leading-tight">{locale === "el" ? "Η φήμη χτίζεται μια κριτική τη φορά." : "Reputation is built one review at a time."}</p><p className="mt-6 max-w-sm text-sm leading-7 text-white/55">{locale === "el" ? "Καθαρή εικόνα. Ήρεμες απαντήσεις. Περισσότεροι πελάτες που επιστρέφουν." : "Clear signal. Calm replies. More customers who come back."}</p></div><p className="text-xs text-white/40">{locale === "el" ? "Σχεδιάστηκε στην Αθήνα" : "Designed in Athens"}</p></aside>
</main>
);
}