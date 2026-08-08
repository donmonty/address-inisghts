import { describe, expect, it } from "vitest";

import { CATEGORY_IDS, type TierId } from "@/lib/scoring";
import { CATEGORY_LABELS, TIER_LABELS, formatDistance } from "@/lib/format";

/**
 * The display vocabulary of the scorecard. It is here rather than inside a
 * component because it is the only part of the rendering with a rule in it,
 * and because the spec's testing boundary is "no component tests" — a pure
 * formatter is still fair game.
 */
describe("formatDistance", () => {
  it.each([
    [5, "5 m"],
    [120, "120 m"],
    [999, "999 m"],
  ])("renders %i metres as %s", (meters, expected) => {
    expect(formatDistance(meters)).toBe(expected);
  });

  it("switches to kilometres at 1000 m, to one decimal", () => {
    expect(formatDistance(1000)).toBe("1.0 km");
    expect(formatDistance(1240)).toBe("1.2 km");
    expect(formatDistance(4900)).toBe("4.9 km");
  });

  it("rounds fractional metres rather than printing them", () => {
    // Mapbox returns integer metres today, but a float must not leak "212.7 m"
    // into a mono column of otherwise clean numbers.
    expect(formatDistance(212.7)).toBe("213 m");
  });
});

describe("the display labels", () => {
  it("names all twelve categories", () => {
    expect(Object.keys(CATEGORY_LABELS).sort()).toEqual([...CATEGORY_IDS].sort());
    for (const id of CATEGORY_IDS) {
      expect(CATEGORY_LABELS[id]).not.toBe("");
    }
  });

  it("shortens the long category IDs for the coverage cards' narrow column", () => {
    expect(CATEGORY_LABELS.public_transportation_station).toBe("Transit");
    expect(CATEGORY_LABELS.fitness_center).toBe("Fitness");
    expect(CATEGORY_LABELS.clothing_store).toBe("Clothing");
  });

  it("names the three tiers", () => {
    const tiers: TierId[] = ["essential", "useful", "amenity"];
    expect(tiers.map((tier) => TIER_LABELS[tier])).toEqual([
      "Essential",
      "Useful",
      "Amenity",
    ]);
  });
});
