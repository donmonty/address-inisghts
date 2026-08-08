import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { CoverageCards } from "@/components/insights/coverage-cards";
import { MapBand } from "@/components/insights/map-band";
import { NearbyList } from "@/components/insights/nearby-list";
import { NearbyProvider } from "@/components/insights/nearby-provider";
import { PlaceDrawer } from "@/components/insights/place-drawer";
import { ScoreHero } from "@/components/insights/score-hero";
import { SelectionProvider } from "@/components/insights/selection-provider";
import { VerdictStrip } from "@/components/insights/verdict-strip";
import { getAddressInsight, type Point } from "@/lib/amenities";

/**
 * The insights page: `/insights/[lat],[lng]?q=<address label>`.
 *
 * A Server Component that calls `lib/amenities.ts` directly — no self-fetch and
 * no absolute-URL construction per environment. Coordinates are the identity;
 * `q` is cosmetic and only ever displayed.
 *
 * The editorial scorecard runs top to bottom: hero, verdict strip, map band,
 * category coverage, the nearby places. The `error.tsx` / `loading.tsx`
 * treatment of the throws behind `getAddressInsight` follows in #18.
 *
 * `NearbyProvider` holds the one `{ radius, filter }` the map band and the list
 * both read, which is what makes "the map renders exactly the current list" a
 * property of the page rather than a thing two components have to agree on. It
 * receives the whole insight because both radii are already in it — the 5 km
 * expander is a state change, never a request. `CoverageCards` sits between the
 * two and stays a Server Component by being passed through as `children`.
 *
 * `SelectionProvider` holds the open place, and holds it in React state only —
 * selection never enters the URL, so a shared link lands the recipient on the
 * address rather than on a `mapbox_id` that may no longer resolve.
 */
export default async function InsightsPage({
  params,
  searchParams,
}: PageProps<"/insights/[coords]">) {
  const { coords } = await params;
  const point = parseCoords(coords);
  if (!point) notFound();

  const { q } = await searchParams;
  const label = typeof q === "string" && q.trim() !== "" ? q : coords;

  const insight = await getAddressInsight({ ...point, ip: await clientIp() });

  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-6 pb-24">
      <ScoreHero label={label} insight={insight} />
      <VerdictStrip verdict={insight.verdict} />
      <NearbyProvider insight={insight}>
        <SelectionProvider>
          <MapBand address={point} />
          <CoverageCards tiers={insight.tiers} />
          <NearbyList />
          <PlaceDrawer />
        </SelectionProvider>
      </NearbyProvider>
    </main>
  );
}

/**
 * `lat,lng` from the single path segment. Anything that isn't a real point on
 * Earth is a 404 rather than an error — a malformed URL is not a failed score,
 * and it must never reach Mapbox as a `NaN` proximity.
 */
function parseCoords(coords: string): Point | null {
  const parts = decodeURIComponent(coords).split(",");
  if (parts.length !== 2) return null;

  const [lat, lng] = parts.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return { lat, lng };
}

/** The rate limiter's identity. Behind Vercel this is `x-forwarded-for`. */
async function clientIp(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
