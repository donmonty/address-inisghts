import { describe, expect, it } from "vitest";

import { MAKI_GLYPHS, MAP_STYLES, mapBounds } from "@/lib/map";
import { CATEGORY_IDS, type Amenity, type CategoryId } from "@/lib/scoring";

/*
 * Everything about the map band that can be decided without a WebGL context:
 * which stock style each colour scheme gets, which `maki` glyph each category
 * carries, and the viewport that holds the current list. The GL JS wiring
 * itself — markers, the `load` veil, the style swap — is not tested here, which
 * is the whole reason these three are a module rather than component internals.
 */

const at = (lng: number, lat: number, category: CategoryId = "cafe"): Amenity => ({
  id: `${lng},${lat}`,
  name: `${lng},${lat}`,
  category,
  distanceMeters: 100,
  coordinates: [lng, lat],
  feature: {
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: { mapbox_id: `${lng},${lat}`, name: `${lng},${lat}` },
  },
});

const address = { lat: 0, lng: 0 };

describe("the base styles", () => {
  it("uses the stock night style in dark and the stock streets style in light", () => {
    expect(MAP_STYLES.dark).toBe("mapbox://styles/mapbox/navigation-night-v1");
    expect(MAP_STYLES.light).toBe("mapbox://styles/mapbox/streets-v12");
  });
});

describe("the category glyphs", () => {
  it("carries a glyph for every one of the twelve categories", () => {
    expect(Object.keys(MAKI_GLYPHS).sort()).toEqual([...CATEGORY_IDS].sort());
  });

  it("gives each one SVG path data on the 15x15 maki grid", () => {
    for (const id of CATEGORY_IDS) {
      expect(MAKI_GLYPHS[id]).toMatch(/^M/);
    }
  });
});

describe("the viewport", () => {
  it("has none to fit when the list is empty", () => {
    expect(mapBounds(address, [])).toBeNull();
  });

  it("encloses the address and every pinned amenity", () => {
    const bounds = mapBounds(address, [at(0.01, 0.02), at(-0.03, -0.005)]);

    expect(bounds).toEqual([
      [-0.03, -0.005],
      [0.01, 0.02],
    ]);
  });

  it("keeps the address inside even when the whole list is on one side", () => {
    const bounds = mapBounds(address, [at(0.01, 0.01), at(0.02, 0.02)]);

    expect(bounds).toEqual([
      [0, 0],
      [0.02, 0.02],
    ]);
  });

  it("fits a single amenity without collapsing to a point", () => {
    const bounds = mapBounds(address, [at(0.005, 0)]);

    expect(bounds).toEqual([
      [0, 0],
      [0.005, 0],
    ]);
  });
});
