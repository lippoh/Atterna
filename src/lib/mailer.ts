// src/lib/mailer.ts — Resend wrapper (the single email boundary)
//
// send() never throws: it returns { ok, error, id } so callers decide
// whether a failed email should fail their flow. Callers that send
// ESSENTIAL email (job-queued alerts) MUST check result.ok and throw,
// so the job runner's backoff/DEAD machinery retries the delivery —
// a swallowed { ok: false } is a silently lost email.
//
// Step 7 (email deliverability):
//   - every send may carry a plain-text alternative (`text`) — spam
//     scoring and accessibility both want it;
//   - the provider message id is logged on success ([mailer] delivered)
//     so deliverability incidents are traceable to a Resend message;
//   - the dead in-memory BOUNCED stub is removed — suppression is
//     monitored in the Resend Dashboard; a persistent suppression list
//     belongs to a future email.bounced webhook, not per-process state.
//   - listUnsubscribe adds the RFC 2369 header the weekly report needs
//     (one-click unsubscribe).
import { Resend } from "resend";
import { env } from "@/lib/env";

// V2.2: lazy client — module-scope `new Resend(env.RESEND_API_KEY)` fails
// build-time route module evaluation without runtime secrets.
let _resend: Resend | null = null;

function resendClient(): Resend {
  if (!_resend) _resend = new Resend(env.RESEND_API_KEY);
  return _resend;
}

export interface SendInput {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative — pass it whenever the template can render one. */
  text?: string;
  listUnsubscribe?: boolean;
  replyTo?: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/** Bare address from EMAIL_FROM — "Atterna <no-reply@d>" → "no-reply@d". */
export function senderAddress(): string {
  const raw = env.EMAIL_FROM as string;
  const angled = raw.match(/<([^<>]+)>/);
  return (angled ? angled[1] : raw).trim();
}

export async function send(input: SendInput): Promise<SendResult> {
  try {
    const headers: Record<string, string> = {};
    if (input.listUnsubscribe) {
      headers["List-Unsubscribe"] = `<mailto:${senderAddress()}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    if (input.replyTo) headers["Reply-To"] = input.replyTo;

    const payload: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      headers: Record<string, string>;
      text?: string;
    } = {
      from: env.EMAIL_FROM,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      headers,
    };
    if (input.text) payload.text = input.text;

    const { data, error } = await resendClient().emails.send(payload);
    if (error) {
      // Provider-side failure (4xx/5xx). The SDK error object carries the
      // message/name only — never the API key. The contract above decides
      // whether the caller retries.
      console.error("resend error", error);
      return { ok: false, error: error.message };
    }
    if (data?.id) console.log("[mailer] delivered", { id: data.id });
    return { ok: true, id: data?.id };
  } catch (error) {
    // Network/SDK exceptions (not provider rejections): still never throw.
    return { ok: false, error: String(error) };
  }
}
