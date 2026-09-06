// src/integrations/gbp/mapper.ts — GBP API review → internal row
// mapReview(r, conn) produces the create-shape V1's reviews.ts spread
// into the upsert: { externalId, rating, text, reviewerName,
// createdOnPlatform, language: null } — language is authoritative only
// after analysis (P1 detects it).
import type { GbpReview, GbpLocation } from "./client";
const STARS: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
};
export interface ReviewRow {
  externalId: string;
  rating: number;
  text: string | null;
  reviewerName: string | null;
  createdOnPlatform: Date | null;
  language: null;
}
export function mapReview(r: GbpReview, _conn: unknown): ReviewRow {
  const externalId = r.reviewId ?? r.name.split("/").pop() ?? "";
  const rating = typeof r.starRating === "number"
    ? r.starRating
    : STARS[String(r.starRating ?? "").toUpperCase()] ?? 3;
  return {
    externalId,
    rating,
    text: r.comment ?? null,
    reviewerName: r.reviewer?.displayName ?? null,
    createdOnPlatform: r.createTime ? new Date(r.createTime) : null,
    language: null,
  };
}
export interface LocationRow {
  locationId: string; // "locations/{id}"
  locationName: string;
  accountName: string;
}
export function mapLocation(l: GbpLocation): LocationRow {
  return {
    locationId: l.name,
    locationName: l.locationName,
    accountName: l.accountName ?? "",
  };
}