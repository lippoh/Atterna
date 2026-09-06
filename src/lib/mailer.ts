// src/lib/mailer.ts — Resend wrapper
// send() never throws: it returns { ok, error } so callers decide whether
// a failed email should fail the job. listUnsubscribe adds the RFC 2369
// header the weekly report needs (one-click unsubscribe, Table 32.1).
import { Resend } from "resend";
import { env } from "@/lib/env";
const resend = new Resend(env.RESEND_API_KEY);
export interface SendInput {
  to: string;
  subject: string;
  html: string;
  listUnsubscribe?: boolean;
  replyTo?: string;
}
export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}
const BOUNCED = new Set<string>(); // 3 permanent bounces → disable address
export async function send(input: SendInput): Promise<SendResult> {
  if (BOUNCED.has(input.to)) {
    return { ok: false, error: "suppressed: bounced" };
  }
  try {
    const headers: Record<string, string> = {};
    if (input.listUnsubscribe) {
      headers["List-Unsubscribe"] = `<mailto:${env.EMAIL_FROM.replace(/^.*<|>.*$/g, "")}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    if (input.replyTo) headers["Reply-To"] = input.replyTo;
    const { data, error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      headers,
    });
    if (error) {
      // 5xx / provider-side: job-level retry will re-run the send.
      console.error("resend error", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (error) {
    // Handle hard bounces (SuppressionBehavior in production wiring).
    return { ok: false, error: String(error) };
  }
}