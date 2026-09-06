// src/lib/auth.ts — Auth.js v5 configuration
// V2 fixes vs the V1 listing: (1) locale now travels through the jwt
// callback into the session (V1 read token.locale but never set it);
// (2) the unused verifyToken import is gone — verify/reset actions in
// (auth)/actions.ts use it instead; (3) an "impersonation" provider backs
// signIn("impersonation", { sessionId }) from src/lib/impersonate.ts.
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authConfig } from "@/lib/auth.config";
const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128),
});
export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentials.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        // constant-ish time: always run a hash comparison
        const hash =
          user?.passwordHash ?? "$argon2id$v=19$m=65536,t=3,p=4$decoy$decoy";
        const ok = await argon2.verify(hash, parsed.data.password);
        if (!user || !ok || !user.emailVerified) return null;
        await audit("auth.login", { userId: user.id, request });
        return {
          id: user.id,
          email: user.email,
          locale: user.locale,
          isAdmin: user.isAdmin,
        };
      },
    }),
    Credentials({
      id: "impersonation",
      credentials: { sessionId: {} },
      async authorize(raw) {
        const parsed = z.object({ sessionId: z.string().min(10) }).safeParse(raw);
        if (!parsed.success) return null;
        const session = await prisma.impersonationSession.findUnique({
          where: { id: parsed.data.sessionId },
        });
        if (!session || session.endedAt || session.expiresAt < new Date()) {
          return null;
        }
        const target = await prisma.user.findUnique({
          where: { id: session.targetUserId },
        });
        if (!target) return null;
        await audit("admin.impersonation.session", {
          userId: session.adminId,
          targetUserId: target.id,
          sessionId: session.id,
        });
        return {
          id: target.id,
          email: target.email,
          locale: target.locale,
          impersonatedBy: session.adminId,
        };
      },
    }),
  ],
});