import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { getAddressInsight, type Point } from "@/lib/amenities";

/**
 * The insights page: `/insights/[lat],[lng]?q=<address label>`.
 *
 * A Server Component that calls `lib/amenities.ts` directly — no self-fetch and
 * no absolute-URL construction per environment. Coordinates are the identity;
 * `q` is cosmetic and only ever displayed.
 *
 * The presentation here is deliberately plain: this route exists to prove the
 * pipeline is correct end to end against the live API. The editorial scorecard
 * — and the `error.tsx` / `loading.tsx` treatment of the throws behind it —
 * land in the following tickets.
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <p className="eyebrow text-xs text-muted-foreground">
          {point.lat}, {point.lng}
        </p>
        <h1 className="headline text-4xl text-balance">{label}</h1>
      </div>

      <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        <Score label="Walking" value={insight.walk} />
        <Score label="Driving" value={insight.drive} />
        <Score
          label="With a car"
          value={insight.delta > 0 ? `+${insight.delta}` : insight.delta}
        />
        <Score label="Amenity density" value={insight.densityIndex} />
        <Score label="Band" value={insight.densityBand} />
      </dl>

      <p className="text-sm text-muted-foreground">{insight.verdict}</p>
    </main>
  );
}

function Score({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 border-t pt-3">
      <dt className="eyebrow text-xs text-muted-foreground">{label}</dt>
      <dd className="headline text-3xl">{value}</dd>
    </div>
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
