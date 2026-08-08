"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

import "mapbox-gl/dist/mapbox-gl.css";

import { useNearby } from "@/components/insights/nearby-provider";
import { useSelection } from "@/components/insights/selection-provider";
import type { Point } from "@/lib/amenities";
import {
  drawerCover,
  MAKI_GLYPHS,
  MAP_STYLES,
  mapBounds,
  panOffset,
} from "@/lib/map";
import type { Amenity } from "@/lib/scoring";
import { cn } from "@/lib/utils";

/**
 * The neighbourhood's shape, not just its statistics.
 *
 * A bounded, rounded, bordered band between the verdict strip and the coverage
 * cards — not full-bleed, because the scores lead and the map supports. The
 * base styles are stock and uncustomised so the map doesn't glare out of the
 * layout; the only brand colour on it is the orange address pin.
 *
 * **The single rule: the map renders exactly the current list.** Both panels
 * read one `selectNearby` result out of `NearbyProvider`, so filtering to cafés
 * pins only cafés and expanding to 5 km pins the 5 km set. The chips become a
 * map control for free, which is what keeps the default view at ~24 markers
 * rather than ~300.
 *
 * Clicking a pin opens the place drawer and marks that pin selected; the map
 * never flies anywhere on selection, and pans only when the pin it just marked
 * would sit behind the drawer or off the band.
 *
 * Nothing else on the page waits on this component. The band holds its
 * `--muted` fill until GL JS fires `load`, and if the token is missing or the
 * constructor throws — no WebGL, a 403 on a preview deployment — it simply
 * stays muted while the list, the chips and the radius toggle keep working. The
 * copy that belongs in that empty band is #18's.
 */
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** Close enough to read a street, before the first `fitBounds`. */
const INITIAL_ZOOM = 14;
/**
 * Fitting a single-amenity filter would otherwise zoom to the maximum, which
 * loses the neighbourhood the band exists to show.
 */
const MAX_FIT_ZOOM = 16;
/** Room for the pin bodies, which extend above and left of their anchor. */
const FIT_PADDING = 56;
/** Long enough to read as the same map moving, short enough not to be waited on. */
const PAN_MS = 400;

export function MapBand({ address }: { address: Point }) {
  const { view } = useNearby();
  const { selected, hovered, select } = useSelection();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const pins = useRef(new Map<string, mapboxgl.Marker>());
  const [loaded, setLoaded] = useState(false);

  // The pins are built once each and outlive every selection, so the click
  // handler reads the current `select` off a ref rather than being a reason to
  // tear two hundred markers down and rebuild them.
  const selectRef = useRef(select);
  useEffect(() => {
    selectRef.current = select;
  }, [select]);

  const { lat, lng } = address;

  useEffect(() => {
    if (!TOKEN || !container.current) return;

    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const baseStyle = () => MAP_STYLES[dark.matches ? "dark" : "light"];

    let instance: mapboxgl.Map;
    try {
      mapboxgl.accessToken = TOKEN;
      instance = new mapboxgl.Map({
        container: container.current,
        style: baseStyle(),
        center: [lng, lat],
        zoom: INITIAL_ZOOM,
        attributionControl: true,
      });
    } catch {
      // No WebGL context, or GL JS refused the token. The band stays muted and
      // the rest of the page is untouched.
      return;
    }

    map.current = instance;
    instance.on("load", () => setLoaded(true));
    new mapboxgl.Marker({ element: addressPin(), anchor: "bottom" })
      .setLngLat([lng, lat])
      .addTo(instance);

    // The design has no theme toggle: dark follows the system preference, and
    // so does the base style. DOM markers survive `setStyle`, so the pins do
    // not have to be rebuilt here.
    const followScheme = () => instance.setStyle(baseStyle());
    dark.addEventListener("change", followScheme);

    const pinned = pins.current;
    return () => {
      dark.removeEventListener("change", followScheme);
      pinned.clear();
      map.current = null;
      setLoaded(false);
      instance.remove();
    };
  }, [lat, lng]);

  // The one rule, enforced: the pinned set is diffed against `view.amenities`
  // on every filter and radius change, so the map cannot hold a marker the list
  // isn't showing. `loaded` is a dependency rather than a guard — the pins are
  // wanted as early as possible, but a rebuilt map starts with none.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    const wanted = new Set(view.amenities.map((amenity) => amenity.id));
    for (const [id, pin] of pins.current) {
      if (wanted.has(id)) continue;
      pin.remove();
      pins.current.delete(id);
    }

    for (const amenity of view.amenities) {
      if (pins.current.has(amenity.id)) continue;
      pins.current.set(
        amenity.id,
        new mapboxgl.Marker({
          element: amenityPin(amenity, () => selectRef.current(amenity)),
        })
          .setLngLat(amenity.coordinates)
          .addTo(instance),
      );
    }
  }, [view.amenities, loaded]);

  // Selection and hover are classes on markers that already exist, never a
  // rebuild: the selected pin takes the orange fill and grows, the hovered one
  // only firms up its edge. Colour marks selection on this map and nothing
  // else, which is what keeps it readable without a legend.
  useEffect(() => {
    for (const [id, pin] of pins.current) {
      const element = pin.getElement();
      element.classList.toggle("is-selected", id === selected?.id);
      element.classList.toggle("is-hovered", id === hovered);
    }
  }, [selected, hovered, view.amenities]);

  // No `flyTo`, ever. The reader picked that pin off a map they were already
  // reading; re-centring on every click would pull the neighbourhood out from
  // under them. The camera moves only when the pin they picked can't be seen —
  // behind the drawer that just opened, or off the band — and `lib/map.ts`
  // decides which, so the rule is testable without a WebGL context.
  useEffect(() => {
    const instance = map.current;
    const node = container.current;
    if (!instance || !loaded || !selected || !node) return;

    const band = node.getBoundingClientRect();
    const pin = instance.project(selected.coordinates);

    const offset = panOffset({
      pin: { x: pin.x, y: pin.y },
      band,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      drawer: drawerCover({
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    });
    if (!offset) return;

    instance.easeTo({
      center: selected.coordinates,
      offset,
      duration: PAN_MS,
    });
  }, [selected, loaded]);

  // Refit whenever the pinned set changes, so expanding to 5 km zooms out and
  // filtering to one category zooms in on it. The address is always inside the
  // bounds, and an empty list leaves the camera where the reader left it.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !loaded) return;

    const bounds = mapBounds({ lat, lng }, view.amenities);
    if (!bounds) return;

    instance.fitBounds(bounds, {
      padding: FIT_PADDING,
      maxZoom: MAX_FIT_ZOOM,
    });
  }, [view.amenities, loaded, lat, lng]);

  // 40vw so the band reaches its 420px ceiling at the 1120px page width and
  // sits at ~360px where the grids collapse, rather than topping out short of
  // the height the design asks for.
  return (
    <div
      className="mt-12 h-[clamp(19rem,40vw,26.25rem)] overflow-hidden rounded-lg border bg-muted"
      role="region"
      aria-label="Map of the nearby places"
    >
      <div
        className={cn(
          "h-full w-full transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
      >
        {/* The veil is a wrapper rather than a class on the container itself:
            GL JS adds `mapboxgl-map` to whatever element it is handed, and a
            React-controlled `className` rewrites the attribute wholesale the
            moment `loaded` flips — dropping the `position: relative` that keeps
            the canvas and every marker inside the band. This div's class must
            stay constant for that reason. */}
        <div ref={container} className="h-full w-full" />
      </div>
    </div>
  );
}

/**
 * The searched address: a larger orange teardrop. Shape is what separates "you"
 * from "nearby" — colour is reserved for the selected pin and nothing else.
 */
function addressPin(): HTMLElement {
  const element = document.createElement("div");
  element.className = "address-pin";
  element.innerHTML = `
    <svg viewBox="0 0 24 32" width="30" height="40" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.373 18.627 0 12 0z"/>
      <circle cx="12" cy="12" r="4.25"/>
    </svg>`;
  return element;
}

/**
 * One amenity: a small `--card`-filled, `--border`-stroked circle carrying the
 * category's `maki` glyph in `--foreground`. No tier or category colour, so a
 * twelve-colour legend never has to exist.
 *
 * A real `<button>` rather than a div with a listener: the pins are the map's
 * only controls, and a marker you can reach with a keyboard and a label a
 * screen reader can read costs nothing here.
 */
function amenityPin(amenity: Amenity, onSelect: () => void): HTMLElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "amenity-pin";
  element.title = amenity.name;
  element.setAttribute("aria-label", amenity.name);
  element.innerHTML = `
    <span class="amenity-pin-body">
      <svg viewBox="0 0 15 15" width="15" height="15" aria-hidden="true">
        <path d="${MAKI_GLYPHS[amenity.category]}"/>
      </svg>
    </span>`;
  element.addEventListener("click", onSelect);
  return element;
}
