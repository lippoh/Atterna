// src/lib/env.ts — validated environment (server-only surface)
// One typed, validated source for every other module.
//
// V2.2: validation is LAZY. Next's production build evaluates route modules
// while collecting route configuration; a module-scope safeParse + throw
// fails the build on machines without runtime secrets (Vercel, CI). The
// proxy below validates exactly once — on the first property access, i.e.
// at actual runtime use — then caches the parsed result. Importing this
// module is always side-effect free.
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
  EMAIL_FROM: z.string().min(3),

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

let cached: ServerEnv | null = null;

function loadServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      "Invalid environment:\n" +
        parsed.error.issues
          .map((i) => `  ${i.path.join(".")}: ${i.message}`)
          .join("\n")
    );
    throw new Error("Invalid environment variables");
  }
  cached = parsed.data;
  return cached;
}

function loadPublicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse(process.env);
  return parsed.success ? parsed.data : ({} as PublicEnv);
}

/** Server-only env — never import from a client component. */
export const env: Env = new Proxy({} as Env, {
  get(_target: Env, prop: string | symbol) {
    if (prop === "NEXT_PUBLIC") return loadPublicEnv();
    return Reflect.get(loadServerEnv() as object, prop);
  },
});