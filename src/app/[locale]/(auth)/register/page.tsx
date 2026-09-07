// src/app/[locale]/(auth)/register/page.tsx — signup (client form)
"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction, type ActionState } from "../actions";
export default function RegisterPage() {
const [locale, setLocale] = useState("el");
const t = useTranslations("auth.register");
const [state, formAction, pending] = useActionState<ActionState, FormData>(
registerAction,
{}
);
if (state.ok) {
return (
<main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 text-center">
<p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm
text-emerald-800">
{t("done")}
</p>
<Link
href="/login"
className="mt-4 text-sm font-medium text-blue-700 underline"
>
{locale === "el" ? "Σύνδεση" : "Sign in"}
</Link>
</main>
);
}
return (
<main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
<h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
<form action={formAction} className="mt-6 space-y-4">
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
autoComplete="new-password"
minLength={10}
required
/>
</div>
{state.error && (
<p className="text-sm font-medium text-rose-600">{t(state.error)}</p>
)}
<Button type="submit" className="w-full" disabled={pending}>
{pending ? t("submitting") : t("submit")}
</Button>
</form>
<div className="mt-8 text-center">
<button
type="button"
onClick={() => setLocale(locale === "el" ? "en" : "el")}
className="text-xs text-slate-400 underline"
>
{locale === "el" ? "English" : "Ελληνικά"}
</button>
</div>
</main>
);
}