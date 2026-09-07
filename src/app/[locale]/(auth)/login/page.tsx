// src/app/[locale]/(auth)/login/page.tsx — credentials login (client form)
"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestResetAction, signInAction, type ActionState } from "../actions";
export default function LoginPage({
params,
}: {
params: Promise<{ locale: string }>;
}) {
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
autoComplete="current-password"
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
<p className="mt-4 text-center text-sm text-slate-500">
{t("noAccount")}{" "}
<Link
href="/register"
className="font-medium text-blue-700 underline"
>
{t("register")}
</Link>
</p>
<details className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
<summary className="cursor-pointer text-sm text-slate-600">
{t("forgot")}
</summary>
<form action={resetAction} className="mt-3 space-y-3">
<input type="hidden" name="locale" value={locale} />
<Input name="email" type="email" placeholder="email@example.com" required />
<Button type="submit" variant="secondary" className="w-full" disabled={resetPending}>
{tReset("requestSubmit")}
</Button>
{resetState.ok && (
<p className="text-xs text-emerald-700">{tReset("sent")}</p>
)}
{resetState.error && (
<p className="text-xs font-medium text-rose-600">{t("rateLimited")}</p>
)}
</form>
</details>
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