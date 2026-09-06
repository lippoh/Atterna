// src/lib/env.ts — validated environment (server-only surface)
// V2: extended from the V1 snippet with the remaining Appendix 54
// variables (Stripe prices, Google OAuth, TOKEN_ENC_KEY, CRON_SECRET) so
// every other module can rely on one typed, validated source.
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
const parsedServer = serverSchema.safeParse(process.env);
if (!parsedServer.success) {
  console.error(
    "Invalid environment:\n" +
      parsedServer.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n")
  );
  throw new Error("Invalid environment variables");
}
const parsedPublic = publicSchema.safeParse(process.env);
if (!parsedPublic.success) {
  console.error(
    "Invalid public environment:\n" +
      parsedPublic.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n")
  );
  throw new Error("Invalid public environment variables");
}
/** Server-only env — never import from a client component. */
export const env = {
  ...parsedServer.data,
  NEXT_PUBLIC: parsedPublic.data,
} as const;