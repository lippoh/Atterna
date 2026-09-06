// src/types/next-auth.d.ts — session/JWT augmentation (fixes TS2339 on
// session.user.locale and the V1 authorize return shape)
import type { DefaultSession } from "next-auth";
declare module "next-auth" {
  interface User {
    locale?: string | null;
    isAdmin?: boolean;
    impersonatedBy?: string | null;
  }
  interface Session {
    locale?: string; // set via unstable_update() on language switch
    user: {
      id: string;
      locale: string;
      impersonatedBy?: string;
    } & DefaultSession["user"];
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    locale?: string;
    impersonatedBy?: string;
  }
}
declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    locale?: string;
    impersonatedBy?: string;
  }
}
