import {
  CATEGORY_IDS,
  type AddressInsight,
  type Amenity,
  type CategoryId,
} from "@/lib/scoring";

/**
 * The "What's nearby" view, derived.
 *
 * Both radii are already in the insight the page fetched once, so every control
 * below the coverage cards — the chips, the cap, the expander, the sparse copy
 * — is a pure read of data the client already holds. There is no request and no
 * loading state anywhere in this section, which is why the whole rule set can
 * live in one function and be tested without rendering anything.
 *
 * The component's entire state is `{ radius, filter }`; everything else is
 * computed here. #16's map band renders exactly `view.amenities`, so the two
 * panels cannot disagree.
 */

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
 */
const SPARSE_MAX = DEFAULT_CAP / 2;

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
  const within = radius === "1km" ? insight.amenities1km : insight.amenities5km;
  const chips = presentCategories(within);

  // Collapsing 5 km → 1 km can strand a filter on a category that only exists
  // out at driving distance. Dropping back to All is the honest resolution: an
  // empty list under a chip that isn't in the row would read as a bug.
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
 * The 1 km → 5 km toggle, and the way back.
 *
 * Hidden in a filtered view, where the cap it relieves doesn't apply — the
 * chosen radius survives the filter regardless, so the reader lands back on the
 * radius they left when they return to All. It is also hidden when the driving
 * set adds nothing: "Show all 12 nearby" on a list already showing twelve is a
 * control that does nothing.
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
 * change what the score means between addresses. Both lines are neutral: a
 * quiet neighbourhood is a fact about the place, not a failure of the page.
 */
function noteFor(
  insight: NearbyInsight,
  radius: NearbyRadius,
  filter: NearbyFilter,
): string | null {
  if (radius !== "1km" || filter !== "all") return null;

  const count = insight.amenities1km.length;
  if (count === 0) {
    return "No amenities within 1 km. Expand to 5 km to see what's around.";
  }

  // Nothing to nudge towards if the driving radius holds the same places.
  if (count > SPARSE_MAX) return null;
  if (insight.amenities5km.length <= count) return null;

  return `Only ${count} places within 1 km. Try the 5 km view.`;
}
