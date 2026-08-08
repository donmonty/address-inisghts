/**
 * The seeded examples: the four addresses the scoring was calibrated against.
 *
 * They exist so a visitor with no address in mind can still see the scores
 * differentiate — and they differentiate by construction, because these are the
 * span the constants in `lib/scoring.ts` were fitted to. The band under each one
 * is its measured Amenity Density band from `docs/research/scoring-calibration.md`,
 * ordered densest first so the four read as a range rather than a list.
 *
 * The coordinates are the ones `docs/research/calibration.json` recorded, so an
 * example lands on exactly the point the calibration table describes. They are
 * hard-coded rather than searched: an example must never spend a Search Box
 * session, and must never depend on `/suggest` still ranking the same result
 * first months from now.
 */

import type { ResolvedAddress } from "@/lib/search";

export interface ExampleAddress extends ResolvedAddress {
  /** The place, as a person would name it. */
  name: string;
  /** Its measured density band — the reason it is one of the four. */
  band: string;
}

export const EXAMPLE_ADDRESSES: readonly ExampleAddress[] = [
  {
    name: "Herald Square, New York",
    band: "Very dense",
    lat: 40.748745,
    lng: -73.987997,
    label: "1270 Broadway, New York, New York 10001, United States",
  },
  {
    name: "South Congress, Austin",
    band: "Dense",
    lat: 30.252212,
    lng: -97.749071,
    label: "1200 South Congress Avenue, Austin, Texas 78704, United States",
  },
  {
    name: "Downtown Marfa, Texas",
    band: "Moderate",
    lat: 30.31454,
    lng: -104.02297,
    label: "105 West Murphy Street, Marfa, Texas 79843, United States",
  },
  {
    name: "Legacy Drive, Plano",
    band: "Sparse",
    lat: 33.069539,
    lng: -96.797614,
    label: "5000 Legacy Drive, Plano, Texas 75024, United States",
  },
];
