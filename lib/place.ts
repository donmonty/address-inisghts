/**
 * The place drawer's card, derived.
 *
 * The whole card is a pure read of the `/category` feature the client already
 * holds, which is the point: clicking a pin or a row opens details with no
 * request and therefore no loading state. `scoreAddress` carries the raw
 * feature through on every amenity precisely so this file can exist.
 *
 * Every rule about the card lives here rather than in the component, the same
 * split `selectNearby` and `scoreAddress` already run on. The component's job
 * is to render the rows this returns and skip the null ones.
 *
 * Nothing here reaches for `/retrieve`: no ratings, no accessibility, no
 * popularity. And nothing computes an "open now" — Mapbox publishes no POI
 * timezone, so a live badge would be evaluated in the viewer's clock and would
 * silently lie. Today's line is read verbatim off `periods[]` instead.
 */

import { CATEGORY_LABELS, formatDistance } from "@/lib/format";
import type { Amenity, CategoryId } from "@/lib/scoring";

/** A row that is also a link — the label read, the href followed. */
export interface PlaceLink {
  label: string;
  href: string;
}

export interface PlaceCard {
  /** The localized `poi_category`, set in mono uppercase by the drawer. */
  eyebrow: string;
  name: string;
  distance: string;
  /** Every optional row is null when absent, and never placeholdered. */
  address: string | null;
  /** Today's hours, verbatim, or null when none were published. */
  hours: string | null;
  phone: PlaceLink | null;
  website: PlaceLink | null;
  /** Always present, so no card is ever actionless. */
  directionsHref: string;
  /** The `--destructive` strip's copy, or null when the place is trading. */
  closure: string | null;
  /** The one muted line that stands in for all four absent rows. */
  note: string | null;
}

/**
 * The universal link rather than a `maps.google.com` URL or a platform scheme:
 * it opens the installed app on both mobile platforms and the web map
 * everywhere else, so one href covers every reader.
 */
const DIRECTIONS_BASE = "https://www.google.com/maps/dir/?api=1&destination=";

const NO_DETAILS = "No further details published for this place.";
const CLOSURE_NOTICE = "Reported temporarily closed";

/**
 * Mapbox's `operational_status` is absent on a trading POI and, on the
 * fixtures, absent everywhere. Anything else it may carry is treated as a
 * closure notice rather than enumerated: an unrecognised status is still not
 * "open for business", and the strip is the honest reading of it.
 */
const OPERATIONAL = new Set(["active", "operational"]);

interface Period {
  open?: { day?: number; time?: string };
  close?: { day?: number; time?: string };
}

interface PlaceMetadata {
  phone?: string;
  website?: string;
  open_hours?: { periods?: Period[] };
}

export function placeCard(amenity: Amenity, now: Date = new Date()): PlaceCard {
  const properties = amenity.feature.properties;
  const metadata = (properties.metadata ?? {}) as PlaceMetadata;

  const [lng, lat] = amenity.coordinates;
  const address = text(properties.full_address);
  const hours = todaysHours(metadata.open_hours?.periods, now.getDay());
  const phone = phoneLink(text(metadata.phone));
  const website = websiteLink(text(metadata.website));

  return {
    eyebrow: eyebrowFor(properties, amenity.category),
    name: amenity.name,
    distance: formatDistance(amenity.distanceMeters),
    address,
    hours,
    phone,
    website,
    directionsHref: `${DIRECTIONS_BASE}${lat},${lng}`,
    closure: closureFor(properties.operational_status),
    note: address || hours || phone || website ? null : NO_DETAILS,
  };
}

/**
 * The category the place was found under, in the reader's language.
 *
 * `poi_category` is localized and `poi_category_ids` is not, so the pair is
 * read positionally: the localized name at the index of the id we searched. It
 * is the searched category and not the most specific one because the eyebrow
 * has to agree with the chip that filtered the place into view.
 *
 * With no match — a POI listed under a parent of the queried category — the
 * last entry is the most specific one Mapbox published. With no localized array
 * at all it falls back to the scorecard's own label, which is the one string
 * guaranteed to exist.
 */
function eyebrowFor(
  properties: Record<string, unknown>,
  category: CategoryId,
): string {
  const localized = stringArray(properties.poi_category);
  const ids = stringArray(properties.poi_category_ids);

  const matched = localized[ids.indexOf(category)];
  return matched ?? localized.at(-1) ?? CATEGORY_LABELS[category];
}

/**
 * Today's line, verbatim.
 *
 * "Today" is the viewer's day, which is the only day this page can know: the
 * category endpoint gives no POI timezone. That is also why the line is a
 * transcription of `periods[]` and never a computed "open now" — transcribing
 * an unambiguous published fact is safe where evaluating it in the wrong clock
 * is not.
 *
 * A period with no `close` is Mapbox's around-the-clock encoding — a lone
 * `{ open: { day: 0, time: "0000" } }` standing for the whole week at a place
 * that never shuts — so it says so instead of printing a start with no end.
 * Multiple periods on one day are a split day (lunch, then dinner) and are
 * joined into the one line. A period is listed
 * under the day it opens, so a closing time after midnight reads as the
 * source published it: `Today 7:00 – 0:00`.
 */
function todaysHours(
  periods: Period[] | undefined,
  today: number,
): string | null {
  if (!periods || periods.length === 0) return null;

  // The around-the-clock encoding is one open with no close — on day 0, and
  // standing for every day — so it is read before the day filter, which would
  // otherwise report a 24/7 place shut on six days out of seven.
  if (periods.every((period) => !period.close)) return "Open 24 hours";

  const todays = periods.filter((period) => period.open?.day === today);
  if (todays.length === 0) return "Closed today";

  if (todays.some((period) => !period.close)) return "Open 24 hours";

  const spans = todays
    .map((period) => {
      const open = time(period.open?.time);
      const close = time(period.close?.time);
      return open && close ? `${open} – ${close}` : null;
    })
    .filter((span) => span !== null);

  return spans.length > 0 ? `Today ${spans.join(", ")}` : "Closed today";
}

/** `"0930"` → `"9:30"`. 24-hour, because the source is and the page is. */
function time(raw: string | undefined): string | null {
  if (!raw || !/^\d{4}$/.test(raw)) return null;
  return `${Number(raw.slice(0, 2))}:${raw.slice(2)}`;
}

/**
 * The number is shown exactly as published — spacing and punctuation carry the
 * country's own conventions — while the `tel:` href keeps only what a dialler
 * can use.
 */
function phoneLink(phone: string | null): PlaceLink | null {
  if (!phone) return null;

  const dialable = phone.replace(/[^\d+]/g, "");
  if (dialable === "") return null;

  return { label: phone, href: `tel:${dialable}` };
}

/**
 * The host, not the URL: a deep link to a booking path would wrap over three
 * lines and say nothing the host doesn't. `www.` goes because it is noise in a
 * label but not in an href, which is followed as published.
 */
function websiteLink(website: string | null): PlaceLink | null {
  if (!website) return null;

  let label = website;
  try {
    label = new URL(website).hostname.replace(/^www\./, "");
  } catch {
    // Not an absolute URL. It can't be linked honestly, so it isn't a row.
    return null;
  }

  return { label, href: website };
}

function closureFor(status: unknown): string | null {
  const value = text(status);
  if (!value || OPERATIONAL.has(value)) return null;
  return CLOSURE_NOTICE;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}
