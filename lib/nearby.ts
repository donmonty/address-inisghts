/**
 * The "What's nearby" view, derived.
 *
 * Both radii are already in the insight the page fetched once, so every control
 * below the coverage cards — the chips, the cap, the expander, the sparse copy
 * — is a pure read of data the client already holds. There is no request and no
 * loading state anywhere in this section, which is why the whole rule set can
 * live in one function and be tested without rendering anything.
 *
 * Every string the section shows is built here rather than in the component,
 * the same split `VerdictStrip` and `scoreAddress` already run on: the copy has
 * rules in it — plural, cap, radius — and rules belong where the tests are.
 *
 * The component's entire state is `{ radius, filter }`; everything else is
 * computed here. #16's map band renders exactly `view.amenities`, so the two
 * panels cannot disagree.
 */

import {
  CATEGORY_IDS,
  type AddressInsight,
  type Amenity,
  type CategoryId,
} from "@/lib/scoring";

/** Which of the insight's two pre-bucketed sets is on screen. */
export type NearbyRadius = "1km" | "5km";

/** A category chip, or the "All" view the page opens on. */
export type NearbyFilter = CategoryId | "all";

export interface NearbyExpander {
  label: string;
  /** The radius the control switches to. */
  radius: NearbyRadius;
}

export interface NearbyView {
  /** The rows to render, nearest-first — already filtered and capped. */
  amenities: Amenity[];
  /** Present categories in the current radius, in tier order. Never dead. */
  chips: CategoryId[];
  /** The filter actually in force, which falls back to `all` if it went empty. */
  filter: NearbyFilter;
  /** Everything in the current radius under the current filter, before the cap. */
  total: number;
  /** The header's right-hand count line. */
  summary: string;
  expander: NearbyExpander | null;
  /** The sparse-address line, or null when the walk speaks for itself. */
  note: string | null;
}

/**
 * The default "All" view shows the nearest two dozen — enough to read the
 * neighbourhood, short of the three hundred rows a dense address would
 * otherwise produce. A filtered view is uncapped: filtering means "show me all
 * of these", and the endpoint's own 25-per-category ceiling already bounds it.
 */
const DEFAULT_CAP = 24;

/**
 * Below half the cap the two-column list doesn't fill its first screen, which
 * is the point at which a reader starts wondering whether the page is broken
 * rather than the neighbourhood empty. The copy answers that, and only then.
 * Half the cap is a judgement, not a derivation — it is the one number in this
 * file with no evidence behind it.
 */
const SPARSE_MAX = DEFAULT_CAP / 2;

/** The two radii, so no rule spells one out as a literal twice. */
const RADII = {
  "1km": { label: "1 km", of: (i: NearbyInsight) => i.amenities1km },
  "5km": { label: "5 km", of: (i: NearbyInsight) => i.amenities5km },
} satisfies Record<
  NearbyRadius,
  { label: string; of: (insight: NearbyInsight) => Amenity[] }
>;

type NearbyInsight = Pick<AddressInsight, "amenities1km" | "amenities5km">;

export function selectNearby({
  insight,
  radius,
  filter: requested,
}: {
  insight: NearbyInsight;
  radius: NearbyRadius;
  filter: NearbyFilter;
}): NearbyView {
  const within = RADII[radius].of(insight);
  const chips = presentCategories(within);

  // A filter can only strand on a category absent from the radius if something
  // outside this section changes the radius under it — the expander doesn't,
  // being hidden while filtered. Dropping back to All is the honest resolution
  // either way: an empty list under a chip that isn't in the row reads as a bug.
  const filter =
    requested === "all" || chips.includes(requested) ? requested : "all";

  const matching =
    filter === "all" ? within : within.filter((a) => a.category === filter);

  const capped =
    filter === "all" && radius === "1km"
      ? matching.slice(0, DEFAULT_CAP)
      : matching;

  return {
    amenities: capped,
    chips,
    filter,
    total: matching.length,
    summary: summaryFor(capped.length, matching.length, radius),
    expander: expanderFor(insight, radius, filter),
    note: noteFor(insight, radius, filter),
  };
}

/** In `CATEGORY_IDS` order, so the chip row reads essentials-first. */
function presentCategories(amenities: Amenity[]): CategoryId[] {
  const present = new Set(amenities.map((a) => a.category));
  return CATEGORY_IDS.filter((id) => present.has(id));
}

/**
 * "Nearest 24 of 108 within 1 km" only while the cap is actually hiding
 * something — otherwise the number would imply a limit that isn't being
 * applied.
 */
function summaryFor(
  shown: number,
  total: number,
  radius: NearbyRadius,
): string {
  const within = `within ${RADII[radius].label}`;
  if (shown < total) return `Nearest ${shown} of ${total} ${within}`;
  return `${total} ${plural(total, "place")} ${within}`;
}

/**
 * The 1 km → 5 km toggle, and the way back.
 *
 * Hidden in a filtered view, where the cap it relieves doesn't apply — the
 * radius itself survives the filter, so returning to All lands the reader back
 * on the radius they left. It is also hidden when the driving set adds nothing:
 * "Show all 12 nearby" above a list already showing twelve is a control that
 * does nothing.
 */
function expanderFor(
  insight: NearbyInsight,
  radius: NearbyRadius,
  filter: NearbyFilter,
): NearbyExpander | null {
  if (filter !== "all") return null;
  if (radius === "5km") return { label: "Back to 1 km", radius: "1km" };

  if (insight.amenities5km.length <= insight.amenities1km.length) return null;
  return {
    label: `Show all ${insight.amenities5km.length} nearby`,
    radius: "5km",
  };
}

/**
 * Sparse addresses get honest copy, never a widened radius — widening would
 * change what the score means between addresses. Every line here is neutral: a
 * quiet neighbourhood is a fact about the place, not a failure of the page.
 *
 * The line never points at the 5 km view unless there is more out there to see.
 * Where there isn't, it says so instead — copy that instructs the reader to
 * press a button this same module has just hidden would be the worse bug.
 */
function noteFor(
  insight: NearbyInsight,
  radius: NearbyRadius,
  filter: NearbyFilter,
): string | null {
  if (radius !== "1km" || filter !== "all") return null;

  const count = insight.amenities1km.length;
  if (count > SPARSE_MAX) return null;

  const drivingAddsMore = insight.amenities5km.length > count;

  if (count === 0) {
    return drivingAddsMore
      ? "No amenities within 1 km. Expand to 5 km to see what's around."
      : "No amenities within 5 km of this address.";
  }

  return drivingAddsMore
    ? `Only ${count} ${plural(count, "place")} within 1 km. Try the 5 km view.`
    : `Only ${count} ${plural(count, "place")} within 1 km, and nothing more within 5 km.`;
}

function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}
