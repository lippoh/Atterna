// src/app/[locale]/(auth)/verify/page.tsx — email confirmation surface
// Landing point of the verify link (?token=) and manual paste fallback.
"use client";
import { useActionState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyEmailAction, type ActionState } from "../actions";
export default function VerifyPage() {
const t = useTranslations("auth.verify");
const searchParams = useSearchParams();
const [state, formAction, pending] = useActionState<ActionState, FormData>(
verifyEmailAction,
{}
);
const tokenFromUrl = searchParams.get("token") ?? "";
// Auto-submit when arriving from the email link.
useEffect(() => {
if (!tokenFromUrl) return;
const data = new FormData();
data.set("token", tokenFromUrl);
formAction(data);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [tokenFromUrl]);
if (state.ok) {
return (
<main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 text-center">
<p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm
text-emerald-800">
{t("ok")}
</p>
<Link href="/login" className="mt-4 text-sm font-medium text-blue-700 underline">
login
</Link>
</main>
);
}
return (
<main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
<h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
<p className="mt-2 text-sm text-slate-600">{t("body")}</p>
<form action={formAction} className="mt-6 space-y-4">
<div className="space-y-1.5">
<Input name="token" defaultValue={tokenFromUrl} required minLength={10} />
</div>
{state.error && (
<p className="text-sm font-medium text-rose-600">{t("bad")}</p>
)}
<Button type="submit" className="w-full" disabled={pending}>
{t("submit")}
</Button>
</form>
</main>
);
}