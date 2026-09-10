// src/app/[locale]/(app)/feedback/actions.ts — QR token server action
// (Stage B): extracted from the page so the client pending-state island
// can call it. Returns state instead of void; revalidates the page so the
// new QR card appears on completion.
"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { QrGenerateState } from "@/components/feedback/qr-generate-button";

export async function generateQrToken(): Promise<QrGenerateState> {
  try {
    const { orgId: currentOrg } = await requireOrg();
    const business = await prisma.business.findFirst({
      where: { organizationId: currentOrg, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (!business) return { error: "noBusiness" };
    const token = randomBytes(24).toString("base64url");
    await prisma.feedbackRequest.create({
      data: { businessId: business.id, token },
    });
    await audit("feedback.token_created", {
      organizationId: currentOrg,
      entity: "business",
      entityId: business.id,
    });
    revalidatePath("/feedback");
    return { ok: true };
  } catch {
    return { error: "server" };
  }
}
