// src/app/[locale]/(app)/feedback/actions.ts — QR token server action
// (Stage G): mints the token, then redirects to ?created=<token> so the
// page renders the success card with the new QR. The redirect throws
// NEXT_REDIRECT by design — it MUST live outside the try/catch, or the
// catch swallows it and the user sees "server error" instead of the
// success state. Only real failures return { error }.
"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { QrGenerateState } from "@/components/feedback/qr-generate-button";

export async function generateQrToken(
  _prev: QrGenerateState,
  formData: FormData
): Promise<QrGenerateState> {
  const rawLocale = String(formData.get("locale") ?? "el").toLowerCase();
  const locale = rawLocale === "en" ? "en" : "el";

  let token: string | null = null;
  try {
    const { orgId: currentOrg } = await requireOrg();
    const business = await prisma.business.findFirst({
      where: { organizationId: currentOrg, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (!business) return { error: "noBusiness" };
    token = randomBytes(24).toString("base64url");
    await prisma.feedbackRequest.create({
      data: { businessId: business.id, token },
    });
    await audit("feedback.token_created", {
      organizationId: currentOrg,
      entity: "business",
      entityId: business.id,
    });
    revalidatePath("/feedback");
  } catch {
    return { error: "server" };
  }
  // Outside try: redirect() throws NEXT_REDIRECT to navigate.
  redirect(`/${locale}/feedback?created=${token}`);
}
