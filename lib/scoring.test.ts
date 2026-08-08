import { describe, expect, it } from "vitest";

import {
  CATEGORY_IDS,
  scoreAddress,
  type AddressInsight,
  type CategoryId,
  type MapboxFeature,
} from "@/lib/scoring";

import heraldSquare from "@/lib/__fixtures__/herald-square.json";
import sCongress from "@/lib/__fixtures__/s-congress.json";
import marfa from "@/lib/__fixtures__/marfa.json";
import plano from "@/lib/__fixtures__/plano.json";

/**
 * The fixtures are the raw category-endpoint payloads, captured live from the
 * four calibration addresses by `docs/research/capture-fixtures.py`. Every
 * expectation below is a fact about those payloads, not about a mock.
 */
type Fixture = {
  query: string;
  resolved: string;
  byCategory: Record<string, unknown[]>;
};

const raw = (fixture: unknown) =>
  (fixture as Fixture).byCategory as unknown as Record<
    CategoryId,
    MapboxFeature[]
  >;

const FIXTURES = {
  heraldSquare: raw(heraldSquare),
  sCongress: raw(sCongress),
  marfa: raw(marfa),
  plano: raw(plano),
};

const insights = {
  heraldSquare: scoreAddress(FIXTURES.heraldSquare),
  sCongress: scoreAddress(FIXTURES.sCongress),
  marfa: scoreAddress(FIXTURES.marfa),
  plano: scoreAddress(FIXTURES.plano),
};

const categoryOf = (insight: AddressInsight, id: CategoryId) =>
  insight.tiers.flatMap((tier) => tier.categories).find((c) => c.id === id)!;

describe("the four calibration addresses", () => {
  it.each([
    ["heraldSquare", 100, 100, 0, 90, "Very dense"],
    ["sCongress", 73, 100, 25, 33, "Dense"],
    ["marfa", 60, 75, 0, 12, "Moderate"],
    ["plano", 36, 88, 42, 6, "Sparse"],
  ] as const)(
    "%s scores %i/%i/%i/%i %s",
    (name, walk, drive, delta, densityIndex, densityBand) => {
      expect(insights[name]).toMatchObject({
        walk,
        drive,
        delta,
        densityIndex,
        densityBand,
      });
    },
  );
});

describe("the walking score's working", () => {
  it("decomposes Plano into five present categories weighted 11/24", () => {
    const present = insights.plano.tiers.flatMap((tier) =>
      tier.categories.filter((c) => c.present).map((c) => c.id),
    );

    expect(present).toEqual([
      "pharmacy",
      "school",
      "restaurant",
      "bank",
      "fitness_center",
    ]);

    const weighted = insights.plano.tiers.reduce(
      (total, tier) =>
        total + tier.weight * tier.categories.filter((c) => c.present).length,
      0,
    );
    expect(weighted).toBe(11);

    // 70 × 11/24 = 32.08, plus depth 30 × min(1, 18/150) = 3.6 → 36
    expect(insights.plano.amenities1km).toHaveLength(18);
    expect(insights.plano.walk).toBe(36);
  });

  it("saturates the depth term at 30 rather than exceeding it", () => {
    // Herald Square has 282 POIs within 1 km against a target of 150, and full
    // coverage. Without the cap the walking score would exceed 100.
    expect(insights.heraldSquare.amenities1km.length).toBeGreaterThan(150);
    expect(insights.heraldSquare.walk).toBe(100);
  });

  it("reports a nearest distance for every present category and none for absent ones", () => {
    for (const insight of Object.values(insights)) {
      for (const tier of insight.tiers) {
        for (const category of tier.categories) {
          if (category.present) {
            expect(category.nearestMeters).toBeGreaterThan(0);
            expect(category.nearestMeters).toBeLessThanOrEqual(1000);
          } else {
            expect(category.nearestMeters).toBeNull();
          }
        }
      }
    }
  });

  it("weights the three tiers 3 / 2 / 1 over four categories each", () => {
    expect(insights.marfa.tiers.map((t) => [t.tier, t.weight])).toEqual([
      ["essential", 3],
      ["useful", 2],
      ["amenity", 1],
    ]);
    for (const tier of insights.marfa.tiers) {
      expect(tier.categories).toHaveLength(4);
    }
    expect(insights.marfa.tiers.flatMap((t) => t.categories.map((c) => c.id))).toEqual(
      CATEGORY_IDS,
    );
  });
});

describe("radius filtering", () => {
  it("discards features beyond the requested radius", () => {
    // Marfa's category responses reach absurd distances: a transit station at
    // 168 km and a park at 237 km. Neither may count at 1 km or at 5 km.
    const transit = categoryOf(insights.marfa, "public_transportation_station");
    expect(transit.present).toBe(false);
    expect(insights.marfa.drive).toBe(75); // 18/24, transit excluded

    const furthest = Math.max(
      ...insights.marfa.amenities5km.map((a) => a.distanceMeters),
    );
    expect(furthest).toBeLessThanOrEqual(5000);
  });

  it("keeps the 1 km list a subset of the 5 km list", () => {
    for (const insight of Object.values(insights)) {
      const ids5km = new Set(insight.amenities5km.map((a) => a.id));
      for (const amenity of insight.amenities1km) {
        expect(amenity.distanceMeters).toBeLessThanOrEqual(1000);
        expect(ids5km.has(amenity.id)).toBe(true);
      }
    }
  });

  it("buckets Marfa into 37 within 1 km and 41 within 5 km", () => {
    expect(insights.marfa.amenities1km).toHaveLength(37);
    expect(insights.marfa.amenities5km).toHaveLength(41);
  });

  it("sorts both buckets nearest-first", () => {
    for (const insight of Object.values(insights)) {
      for (const list of [insight.amenities1km, insight.amenities5km]) {
        const distances = list.map((a) => a.distanceMeters);
        expect(distances).toEqual([...distances].sort((a, b) => a - b));
      }
    }
  });
});

describe("empty and missing category responses", () => {
  it("scores an empty response as absent rather than throwing", () => {
    expect(FIXTURES.marfa.school).toEqual([]);
    expect(categoryOf(insights.marfa, "school")).toEqual({
      id: "school",
      present: false,
      nearestMeters: null,
    });
  });

  it("treats a missing category key the same as an empty response", () => {
    const withoutSchool = { ...FIXTURES.plano };
    delete (withoutSchool as Partial<Record<CategoryId, MapboxFeature[]>>)
      .school;

    const insight = scoreAddress(
      withoutSchool as Record<CategoryId, MapboxFeature[]>,
    );

    expect(categoryOf(insight, "school").present).toBe(false);
    expect(insight.walk).toBeLessThan(insights.plano.walk);
  });
});

describe("dedupe by mapbox_id", () => {
  it("is a no-op on all four fixtures", () => {
    // The map recorded dedupe as load-bearing; measurement showed zero overlap.
    // Asserted so a future change that breaks the claim is visible.
    for (const [name, fixture] of Object.entries(FIXTURES)) {
      const insight = insights[name as keyof typeof insights];
      const rawWithin = (radius: number) =>
        CATEGORY_IDS.flatMap((id) => fixture[id] ?? []).filter(
          (f) => (f.properties.distance ?? Infinity) <= radius,
        ).length;

      expect(rawWithin(1000)).toBe(insight.amenities1km.length);
      expect(rawWithin(5000)).toBe(insight.amenities5km.length);
    }
  });

  it("collapses a POI that arrives under two categories", () => {
    const duplicate = structuredClone(FIXTURES.plano) as Record<
      CategoryId,
      MapboxFeature[]
    >;
    const nearestBank = duplicate.bank[0];
    duplicate.cafe = [nearestBank, ...duplicate.cafe];

    const insight = scoreAddress(duplicate);

    expect(insight.amenities1km).toHaveLength(
      insights.plano.amenities1km.length,
    );
    // Presence still follows the category it was returned under.
    expect(categoryOf(insight, "cafe").present).toBe(true);
  });
});

describe("the delta", () => {
  it("is coverage-to-coverage, not drive minus walk", () => {
    // Subtracting the displayed scores would give Marfa +15, an artifact of its
    // walking depth penalty rather than anything a car reaches.
    expect(insights.marfa.drive - insights.marfa.walk).toBe(15);
    expect(insights.marfa.delta).toBe(0);
  });
});

describe("density bands", () => {
  it.each([
    [100, "Very dense"],
    [60, "Very dense"],
    [59, "Dense"],
    [25, "Dense"],
    [24, "Moderate"],
    [8, "Moderate"],
    [7, "Sparse"],
    [0, "Sparse"],
  ])("bands %i as %s", (index, band) => {
    const feature = (id: string, distance: number): MapboxFeature => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: { mapbox_id: id, name: id, distance },
    });

    // π km² inside 1 km, so `count` POIs give an index of round(count / π).
    const count = Math.round(index * Math.PI);
    const byCategory = Object.fromEntries(
      CATEGORY_IDS.map((id) => [id, [] as MapboxFeature[]]),
    ) as Record<CategoryId, MapboxFeature[]>;
    byCategory.restaurant = Array.from({ length: count }, (_, i) =>
      feature(`poi-${i}`, 100),
    );

    expect(scoreAddress(byCategory).densityBand).toBe(band);
  });

  it("caps the index at 100", () => {
    const byCategory = Object.fromEntries(
      CATEGORY_IDS.map((id) => [id, [] as MapboxFeature[]]),
    ) as Record<CategoryId, MapboxFeature[]>;
    byCategory.restaurant = Array.from({ length: 1000 }, (_, i) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [0, 0] as [number, number] },
      properties: { mapbox_id: `poi-${i}`, name: "x", distance: 100 },
    }));

    expect(scoreAddress(byCategory).densityIndex).toBe(100);
  });
});

describe("the verdict", () => {
  it.each([
    [
      "heraldSquare",
      "All twelve amenity categories are within a 1 km walk. The area is very dense, at 90 amenities per km². A car reaches no category the walk doesn't already cover.",
    ],
    [
      "sCongress",
      "10 of twelve amenity categories are within a 1 km walk, but a pharmacy and public transport are not. The area is dense, at 33 amenities per km². Driving 5 km adds 2 more categories — worth +25 on the driving score.",
    ],
    [
      "marfa",
      "10 of twelve amenity categories are within a 1 km walk, but public transport and a school are not. The area is moderately dense, at 12 amenities per km². A car reaches no category the walk doesn't already cover.",
    ],
    [
      "plano",
      "5 of twelve amenity categories are within a 1 km walk, but a grocery and public transport are not. The area is sparse, at 6 amenities per km². Driving 5 km adds 6 more categories — worth +42 on the driving score.",
    ],
  ] as const)("reads for %s", (name, verdict) => {
    expect(insights[name].verdict).toBe(verdict);
  });

  it("owns an address with nothing within a walk", () => {
    const byCategory = Object.fromEntries(
      CATEGORY_IDS.map((id) => [id, [] as MapboxFeature[]]),
    ) as Record<CategoryId, MapboxFeature[]>;

    const insight = scoreAddress(byCategory);

    expect(insight).toMatchObject({
      walk: 0,
      drive: 0,
      delta: 0,
      densityIndex: 0,
      densityBand: "Sparse",
      amenities1km: [],
      amenities5km: [],
    });
    expect(insight.verdict).toBe(
      "No amenity category is within a 1 km walk. The area is sparse, at 0 amenities per km². A car reaches no category the walk doesn't already cover.",
    );
  });
});

describe("the amenities", () => {
  it("carries what the list and the drawer need", () => {
    const nearest = insights.heraldSquare.amenities1km[0];

    expect(nearest).toMatchObject({
      id: expect.stringContaining("dXJu"), // Mapbox IDs are base64-ish URNs
      name: expect.any(String),
      category: "clothing_store",
      distanceMeters: 5,
    });
    expect(nearest.coordinates).toHaveLength(2);
    expect(nearest.feature.properties.mapbox_id).toBe(nearest.id);
  });

  it("counts 282 within 1 km and 300 within 5 km at Herald Square", () => {
    expect(insights.heraldSquare.amenities1km).toHaveLength(282);
    expect(insights.heraldSquare.amenities5km).toHaveLength(300);
  });
});
