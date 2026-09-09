// src/lib/sources/provider.ts — the provider interface (spec §7)
// Only the methods a provider actually supports are implemented; the
// capability flags come from the registry and the UI reads them so it never
// pretends every source can reply or sync.
import type { ReviewSource, SourceCapability } from "./registry";

export interface ProviderSyncResult {
  /** Genuinely new rows at the source (idempotent syncs may return 0). */
  created: number;
  /** True when the provider was skipped (no connection, revoked…). */
  skipped: boolean;
}

/**
 * A customer-voice source integration. Google, a future Tripadvisor
 * connector and even the CSV importer all implement exactly this shape —
 * the intelligence engine consumes normalized Review rows and never knows
 * which provider produced them.
 */
export interface ReviewProvider {
  source: ReviewSource;
  capabilities: SourceCapability;
  /** Incremental, idempotent sync for a business (sync-capable only). */
  syncReviews?(businessId: string): Promise<ProviderSyncResult>;
  /** Publish an approved draft (reply-capable only). */
  replyToReview?(draftId: string): Promise<void>;
}

const providers = new Map<ReviewSource, ReviewProvider>();

export function registerProvider(provider: ReviewProvider): void {
  providers.set(provider.source, provider);
}

export function getProvider(source: ReviewSource): ReviewProvider | undefined {
  return providers.get(source);
}

export function registeredProviders(): ReviewProvider[] {
  return [...providers.values()];
}

/** Sources that can be scheduled for sync right now (Google today). */
export function syncCapableSources(): ReviewSource[] {
  return [...providers.values()]
    .filter((p) => typeof p.syncReviews === "function")
    .map((p) => p.source);
}
