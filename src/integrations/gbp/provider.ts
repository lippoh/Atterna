// src/integrations/gbp/provider.ts — Google as ONE provider, not the
// foundation (spec §8). A thin adapter: the OAuth flow, token refresh,
// quota-aware paging and reply publishing stay sealed inside the GBP
// integration layer; the rest of the application only ever sees the
// generic ReviewProvider shape. Swapping in Tripadvisor later means
// adding a sibling file — zero core changes.
import type { ReviewProvider } from "@/lib/sources/provider";
import { SOURCES } from "@/lib/sources/registry";
import { syncBusinessReviews } from "./reviews";
import { publishReply } from "./reviews";

export const googleProvider: ReviewProvider = {
  source: "google",
  capabilities: SOURCES.google.capabilities,
  async syncReviews(businessId: string) {
    const result = await syncBusinessReviews(businessId);
    return { created: result.synced, skipped: Boolean(result.skipped) };
  },
  async replyToReview(draftId: string) {
    await publishReply(draftId);
  },
};
