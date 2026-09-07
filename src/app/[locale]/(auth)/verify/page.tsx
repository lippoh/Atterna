// src/app/[locale]/(auth)/verify/page.tsx — email confirmation surface
// V2.1 fix: useSearchParams forces a client-side render bailout, and a
// statically prerendered page needs a Suspense boundary ABOVE the call —
// without one, `next build` fails with "missing-suspense-with-csr
// bailout". The page is now a thin shell; the form (which reads the
// token from the URL) renders inside <Suspense> as its own island.
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