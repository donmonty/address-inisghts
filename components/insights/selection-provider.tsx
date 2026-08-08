"use client";

import { createContext, useContext, useMemo, useState } from "react";

import { useNearby } from "@/components/insights/nearby-provider";
import type { Amenity } from "@/lib/scoring";

/**
 * Which place is open, and which one the pointer is over.
 *
 * Ephemeral React state, deliberately: **selection is never in the URL**. A
 * `mapbox_id` is not stable enough to promise a link that still resolves, so a
 * shared URL lands the recipient on the address rather than on a pin that may
 * have been retired since. Copying the URL with the drawer open yields the
 * address, which is the honest thing to share.
 *
 * The selection is held as an id and resolved against the current list on every
 * render rather than stored as the amenity itself, so filtering or switching
 * radius closes a drawer whose pin the map has just removed. The two panels
 * can't disagree about what is selected any more than they can about what is
 * listed.
 *
 * Separate from `NearbyProvider` because it is a different lifetime: radius and
 * filter are the reader's view of the neighbourhood, selection is one glance at
 * one place.
 */
interface SelectionControls {
  /** The open place, or null. Always one of the currently listed amenities. */
  selected: Amenity | null;
  /** The `mapbox_id` under the pointer, for the desktop row-to-pin highlight. */
  hovered: string | null;
  select: (amenity: Amenity | null) => void;
  hover: (id: string | null) => void;
}

const SelectionContext = createContext<SelectionControls | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const { view } = useNearby();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const controls = useMemo<SelectionControls>(() => {
    const selected =
      view.amenities.find((amenity) => amenity.id === selectedId) ?? null;

    return {
      selected,
      hovered,
      select: (amenity) => setSelectedId(amenity?.id ?? null),
      hover: setHovered,
    };
  }, [view.amenities, selectedId, hovered]);

  return <SelectionContext value={controls}>{children}</SelectionContext>;
}

export function useSelection(): SelectionControls {
  const controls = useContext(SelectionContext);
  if (!controls) {
    throw new Error("useSelection must be used inside a SelectionProvider");
  }
  return controls;
}
