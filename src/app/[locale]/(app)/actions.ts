// src/app/[locale]/(app)/actions.ts — auth server actions
// register / verify / request-reset / reset / sign-in / sign-out.
// Every action validates with zod, rate-limits public surfaces
// (login 5/h/IP, reset 3/h — Appendix 58) and writes audit rows.
//
// V2.3 fixes (the 500-on-signup class):
// 1. siteOrigin() — the verify/reset links prefer env.APP_URL, but when it
//    is not configured the origin is derived from the request's forwarded
//    headers, so sign-up works on a partially configured deployment.
// 2. Every user-facing action catches unexpected errors and returns
//    { error: "serverError" } instead of throwing a 500 — the form shows a
//    readable message instead of a minified React error. Redirect digests
//    (NEXT_REDIRECT) are always re-thrown.
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
import { renderAlertEmail, renderAlertEmailText } from "@/emails/alert";
import { renderResetEmail, renderResetEmailText } from "@/emails/reset";
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

/**
 * Public base URL for email links. Prefers APP_URL from the environment;
 * falls back to the request's own origin (x-forwarded-host on Vercel), so
 * verify/reset links are correct even before APP_URL is configured.
 */
async function siteOrigin(): Promise<string> {
  try {
    return env.APP_URL;
  } catch {
    const h = await headers();
    const host =
      h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto =
      h.get("x-forwarded-proto") ??
      (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
}

function normalizeLocale(raw: FormDataEntryValue | null): string {
  const value = String(raw ?? "").toLowerCase();
  return routing.locales.includes(value as "el" | "en") ? value : routing.defaultLocale;
}

/** Re-throw framework redirect digests; report everything else. */
function isRedirect(error: unknown): boolean {
  const digest = (error as { digest?: string }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
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
  try {
    const parsed = registerSchema.safeParse({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      locale: normalizeLocale(formData.get("locale")),
    });
    if (!parsed.success) return { error: "weak" };
    const email = parsed.data.email.toLowerCase();
    const ip = await requestIp();
    // Step 7: registration is a public email-sending surface — without a
    // bucket, an attacker burns Resend quota with throwaway signups
    // (Appendix 58 discipline, same as login/reset).
    if (!(await rateLimit(`register:${hashIp(ip)}`, 3, 3600))) {
      return { error: "rateLimited" };
    }
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
    const origin = await siteOrigin();
    const props = {
      locale: parsed.data.locale,
      kind: "verify" as const,
      verifyUrl: `${origin}/${parsed.data.locale}/verify?token=${encodeURIComponent(token)}`,
    };
    const [html, text] = await Promise.all([
      renderAlertEmail(props),
      renderAlertEmailText(props),
    ]);
    const result = await send({
      to: email,
      subject:
        parsed.data.locale === "en"
          ? "Confirm your email"
          : "Επιβεβαιώστε το email σας",
      html,
      text,
    });
    await audit("auth.register", { userId: user.id });
    if (!result.ok) {
      // The account exists but the verification email failed. Surface it
      // instead of pretending "check your inbox": the register page shows
      // the emailFailed state and links to /verify, where a fresh link can
      // be requested (resendVerificationAction).
      console.error("registerAction: verification email failed:", result.error);
      await audit("auth.register_email_failed", { userId: user.id });
      return { error: "emailFailed" };
    }
    return { ok: true };
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error("registerAction failed:", error);
    return { error: "serverError" };
  }
}

// ── Verify email ───────────────────────────────────────────────────────────
export async function verifyEmailAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
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
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error("verifyEmailAction failed:", error);
    return { error: "serverError" };
  }
}

// ── Resend verification ─────────────────────────────────────────────────────
/** Step 7: the recovery path for a lost/failed signup email. Rate-limited
 *  3/h/IP; returns { ok: true } whether or not a pending account exists
 *  (same no-enumeration contract as requestResetAction) — send failures
 *  are logged server-side, never surfaced as a different response. */
export async function resendVerificationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const locale = normalizeLocale(formData.get("locale"));
    const email = String(formData.get("email") ?? "").toLowerCase();
    const ip = await requestIp();
    if (!(await rateLimit(`resend-verify:${hashIp(ip)}`, 3, 3600))) {
      return { error: "rateLimited" };
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified) {
      const token = createToken(email, "verify", 24 * 60 * 60_000);
      const origin = await siteOrigin();
      const props = {
        locale,
        kind: "verify" as const,
        verifyUrl: `${origin}/${locale}/verify?token=${encodeURIComponent(token)}`,
      };
      const [html, text] = await Promise.all([
        renderAlertEmail(props),
        renderAlertEmailText(props),
      ]);
      const result = await send({
        to: email,
        subject: locale === "en" ? "Confirm your email" : "Επιβεβαιώστε το email σας",
        html,
        text,
      });
      if (result.ok) {
        await audit("auth.verification_resent", { userId: user.id });
      } else {
        console.error("resendVerificationAction: send failed:", result.error);
      }
    }
    return { ok: true };
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error("resendVerificationAction failed:", error);
    return { error: "serverError" };
  }
}

// ── Password reset ─────────────────────────────────────────────────────────
export async function requestResetAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const locale = normalizeLocale(formData.get("locale"));
    const email = String(formData.get("email") ?? "").toLowerCase();
    const ip = await requestIp();
    if (!(await rateLimit(`reset:${hashIp(ip)}`, 3, 3600))) return { error: "rateLimited" };
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = createToken(email, "reset", 60 * 60_000);
      const origin = await siteOrigin();
      const props = {
        locale,
        minutesValid: 60,
        resetUrl: `${origin}/${locale}/reset/${encodeURIComponent(token)}`,
      };
      const [html, text] = await Promise.all([
        renderResetEmail(props),
        renderResetEmailText(props),
      ]);
      await send({
        to: email,
        subject: locale === "en" ? "Password reset" : "Επαναφορά κωδικού πρόσβασης",
        html,
        text,
      });
      await audit("auth.reset_requested", { userId: user.id });
    }
    // Same response either way — no account enumeration.
    return { ok: true };
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error("requestResetAction failed:", error);
    return { error: "serverError" };
  }
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
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
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error("resetPasswordAction failed:", error);
    return { error: "serverError" };
  }
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
  try {
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
      if (isRedirect(error)) throw error;
      if (error instanceof AuthError) return { error: "invalid" };
      throw error;
    }
    return {};
  } catch (error) {
    // signIn()'s NEXT_REDIRECT must reach Next.js untouched.
    if (isRedirect(error)) throw error;
    console.error("signInAction failed:", error);
    return { error: "serverError" };
  }
}

export async function signOutAction(): Promise<void> {
  // signOut() throws its own NEXT_REDIRECT — never intercepted here.
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
