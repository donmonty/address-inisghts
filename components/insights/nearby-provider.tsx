"use client";

import { createContext, useContext, useMemo, useState } from "react";

import {
  selectNearby,
  type NearbyFilter,
  type NearbyRadius,
  type NearbyView,
} from "@/lib/nearby";
import type { AddressInsight } from "@/lib/scoring";

/**
 * The one place the nearby view's `{ radius, filter }` lives.
 *
 * The map band renders exactly the current list, so the two panels have to read
 * the same `selectNearby` result — and they sit on opposite sides of the
 * coverage cards, which are server-rendered and stay that way by being passed
 * through as `children` rather than imported into this module's graph.
 *
 * Everything derived still comes from `lib/nearby.ts`; this file adds state and
 * nothing else. Both radii arrived in the insight the server already scored, so
 * changing either control is a pure read — no request, no loading state, and
 * nothing here is coupled to the map being alive.
 */
interface NearbyControls {
  view: NearbyView;
  setRadius: (radius: NearbyRadius) => void;
  setFilter: (filter: NearbyFilter) => void;
}

const NearbyContext = createContext<NearbyControls | null>(null);

export function NearbyProvider({
  insight,
  children,
}: {
  insight: AddressInsight;
  children: React.ReactNode;
}) {
  const [radius, setRadius] = useState<NearbyRadius>("1km");
  const [filter, setFilter] = useState<NearbyFilter>("all");

  const view = useMemo(
    () => selectNearby({ insight, radius, filter }),
    [insight, radius, filter],
  );

  const controls = useMemo<NearbyControls>(
    () => ({ view, setRadius, setFilter }),
    [view],
  );

  return <NearbyContext value={controls}>{children}</NearbyContext>;
}

export function useNearby(): NearbyControls {
  const controls = useContext(NearbyContext);
  if (!controls) {
    throw new Error("useNearby must be used inside a NearbyProvider");
  }
  return controls;
}
