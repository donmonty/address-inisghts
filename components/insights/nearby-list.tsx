"use client";

import { useState } from "react";

import { pillShape } from "@/components/insights/pill";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, formatDistance } from "@/lib/format";
import {
  selectNearby,
  type NearbyFilter,
  type NearbyRadius,
} from "@/lib/nearby";
import type { AddressInsight, Amenity } from "@/lib/scoring";
import { cn } from "@/lib/utils";

/**
 * What's nearby: the places themselves, flat and nearest-first.
 *
 * Not tier-grouped — the coverage cards above already do the tier job, and this
 * section answers a different question: not "is there a pharmacy" but "which
 * pharmacy, and how far". Every row is name, mono category, mono distance, in
 * two columns collapsing at `--breakpoint-wide`.
 *
 * The only client state is the radius and the filter. Both radii arrived in the
 * insight the server already scored, so the expander and the chips are pure
 * reads — no request, no loading state, and nothing here is coupled to the map
 * being alive. The two are independent: the expander is hidden in a filtered
 * view, where the cap it relieves doesn't apply, but the radius it set survives
 * the filter and is still in force when the reader returns to All.
 *
 * Orange is spent on one thing in this section: the active chip, on its border
 * and text. Distances stay on the neutral ladder, unlike the coverage cards —
 * two dozen orange distances would out-shout the hero's walking numeral.
 */
export function NearbyList({ insight }: { insight: AddressInsight }) {
  const [radius, setRadius] = useState<NearbyRadius>("1km");
  const [filter, setFilter] = useState<NearbyFilter>("all");

  const view = selectNearby({ insight, radius, filter });
  const { expander } = view;

  return (
    <section className="mt-18">
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="eyebrow text-eyebrow text-muted-foreground">
          What&rsquo;s nearby
        </h2>
        <span className="eyebrow text-eyebrow text-muted-foreground">
          {view.summary}
        </span>
      </header>

      <div className="flex flex-wrap gap-2">
        <Chip
          active={view.filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
        />
        {view.chips.map((category) => (
          <Chip
            key={category}
            active={view.filter === category}
            onClick={() => setFilter(category)}
            label={CATEGORY_LABELS[category]}
          />
        ))}
      </div>

      {view.amenities.length > 0 && (
        <ul className="mt-7 grid grid-cols-1 gap-x-10 wide:grid-cols-2">
          {view.amenities.map((amenity) => (
            <Row key={amenity.id} amenity={amenity} />
          ))}
        </ul>
      )}

      {(view.note || expander) && (
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
          {expander && (
            <Button
              variant="outline"
              size="lg"
              className="eyebrow text-eyebrow"
              onClick={() => setRadius(expander.radius)}
            >
              {expander.label}
            </Button>
          )}
          {view.note && (
            <p className="text-sm text-muted-foreground">{view.note}</p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * One place. The name can wrap; the category and distance are one mono unit on
 * the right and must not, so the right-hand edge of the column stays a column.
 */
function Row({ amenity }: { amenity: Amenity }) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-b py-[0.7rem] text-[0.9375rem]">
      <span className="min-w-0">{amenity.name}</span>
      <span className="flex shrink-0 items-baseline gap-3 font-mono text-[0.8125rem]">
        <span className="text-muted-foreground">
          {CATEGORY_LABELS[amenity.category]}
        </span>
        <span className="w-[4.5ch] text-right tabular-nums">
          {formatDistance(amenity.distanceMeters)}
        </span>
      </span>
    </li>
  );
}

/**
 * A filter chip: the `Pill` lozenge as a button. The active one carries the
 * orange on its border and text — never as a fill, which is the rule the whole
 * palette runs on.
 */
function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        pillShape,
        "cursor-pointer transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "border-primary font-semibold text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
