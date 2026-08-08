import type { CategoryId, TierId } from "@/lib/scoring";

/**
 * The scorecard's display vocabulary.
 *
 * Separate from `scoring.ts`'s `CATEGORY_PROSE`, which exists to be read inside
 * a sentence ("a grocery", "public transport"). These are standalone column
 * labels, and they are short because the coverage cards put them in a
 * three-across grid that collapses at 900px.
 */
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  grocery: "Grocery",
  pharmacy: "Pharmacy",
  public_transportation_station: "Transit",
  school: "School",
  restaurant: "Restaurant",
  cafe: "Café",
  park: "Park",
  bank: "Bank",
  bar: "Bar",
  fitness_center: "Fitness",
  clothing_store: "Clothing",
  library: "Library",
};

export const TIER_LABELS: Record<TierId, string> = {
  essential: "Essential",
  useful: "Useful",
  amenity: "Amenity",
};

/**
 * Metres under a kilometre, kilometres to one decimal above it. Distances are
 * set in mono throughout, so they must not vary in precision within a column —
 * hence the round, which also absorbs a float if Mapbox ever sends one.
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}
