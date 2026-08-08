import { describe, expect, it } from "vitest";

import { selectNearby } from "@/lib/nearby";
import type { Amenity, CategoryId, MapboxFeature } from "@/lib/scoring";

/*
 * The "What's nearby" view state. The component that renders it holds two
 * pieces of state — radius and filter — and nothing else; every rule about
 * which rows, which chips, which expander and which line of copy lives here,
 * which is what keeps it testable under the spec's "no component tests"
 * boundary.
 */

const amenity = (
  id: string,
  category: CategoryId,
  distanceMeters: number,
): Amenity => ({
  id,
  name: id,
  category,
  distanceMeters,
  coordinates: [0, 0],
  feature: {
    geometry: { type: "Point", coordinates: [0, 0] },
    properties: { mapbox_id: id, name: id, distance: distanceMeters },
  } satisfies MapboxFeature,
});

/** `count` amenities of one category, 10 m apart, starting at `from`. */
const series = (category: CategoryId, count: number, from = 10): Amenity[] =>
  Array.from({ length: count }, (_, i) =>
    amenity(`${category}-${i}`, category, from + i * 10),
  );

const nearestFirst = (amenities: Amenity[]): Amenity[] =>
  [...amenities].sort((a, b) => a.distanceMeters - b.distanceMeters);

/**
 * The shape `selectNearby` reads off the insight — the two radius buckets.
 * `scoreAddress` returns both nearest-first, so the fixture sorts too rather
 * than letting the selector be tested against data it will never be given.
 */
const insightOf = (amenities1km: Amenity[], extra5km: Amenity[] = []) => ({
  amenities1km: nearestFirst(amenities1km),
  amenities5km: nearestFirst([...amenities1km, ...extra5km]),
});

describe("the radius", () => {
  it("lists the 1 km set nearest-first by default", () => {
    const insight = insightOf(
      [amenity("far", "cafe", 900), amenity("near", "grocery", 100)],
      [amenity("driving", "park", 4000)],
    );

    const view = selectNearby({ insight, radius: "1km", filter: "all" });

    expect(view.amenities.map((a) => a.id)).toEqual(["near", "far"]);
  });

  it("lists the 5 km set when expanded, with no extra request to make", () => {
    const insight = insightOf(
      [amenity("near", "grocery", 100)],
      [amenity("driving", "park", 4000)],
    );

    const view = selectNearby({ insight, radius: "5km", filter: "all" });

    expect(view.amenities.map((a) => a.id)).toEqual(["near", "driving"]);
  });
});

describe("the filter chips", () => {
  it("offers one chip per category present in the current radius", () => {
    const insight = insightOf([
      amenity("a", "cafe", 100),
      amenity("b", "grocery", 200),
      amenity("c", "cafe", 300),
    ]);

    const view = selectNearby({ insight, radius: "1km", filter: "all" });

    expect(view.chips).toEqual(["grocery", "cafe"]);
  });

  it("recomputes the chips when the radius toggles", () => {
    const insight = insightOf(
      [amenity("a", "cafe", 100)],
      [amenity("b", "library", 4000)],
    );

    expect(selectNearby({ insight, radius: "1km", filter: "all" }).chips).toEqual([
      "cafe",
    ]);
    expect(selectNearby({ insight, radius: "5km", filter: "all" }).chips).toEqual([
      "cafe",
      "library",
    ]);
  });

  it("never offers a chip that would yield nothing", () => {
    const insight = insightOf([amenity("a", "cafe", 100)]);

    const view = selectNearby({ insight, radius: "1km", filter: "all" });

    expect(view.chips).not.toContain("bank");
    for (const chip of view.chips) {
      expect(
        selectNearby({ insight, radius: "1km", filter: chip }).amenities,
      ).not.toHaveLength(0);
    }
  });

  it("falls back to All when the filtered category is absent from the radius", () => {
    // Not reachable through the chips alone — the expander is hidden while
    // filtered — but the invariant holds regardless: no empty list under a
    // chip the row isn't showing.
    const insight = insightOf(
      [amenity("a", "cafe", 100)],
      [amenity("b", "library", 4000)],
    );

    const view = selectNearby({ insight, radius: "1km", filter: "library" });

    expect(view.filter).toBe("all");
    expect(view.amenities.map((a) => a.id)).toEqual(["a"]);
  });
});

describe("the 24-cap", () => {
  it("caps the default All view at the nearest 24 within 1 km", () => {
    const view = selectNearby({
      insight: insightOf(series("restaurant", 40)),
      radius: "1km",
      filter: "all",
    });

    expect(view.amenities).toHaveLength(24);
    expect(view.amenities.at(-1)?.distanceMeters).toBe(240);
  });

  it("does not cap the 5 km All view — Show all means all", () => {
    const view = selectNearby({
      insight: insightOf(series("restaurant", 40)),
      radius: "5km",
      filter: "all",
    });

    expect(view.amenities).toHaveLength(40);
  });

  it("does not cap a filtered view — filtering means show me all of these", () => {
    const view = selectNearby({
      insight: insightOf([...series("restaurant", 25), amenity("c", "cafe", 5)]),
      radius: "1km",
      filter: "restaurant",
    });

    expect(view.amenities).toHaveLength(25);
    expect(view.amenities.every((a) => a.category === "restaurant")).toBe(true);
  });
});

describe("the expander", () => {
  it("offers the 5 km set by its full count", () => {
    const insight = insightOf(series("cafe", 30), series("park", 12, 2000));

    const view = selectNearby({ insight, radius: "1km", filter: "all" });

    expect(view.expander).toEqual({ label: "Show all 42 nearby", radius: "5km" });
  });

  it("offers the way back once expanded", () => {
    const insight = insightOf(series("cafe", 30), series("park", 12, 2000));

    const view = selectNearby({ insight, radius: "5km", filter: "all" });

    expect(view.expander).toEqual({ label: "Back to 1 km", radius: "1km" });
  });

  it("stays live when nothing is within 1 km", () => {
    const insight = insightOf([], series("park", 3, 2000));

    const view = selectNearby({ insight, radius: "1km", filter: "all" });

    expect(view.expander).toEqual({ label: "Show all 3 nearby", radius: "5km" });
  });

  it("drops the expander when 5 km adds nothing to walk to", () => {
    const insight = insightOf(series("cafe", 5));

    const view = selectNearby({ insight, radius: "1km", filter: "all" });

    expect(view.expander).toBeNull();
  });

  it("drops the expander in a filtered view", () => {
    const insight = insightOf(series("cafe", 5), series("park", 12, 2000));

    const view = selectNearby({ insight, radius: "1km", filter: "cafe" });

    expect(view.expander).toBeNull();
  });
});

describe("the sparse copy", () => {
  it("owns an empty 1 km radius rather than widening it", () => {
    const view = selectNearby({
      insight: insightOf([], series("park", 3, 2000)),
      radius: "1km",
      filter: "all",
    });

    expect(view.note).toBe(
      "No amenities within 1 km. Expand to 5 km to see what's around.",
    );
  });

  it("nudges a sparse-but-not-empty 1 km radius towards the 5 km view", () => {
    const view = selectNearby({
      insight: insightOf(series("cafe", 4), series("park", 12, 2000)),
      radius: "1km",
      filter: "all",
    });

    expect(view.note).toBe("Only 4 places within 1 km. Try the 5 km view.");
  });

  it("says nothing when the walk is well populated", () => {
    const view = selectNearby({
      insight: insightOf(series("cafe", 30), series("park", 12, 2000)),
      radius: "1km",
      filter: "all",
    });

    expect(view.note).toBeNull();
  });

  it("says nothing about a sparse walk once the reader has expanded", () => {
    const view = selectNearby({
      insight: insightOf(series("cafe", 4), series("park", 12, 2000)),
      radius: "5km",
      filter: "all",
    });

    expect(view.note).toBeNull();
  });

  it("never points at a 5 km view that adds nothing", () => {
    // The expander is hidden in this case, so copy saying "try the 5 km view"
    // would be instructing the reader to press a button that isn't there.
    const view = selectNearby({
      insight: insightOf(series("cafe", 4)),
      radius: "1km",
      filter: "all",
    });

    expect(view.note).toBe(
      "Only 4 places within 1 km, and nothing more within 5 km.",
    );
  });

  it("owns an address with nothing within either radius", () => {
    const view = selectNearby({
      insight: insightOf([]),
      radius: "1km",
      filter: "all",
    });

    expect(view.note).toBe("No amenities within 5 km of this address.");
  });

  it("counts one place as a place", () => {
    const view = selectNearby({
      insight: insightOf(series("cafe", 1), series("park", 2, 2000)),
      radius: "1km",
      filter: "all",
    });

    expect(view.note).toBe("Only 1 place within 1 km. Try the 5 km view.");
  });
});

describe("the heading count", () => {
  it("counts every place in the current radius, cap or no cap", () => {
    const insight = insightOf(series("cafe", 30), series("park", 12, 2000));

    expect(selectNearby({ insight, radius: "1km", filter: "all" }).total).toBe(30);
    expect(selectNearby({ insight, radius: "5km", filter: "all" }).total).toBe(42);
    expect(selectNearby({ insight, radius: "5km", filter: "park" }).total).toBe(12);
  });

  it("says how many the cap is hiding, and only while it is hiding any", () => {
    const insight = insightOf(series("cafe", 30), series("park", 12, 2000));

    expect(selectNearby({ insight, radius: "1km", filter: "all" }).summary).toBe(
      "Nearest 24 of 30 within 1 km",
    );
    expect(selectNearby({ insight, radius: "5km", filter: "all" }).summary).toBe(
      "42 places within 5 km",
    );
    expect(selectNearby({ insight, radius: "1km", filter: "cafe" }).summary).toBe(
      "30 places within 1 km",
    );
  });

  it("counts one place as a place", () => {
    const insight = insightOf([amenity("a", "cafe", 100)]);

    expect(selectNearby({ insight, radius: "1km", filter: "all" }).summary).toBe(
      "1 place within 1 km",
    );
  });
});
