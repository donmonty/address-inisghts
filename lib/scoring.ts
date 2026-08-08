/**
 * The scoring seam.
 *
 * `scoreAddress` takes the twelve raw per-category Mapbox payloads exactly as
 * fetched and returns the complete insight model the scorecard renders. It is
 * pure and synchronous: everything mechanical — network, concurrency, retry,
 * cache, rate limiting — lives outside this file.
 *
 * The formulas and constants are settled and calibrated against four real
 * addresses; the working lives in `docs/research/scoring-calibration.md`. Don't
 * re-derive them here.
 */

/** The twelve locked category IDs, in tier order. Verbatim Mapbox strings. */
export const CATEGORY_IDS = [
  "grocery",
  "pharmacy",
  "public_transportation_station",
  "school",
  "restaurant",
  "cafe",
  "park",
  "bank",
  "bar",
  "fitness_center",
  "clothing_store",
  "library",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export type TierId = "essential" | "useful" | "amenity";

export type DensityBand = "Very dense" | "Dense" | "Moderate" | "Sparse";

/** Tier weights 3 / 2 / 1 over four categories each — max weighted score 24. */
const TIERS: { tier: TierId; weight: number; categories: CategoryId[] }[] = [
  {
    tier: "essential",
    weight: 3,
    categories: ["grocery", "pharmacy", "public_transportation_station", "school"],
  },
  { tier: "useful", weight: 2, categories: ["restaurant", "cafe", "park", "bank"] },
  {
    tier: "amenity",
    weight: 1,
    categories: ["bar", "fitness_center", "clothing_store", "library"],
  },
];

const MAX_WEIGHTED_SCORE = 24;
const WALK_RADIUS_M = 1000;
const DRIVE_RADIUS_M = 5000;
const DEPTH_TARGET = 150;

/**
 * The subset of a Search Box category feature this module reads. The whole
 * feature is carried through on each amenity so the drawer can render hours,
 * phone, and website without a second fetch.
 */
export interface MapboxFeature {
  type?: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    mapbox_id: string;
    name: string;
    /** Straight-line metres from the searched point. Absent means unknown. */
    distance?: number;
    [key: string]: unknown;
  };
}

/** The twelve raw category payloads, exactly as the endpoint returned them. */
export type RawByCategory = Record<CategoryId, MapboxFeature[]>;

export interface Amenity {
  /** The feature's `mapbox_id` — the dedupe key. */
  id: string;
  name: string;
  category: CategoryId;
  distanceMeters: number;
  coordinates: [number, number];
  /** The raw feature, for the drawer's zero-network read. */
  feature: MapboxFeature;
}

export interface CategoryCoverage {
  id: CategoryId;
  present: boolean;
  /** Metres to the nearest instance within the walking radius, or null. */
  nearestMeters: number | null;
}

export interface TierCoverage {
  tier: TierId;
  weight: number;
  categories: CategoryCoverage[];
}

export interface AddressInsight {
  /** 0–100 integers. */
  walk: number;
  drive: number;
  /** Coverage-to-coverage, never `drive − walk`. May be 0. */
  delta: number;
  densityIndex: number;
  densityBand: DensityBand;
  /** The one plain-English line. */
  verdict: string;
  tiers: TierCoverage[];
  /** Nearest-first, deduped by `mapbox_id`, radius-filtered. */
  amenities1km: Amenity[];
  amenities5km: Amenity[];
}

/**
 * How many of the twelve categories are present within the walking radius.
 *
 * The one derivation the scorecard shares with the verdict sentence, so both
 * read the same number off the same rule rather than each flattening `tiers`
 * for themselves.
 */
export function presentCategoryCount(tiers: TierCoverage[]): number {
  return tiers.flatMap((tier) => tier.categories).filter((c) => c.present)
    .length;
}

export function scoreAddress(rawByCategory: RawByCategory): AddressInsight {
  const amenities5km = collect(rawByCategory, DRIVE_RADIUS_M);
  const amenities1km = amenities5km.filter(
    (a) => a.distanceMeters <= WALK_RADIUS_M,
  );

  const nearestWalk = nearestWithin(rawByCategory, WALK_RADIUS_M);
  const nearestDrive = nearestWithin(rawByCategory, DRIVE_RADIUS_M);

  const tiers: TierCoverage[] = TIERS.map(({ tier, weight, categories }) => ({
    tier,
    weight,
    categories: categories.map((id) => {
      const nearestMeters = nearestWalk.get(id) ?? null;
      return { id, present: nearestMeters !== null, nearestMeters };
    }),
  }));

  const walkCoverage = coverage(nearestWalk);
  const driveCoverage = coverage(nearestDrive);
  const depth = Math.min(1, amenities1km.length / DEPTH_TARGET);

  const densityIndex = densityIndexOf(amenities1km.length);

  const walk = Math.round(70 * walkCoverage + 30 * depth);
  const drive = Math.round(100 * driveCoverage);
  const delta = Math.round(100 * (driveCoverage - walkCoverage));

  return {
    walk,
    drive,
    delta,
    densityIndex,
    densityBand: bandOf(densityIndex),
    verdict: verdictFor({
      tiers,
      densityIndex,
      delta,
      categoriesWithin5km: nearestDrive.size,
    }),
    tiers,
    amenities1km,
    amenities5km,
  };
}

/**
 * Every POI within `radius`, deduped by `mapbox_id` and sorted nearest-first.
 *
 * Dedupe is a measured no-op on the calibration fixtures — the category
 * endpoint returns each POI under the category queried — but it stays as one
 * line of insurance against a hierarchy change upstream. Features with no
 * `distance` are treated as outside every radius: an unplaceable POI can't be
 * bucketed honestly.
 */
function collect(rawByCategory: RawByCategory, radius: number): Amenity[] {
  const byId = new Map<string, Amenity>();

  for (const category of CATEGORY_IDS) {
    for (const feature of rawByCategory[category] ?? []) {
      const distanceMeters = feature.properties.distance;
      if (distanceMeters === undefined || distanceMeters > radius) continue;

      const id = feature.properties.mapbox_id;
      if (byId.has(id)) continue;

      byId.set(id, {
        id,
        name: feature.properties.name,
        category,
        distanceMeters,
        coordinates: feature.geometry.coordinates,
        feature,
      });
    }
  }

  return [...byId.values()].sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/** Nearest distance per category within `radius`; absent categories are omitted. */
function nearestWithin(
  rawByCategory: RawByCategory,
  radius: number,
): Map<CategoryId, number> {
  const nearest = new Map<CategoryId, number>();

  for (const category of CATEGORY_IDS) {
    for (const feature of rawByCategory[category] ?? []) {
      const distance = feature.properties.distance;
      if (distance === undefined || distance > radius) continue;

      const best = nearest.get(category);
      if (best === undefined || distance < best) nearest.set(category, distance);
    }
  }

  return nearest;
}

/** Σ tier weight of every present category, over 24. */
function coverage(present: Map<CategoryId, number>): number {
  const weighted = TIERS.reduce(
    (total, tier) =>
      total +
      tier.weight * tier.categories.filter((id) => present.has(id)).length,
    0,
  );

  return weighted / MAX_WEIGHTED_SCORE;
}

/**
 * Deduped POIs per km² within the walking radius, capped at 100.
 *
 * The density is rounded to one decimal before being rounded to an integer,
 * which is how the published values were derived (S Congress: 102 POIs →
 * 32.5/km² → 33). It only matters on the half-way case.
 */
function densityIndexOf(count1km: number): number {
  const areaKm2 = Math.PI * (WALK_RADIUS_M / 1000) ** 2;
  const perKm2 = Math.round((count1km / areaKm2) * 10) / 10;
  return Math.min(100, Math.round(perKm2));
}

function bandOf(densityIndex: number): DensityBand {
  if (densityIndex >= 60) return "Very dense";
  if (densityIndex >= 25) return "Dense";
  if (densityIndex >= 8) return "Moderate";
  return "Sparse";
}

const BAND_PROSE: Record<DensityBand, string> = {
  "Very dense": "very dense",
  Dense: "dense",
  Moderate: "moderately dense",
  Sparse: "sparse",
};

const CATEGORY_PROSE: Record<CategoryId, string> = {
  grocery: "a grocery",
  pharmacy: "a pharmacy",
  public_transportation_station: "public transport",
  school: "a school",
  restaurant: "a restaurant",
  cafe: "a café",
  park: "a park",
  bank: "a bank",
  bar: "a bar",
  fitness_center: "a gym",
  clothing_store: "a clothing store",
  library: "a library",
};

/**
 * One line: what's within a walk, how dense it is, and what a car adds. The
 * band's settlement-type translation happens here in prose rather than in the
 * label — see `docs/research/scoring-calibration.md`.
 */
function verdictFor({
  tiers,
  densityIndex,
  delta,
  categoriesWithin5km,
}: {
  tiers: TierCoverage[];
  densityIndex: number;
  delta: number;
  categoriesWithin5km: number;
}): string {
  const presentCount = presentCategoryCount(tiers);
  const missingEssentials = (
    tiers.find((tier) => tier.tier === "essential")?.categories ?? []
  )
    .filter((c) => !c.present)
    .map((c) => CATEGORY_PROSE[c.id]);

  let walkLine: string;
  if (presentCount === CATEGORY_IDS.length) {
    walkLine = "All twelve amenity categories are within a 1 km walk.";
  } else if (presentCount === 0) {
    walkLine = "No amenity category is within a 1 km walk.";
  } else {
    const tail = missingEssentials.length
      ? `, but ${joinWithAnd(missingEssentials)} ${missingEssentials.length === 1 ? "is" : "are"} not`
      : ", including every essential";
    walkLine = `${presentCount} of twelve amenity categories are within a 1 km walk${tail}.`;
  }

  const densityLine = `The area is ${BAND_PROSE[bandOf(densityIndex)]}, at ${densityIndex} amenities per km².`;

  const driveOnly = categoriesWithin5km - presentCount;
  const carLine =
    delta > 0
      ? `Driving 5 km adds ${driveOnly} more ${driveOnly === 1 ? "category" : "categories"} — worth +${delta} on the driving score.`
      : "A car reaches no category the walk doesn't already cover.";

  return `${walkLine} ${densityLine} ${carLine}`;
}

function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
