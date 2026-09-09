// src/lib/env.ts — validated environment (server-only surface)
// One typed, validated source for every other module.
//
// V2.3: validation is LAZY and PER-KEY. Next's production build evaluates
// route modules while collecting route configuration; any module-scope
// validation fails the build on machines without runtime secrets (Vercel,
// CI). The proxy below validates a variable only when that exact variable
// is first read at runtime — so a partially configured deployment (e.g.
// only DATABASE_URL + AUTH_SECRET + TOKEN_ENC_KEY set) still boots, and
// only the features that read a missing variable report it, with an
// actionable message naming the variable. Importing this module is always
// side-effect free.
import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url(),
  APP_URL: z.string().url(),

  OPENAI_API_KEY: z.string().min(20),
  AI_MODEL_CHEAP: z.string().default("gpt-4o-mini"),
  AI_MODEL_MAIN: z.string().default("gpt-4o"),
  AI_MONTHLY_TOKEN_BUDGET: z.coerce.number().int().positive().default(250_000),

  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PRICE_STARTER: z.string().startsWith("price_"),
  STRIPE_PRICE_GROWTH: z.string().startsWith("price_"),
  STRIPE_PRICE_PRO: z.string().startsWith("price_"),

  RESEND_API_KEY: z.string().min(20),
  // Step 7: the single sender for every Atterna email. Accepts
  // "Display Name <local@domain>" or a bare "local@domain" — the domain
  // must be added and verified in Resend before production sending.
  EMAIL_FROM: z
    .string()
    .min(3)
    .regex(
      /^(?:[^\n<>@]+ <)?[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}>?$/,
      'EMAIL_FROM must be "Display Name <local@domain>" or "local@domain" (verified Resend domain)'
    ),

  GOOGLE_CLIENT_ID: z.string().min(10),
  GOOGLE_CLIENT_SECRET: z.string().min(10),

  TOKEN_ENC_KEY: z.string().min(20), // base64 32 bytes
  CRON_SECRET: z.string().min(12),

  SENTRY_DSN: z.string().optional(),
});

const publicSchema = z.object({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(10).optional(),
});

type ServerEnv = z.infer<typeof serverSchema>;
type PublicEnv = z.infer<typeof publicSchema>;
export type Env = ServerEnv & { NEXT_PUBLIC: PublicEnv };

// Minimal structural type for a per-key validator — version-agnostic
// (works on zod 3 and 4): all we need is safeParse and the first issue.
interface KeyValidator {
  safeParse(
    data: unknown
  ): { success: true; data: unknown } | { success: false; error: { issues: { message: string }[] } };
}

const shape = serverSchema.shape as unknown as Record<string, KeyValidator>;

// Per-key result cache — a variable is parsed at most once per process.
const keyCache = new Map<string, unknown>();

function loadKey(key: string): unknown {
  if (keyCache.has(key)) return keyCache.get(key);
  const validator = shape[key];
  if (!validator) return undefined;
  const raw = (process.env as Record<string, string | undefined>)[key];
  const parsed = validator.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    console.error(
      `Invalid environment: ${key}: ${issue?.message ?? "invalid"} ` +
        `(current value: ${raw === undefined ? "not set" : "set"})`
    );
    throw new Error(
      `Missing or invalid environment variable: ${key}. ` +
        `Set it in your deployment environment (e.g. Vercel → Settings → Environment Variables).`
    );
  }
  keyCache.set(key, parsed.data);
  return parsed.data;
}

function loadPublicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse(process.env);
  return parsed.success ? parsed.data : ({} as PublicEnv);
}

/** Server-only env — never import from a client component. */
export const env: Env = new Proxy({} as Env, {
  get(_target: Env, prop: string | symbol) {
    if (prop === "NEXT_PUBLIC") return loadPublicEnv();
    if (typeof prop !== "string" || !(prop in shape)) return undefined;
    return loadKey(prop);
  },
});
