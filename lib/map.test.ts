import { describe, expect, it } from "vitest";

import {
  drawerCover,
  MAKI_GLYPHS,
  MAP_STYLES,
  mapBounds,
  panOffset,
} from "@/lib/map";
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

/*
 * Selecting a place never flies the map anywhere: the reader chose that pin off
 * a map they were already reading, and moving it under them loses the context
 * they used to choose. The camera moves only when the pin they picked can't be
 * seen — off the band, or behind the drawer that just opened over it.
 */
describe("the pan on selection", () => {
  /** A 900x360 band sitting 200px down a 1400x900 desktop viewport. */
  const band = { top: 200, left: 100, width: 900, height: 360 };
  const desktop = {
    viewport: { width: 1400, height: 900 },
    drawer: { side: "right", size: 420 } as const,
  };
  /** The same band on a phone, under a sheet taking 70vh. */
  const phone = {
    viewport: { width: 420, height: 800 },
    drawer: { side: "bottom", size: 560 } as const,
  };

  /**
   * The offset is where the pin is asked to sit relative to the band's centre,
   * so the pin's resulting position in the band is the thing worth asserting.
   */
  const landsAt = (offset: [number, number]) => ({
    x: band.width / 2 + offset[0],
    y: band.height / 2 + offset[1],
  });

  it("stays put when the pin is in plain sight", () => {
    expect(panOffset({ pin: { x: 300, y: 180 }, band, ...desktop })).toBeNull();
  });

  it("moves a pin out from behind the right-hand drawer", () => {
    const offset = panOffset({ pin: { x: 850, y: 180 }, band, ...desktop });

    expect(offset).not.toBeNull();
    // 1400 - 420 leaves the drawer's edge at 980, which is band x 880.
    expect(landsAt(offset!).x).toBeLessThan(880);
  });

  it("moves it no further than it has to, leaving the free axis alone", () => {
    const offset = panOffset({ pin: { x: 850, y: 260 }, band, ...desktop });

    expect(landsAt(offset!).y).toBe(260);
  });

  it("moves a pin up from behind the bottom sheet", () => {
    const offset = panOffset({ pin: { x: 200, y: 300 }, band, ...phone });

    expect(offset).not.toBeNull();
    // The sheet's top edge is 240px down the viewport, which is band y 40.
    expect(landsAt(offset!).y).toBeLessThan(40);
  });

  it("brings back a pin that has scrolled off the band", () => {
    const offset = panOffset({ pin: { x: 400, y: -60 }, band, ...desktop });

    expect(offset).not.toBeNull();
    expect(landsAt(offset!).y).toBeGreaterThan(0);
  });

  it("stays put for a pin already sitting in a strip too thin for the margins", () => {
    // 800 - 560 leaves 240px of viewport, and the band starts 200px down it:
    // a 40px sliver, narrower than the margins, with the pin inside it.
    expect(panOffset({ pin: { x: 200, y: 20 }, band, ...phone })).toBeNull();
  });

  it("leaves the camera alone when nothing of the band is visible", () => {
    expect(
      panOffset({
        pin: { x: 300, y: 180 },
        band: { top: 900, left: 100, width: 900, height: 360 },
        ...desktop,
      }),
    ).toBeNull();
  });
});

describe("the drawer's cover", () => {
  it("takes the right-hand 420px above the collapse point", () => {
    expect(drawerCover({ width: 1400, height: 900 })).toEqual({
      side: "right",
      size: 420,
    });
  });

  it("takes 70vh from the bottom below it, leaving the band above", () => {
    expect(drawerCover({ width: 420, height: 800 })).toEqual({
      side: "bottom",
      size: 560,
    });
  });
});
