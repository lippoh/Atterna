// src/app/[locale]/(auth)/verify/page.tsx — email confirmation surface
// Thin shell; the form (which reads the token from the URL) renders
// inside <Suspense> as its own island (V2.1 split — useSearchParams
// requires a suspense boundary above it for static prerendering).
"use client";

import { Suspense } from "react";
import { VerifyForm } from "./verify-form";

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}
