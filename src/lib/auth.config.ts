// src/lib/auth.config.ts — edge-safe config shared by middleware + auth.ts
// Contains no Node-only imports (no prisma/argon2) so middleware.ts can
// wrap it with NextAuth(authConfig) for the JWT session check.
import type { NextAuthConfig } from "next-auth";
export const authConfig = {
  pages: { signIn: "/login", verifyRequest: "/verify" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  providers: [], // real providers live in src/lib/auth.ts (Node-only deps)
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.uid = user.id as string;
        token.locale = (user.locale as string | null | undefined) ?? "el";
        if (user.impersonatedBy) token.impersonatedBy = user.impersonatedBy as string;
        else delete token.impersonatedBy;
      }
      if (trigger === "update" && session?.locale) {
        token.locale = session.locale; // language switch persists
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? "";
        session.user.locale = (token.locale as string) ?? "el";
        if (token.impersonatedBy) session.user.impersonatedBy = token.impersonatedBy as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
export default authConfig;