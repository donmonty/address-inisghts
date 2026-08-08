import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { CoverageCards } from "@/components/insights/coverage-cards";
import { NearbyList } from "@/components/insights/nearby-list";
import { ScoreHero } from "@/components/insights/score-hero";
import { VerdictStrip } from "@/components/insights/verdict-strip";
import { getAddressInsight, type Point } from "@/lib/amenities";

/**
 * The insights page: `/insights/[lat],[lng]?q=<address label>`.
 *
 * A Server Component that calls `lib/amenities.ts` directly — no self-fetch and
 * no absolute-URL construction per environment. Coordinates are the identity;
 * `q` is cosmetic and only ever displayed.
 *
 * The editorial scorecard runs top to bottom: hero, verdict strip, category
 * coverage, the nearby places. The map band slots in between the strip and the
 * coverage cards in the following ticket, as does the `error.tsx` /
 * `loading.tsx` treatment of the throws behind `getAddressInsight`.
 *
 * `NearbyList` is the page's only Client Component, and it receives the whole
 * insight because both radii are already in it — the 5 km expander is a state
 * change, never a request.
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
      <CoverageCards tiers={insight.tiers} />
      <NearbyList insight={insight} />
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
