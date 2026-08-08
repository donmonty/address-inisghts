import { describe, expect, it } from "vitest";

import { placeCard } from "@/lib/place";
import type { Amenity, CategoryId, MapboxFeature } from "@/lib/scoring";

/*
 * The drawer's card, derived. Every rule the drawer renders — which rows exist,
 * what today's hours read, when the "no further details" line replaces all four
 * optional rows — is decided here rather than in the component, the same split
 * `selectNearby` already runs on.
 *
 * The card is a pure read of the `/category` feature already in the client, so
 * these tests are the whole specification of the drawer's content: there is no
 * fetch to stub and no loading state to render.
 */

const feature = (properties: Record<string, unknown>): MapboxFeature => ({
  geometry: { type: "Point", coordinates: [-73.9879, 40.7488] },
  properties: {
    mapbox_id: "id",
    name: "Tamer's Halal Food Truck",
    distance: 15,
    ...properties,
  },
});

const place = (
  properties: Record<string, unknown> = {},
  category: CategoryId = "restaurant",
): Amenity => {
  const built = feature(properties);
  return {
    id: built.properties.mapbox_id,
    name: built.properties.name,
    category,
    distanceMeters: built.properties.distance ?? 0,
    coordinates: built.geometry.coordinates,
    feature: built,
  };
};

/** A Sunday, which is Mapbox's day 0. */
const SUNDAY = new Date("2026-08-09T12:00:00");
/** The Monday after it — day 1. */
const MONDAY = new Date("2026-08-10T12:00:00");

const hours = (periods: unknown[]) => ({
  metadata: { open_hours: { periods } },
});

const day = (d: number, open: string, close?: string) => ({
  open: { day: d, time: open },
  ...(close ? { close: { day: d, time: close } } : {}),
});

describe("the guaranteed floor", () => {
  it("names the category, the place and the distance whatever else is missing", () => {
    const card = placeCard(place(), SUNDAY);

    expect(card.name).toBe("Tamer's Halal Food Truck");
    expect(card.distance).toBe("15 m");
    expect(card.eyebrow).toBe("Restaurant");
  });

  it("always offers directions to the place's own coordinates", () => {
    const card = placeCard(place(), SUNDAY);

    expect(card.directionsHref).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=40.7488,-73.9879",
    );
  });

  it("prefers the localized name of the category the place was found under", () => {
    const card = placeCard(
      place({
        poi_category: ["comida", "comida y bebida", "restaurante"],
        poi_category_ids: ["food", "food_and_drink", "restaurant"],
      }),
      SUNDAY,
    );

    expect(card.eyebrow).toBe("restaurante");
  });

  it("falls back to the most specific localized category when none matches", () => {
    const card = placeCard(
      place({
        poi_category: ["comida", "food truck"],
        poi_category_ids: ["food", "food_truck"],
      }),
      SUNDAY,
    );

    expect(card.eyebrow).toBe("food truck");
  });
});

describe("today's hours", () => {
  it("reads the period for today verbatim", () => {
    const card = placeCard(
      place(hours([day(0, "0900", "2100"), day(1, "0700", "2200")])),
      SUNDAY,
    );

    expect(card.hours).toBe("Today 9:00 – 21:00");
  });

  it("follows the viewer's day", () => {
    const card = placeCard(
      place(hours([day(0, "0900", "2100"), day(1, "0700", "2200")])),
      MONDAY,
    );

    expect(card.hours).toBe("Today 7:00 – 22:00");
  });

  it("joins a split day into one line", () => {
    const card = placeCard(
      place(hours([day(0, "1130", "1430"), day(0, "1700", "2230")])),
      SUNDAY,
    );

    expect(card.hours).toBe("Today 11:30 – 14:30, 17:00 – 22:30");
  });

  it("keeps a closing time that falls after midnight", () => {
    const card = placeCard(
      place(
        hours([
          { open: { day: 0, time: "0700" }, close: { day: 1, time: "0000" } },
        ]),
      ),
      SUNDAY,
    );

    expect(card.hours).toBe("Today 7:00 – 0:00");
  });

  it("reads a period with no closing time as open around the clock", () => {
    const card = placeCard(
      place(hours([{ open: { day: 0, time: "0000" } }])),
      MONDAY,
    );

    expect(card.hours).toBe("Open 24 hours");
  });

  it("says so when the place is shut today", () => {
    const card = placeCard(place(hours([day(1, "0700", "2200")])), SUNDAY);

    expect(card.hours).toBe("Closed today");
  });

  it("omits the row entirely when no periods were published", () => {
    expect(placeCard(place(), SUNDAY).hours).toBeNull();
    expect(
      placeCard(place({ metadata: { open_hours: { weekday_text: [] } } }), SUNDAY)
        .hours,
    ).toBeNull();
  });
});

describe("the contact rows", () => {
  it("makes the phone dialable and the website openable", () => {
    const card = placeCard(
      place({
        metadata: {
          phone: "+1 212-736-3100",
          website: "https://www.esbnyc.com/visit",
        },
      }),
      SUNDAY,
    );

    expect(card.phone).toEqual({
      label: "+1 212-736-3100",
      href: "tel:+12127363100",
    });
    expect(card.website).toEqual({
      label: "esbnyc.com",
      href: "https://www.esbnyc.com/visit",
    });
  });

  it("shows the full address as published", () => {
    const card = placeCard(
      place({ full_address: "60 W 33rd St, New York, New York 10001" }),
      SUNDAY,
    );

    expect(card.address).toBe("60 W 33rd St, New York, New York 10001");
  });

  it("omits a row rather than placeholdering it", () => {
    const card = placeCard(place({ metadata: { phone: "212-736-3100" } }), SUNDAY);

    expect(card.phone).not.toBeNull();
    expect(card.website).toBeNull();
    expect(card.address).toBeNull();
    expect(card.note).toBeNull();
  });

  it("replaces all four absent rows with one line", () => {
    const card = placeCard(place(), SUNDAY);

    expect(card.note).toBe("No further details published for this place.");
  });
});

describe("a place that isn't trading", () => {
  it("is still a card, with a strip above it", () => {
    const card = placeCard(
      place({ operational_status: "closed_temporarily" }),
      SUNDAY,
    );

    expect(card.closure).toBe("Reported temporarily closed");
    expect(card.name).toBe("Tamer's Halal Food Truck");
  });

  it("says nothing about status when the place is trading", () => {
    expect(placeCard(place(), SUNDAY).closure).toBeNull();
    expect(
      placeCard(place({ operational_status: "active" }), SUNDAY).closure,
    ).toBeNull();
  });
});
