// src/app/[locale]/(auth)/actions.ts — auth server actions
// register / verify / request-reset / reset / sign-in / sign-out.
// Every action validates with zod, rate-limits public surfaces
// (login 5/h/IP, reset 3/h — Appendix 58) and writes audit rows.
"use server";
import { AuthError } from "next-auth";
import argon2 from "argon2";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signIn, signOut, unstable_update } from "@/lib/auth";
import { createToken, verifyToken } from "@/lib/token";
import { rateLimit } from "@/lib/ratelimit";
import { hashIp } from "@/lib/hash";
import { audit } from "@/lib/audit";
import { send } from "@/lib/mailer";
import { renderAlertEmail } from "@/emails/alert";
import { renderResetEmail } from "@/emails/reset";
import { env } from "@/lib/env";
import { routing } from "@/i18n/routing";
export interface ActionState {
ok?: boolean;
error?: string;
}
async function requestIp(): Promise<string> {
const h = await headers();
return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0";
}
function normalizeLocale(raw: FormDataEntryValue | null): string {
const value = String(raw ?? "").toLowerCase();
return routing.locales.includes(value as "el" | "en") ? value : routing.defaultLocale;
}
// ── Register ──────────────────────────────────────────────────────────────
const registerSchema = z.object({
email: z.string().email(),
password: z.string().min(10).max(128),
locale: z.enum(["el", "en"]).default("el"),
});
export async function registerAction(
_prev: ActionState,
formData: FormData
): Promise<ActionState> {
const parsed = registerSchema.safeParse({
email: String(formData.get("email") ?? ""),
password: String(formData.get("password") ?? ""),
locale: normalizeLocale(formData.get("locale")),
});
if (!parsed.success) return { error: "weak" };
const email = parsed.data.email.toLowerCase();
const existing = await prisma.user.findUnique({ where: { email } });
if (existing) return { error: "exists" };
const user = await prisma.user.create({
data: {
email,
passwordHash: await argon2.hash(parsed.data.password),
locale: parsed.data.locale === "en" ? "EN" : "EL",
},
});
const token = createToken(email, "verify", 24 * 60 * 60_000);
const html = await renderAlertEmail({
locale: parsed.data.locale,
kind: "verify",
verifyUrl: `${env.APP_URL}/${parsed.data.locale}/verify?token=${encodeURIComponent(token)}`,
});
await send({
to: email,
subject:
parsed.data.locale === "en"
? "Confirm your email"
: "Επιβεβαιώστε το email σας",
html,
});
await audit("auth.register", { userId: user.id });
return { ok: true };
}
// ── Verify email ───────────────────────────────────────────────────────────
export async function verifyEmailAction(
_prev: ActionState,
formData: FormData
): Promise<ActionState> {
const token = String(formData.get("token") ?? "");
const payload = verifyToken(token);
if (!payload || payload.kind !== "verify") return { error: "bad" };
const user = await prisma.user.findUnique({
    where: { email: payload.identifier },
});
if (!user) return { error: "bad" };
await prisma.user.update({
where: { id: user.id },
data: { emailVerified: new Date() },
});
await audit("auth.email_verified", { userId: user.id });
return { ok: true };
}
// ── Password reset ─────────────────────────────────────────────────────────
export async function requestResetAction(
_prev: ActionState,
formData: FormData
): Promise<ActionState> {
const locale = normalizeLocale(formData.get("locale"));
const email = String(formData.get("email") ?? "").toLowerCase();
const ip = await requestIp();
if (!(await rateLimit(`reset:${hashIp(ip)}`, 3, 3600))) return { error: "rateLimited" };
const user = await prisma.user.findUnique({ where: { email } });
if (user) {
const token = createToken(email, "reset", 60 * 60_000);
const html = await renderResetEmail({
locale,
minutesValid: 60,
resetUrl: `${env.APP_URL}/${locale}/reset/${encodeURIComponent(token)}`,
});
await send({
to: email,
subject: locale === "en" ? "Password reset" : "Επαναφορά κωδικού πρόσβασης",
html,
});
await audit("auth.reset_requested", { userId: user.id });
}
// Same response either way — no account enumeration.
return { ok: true };
}
export async function resetPasswordAction(
_prev: ActionState,
formData: FormData
): Promise<ActionState> {
const token = String(formData.get("token") ?? "");
const password = String(formData.get("password") ?? "");
const confirm = String(formData.get("confirm") ?? "");
if (password !== confirm) return { error: "mismatch" };
if (password.length < 10) return { error: "weak" };
const payload = verifyToken(token);
if (!payload || payload.kind !== "reset") return { error: "bad" };
const user = await prisma.user.findUnique({
where: { email: payload.identifier },
});
if (!user) return { error: "bad" };
// Single-use: tokens issued before the last password change are dead.
if (user.passwordChangedAt && payload.iat <= user.passwordChangedAt.getTime()) {
return { error: "bad" };
}
await prisma.user.update({
where: { id: user.id },
data: {
passwordHash: await argon2.hash(password),
passwordChangedAt: new Date(),
},
});
await audit("auth.password_reset", { userId: user.id });
return { ok: true };
}
// ── Sign in / out ──────────────────────────────────────────────────────────
const loginSchema = z.object({
email: z.string().email(),
password: z.string().min(1).max(128),
locale: z.enum(["el", "en"]).default("el"),
});
export async function signInAction(
_prev: ActionState,
formData: FormData
): Promise<ActionState> {
const parsed = loginSchema.safeParse({
email: String(formData.get("email") ?? ""),
password: String(formData.get("password") ?? ""),
locale: normalizeLocale(formData.get("locale")),
});
if (!parsed.success) return { error: "invalid" };
const ip = await requestIp();
if (!(await rateLimit(`login:${hashIp(ip)}`, 5, 3600))) {
return { error: "rateLimited" };
}
try {
await signIn("credentials", {
email: parsed.data.email,
password: parsed.data.password,
redirectTo: `/${parsed.data.locale}/dashboard`,
});
} catch (error) {
// The internal redirect must propagate; auth errors become messages.
const digest = (error as { digest?: string }).digest;
if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
if (error instanceof AuthError) return { error: "invalid" };
throw error;
}
return {};
}
export async function signOutAction(): Promise<void> {
await signOut({ redirectTo: "/login" });
}
// ── Preferences (locale switch persisted into the JWT) ────────────────────
export async function updateLocaleAction(locale: string): Promise<ActionState> {
const normalized = routing.locales.includes(locale as "el" | "en")
? locale
: routing.defaultLocale;
await unstable_update({ locale: normalized }); // jwt trigger = "update"
return { ok: true };
}