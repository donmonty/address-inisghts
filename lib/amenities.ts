/**
 * Everything impure.
 *
 * `getAddressInsight` turns a coordinate pair into the scored insight model:
 * it fans out the twelve locked categories against the Mapbox Search Box
 * category endpoint, applies the in-process cache and the cache-miss rate
 * limiter, and hands the raw payloads to `scoreAddress`. The scoring itself is
 * pure and lives in `lib/scoring.ts`; nothing mechanical leaks into that file
 * and no scoring rule leaks into this one.
 *
 * This module holds the server-only token and is called directly by the
 * insights Server Component — there is deliberately no route handler and no
 * `middleware.ts`. See `docs/research/mapbox-limits-and-tokens.md` for why the
 * server token must be unrestricted, and the spec (#9) for why the limiter
 * counts cache misses rather than page visits.
 */

import {
  CATEGORY_IDS,
  scoreAddress,
  type AddressInsight,
  type CategoryId,
  type MapboxFeature,
  type RawByCategory,
} from "@/lib/scoring";

const CATEGORY_ENDPOINT = "https://api.mapbox.com/search/searchbox/v1/category";

/**
 * The server-side radius, in degrees — the endpoint's unit. 0.05° ≈ 5566 m,
 * comfortably enclosing the 5 km driving radius so both radii are served from
 * the same twelve responses. Degrees are approximate (the east–west extent
 * shrinks with latitude), which is exactly why the real cutoffs are applied to
 * each feature's metre `distance` rather than to this parameter.
 */
const RADIUS_DEGREES = 0.05;
const METRES_PER_DEGREE = 111_320;
/** The requested radius in metres. Anything beyond it is discarded outright. */
const RADIUS_M = RADIUS_DEGREES * METRES_PER_DEGREE;

/** 25 is the endpoint's ceiling; there is no pagination. */
const RESULT_LIMIT = 25;
/** Three waves of four, well inside the account's 10 req/s. */
const CONCURRENCY = 4;
const RETRY_BACKOFF_MS = 250;
const REQUEST_TIMEOUT_MS = 8_000;

const CACHE_TTL_MS = 15 * 60 * 1000;
/** ~11 m — fine enough that two front doors never share an entry. */
const CACHE_PRECISION = 4;

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MISSES = 20;

/** A point on Earth. Coordinates are the address's identity everywhere. */
export interface Point {
  lat: number;
  lng: number;
}

/** A category the API never returned, after its retry. The page hard-fails. */
export class MissingCategoryError extends Error {
  constructor(
    readonly categories: CategoryId[],
    cause?: unknown,
  ) {
    super(
      `Mapbox returned no data for ${categories.join(", ")} — refusing to score on a partial fan-out.`,
      { cause },
    );
    this.name = "MissingCategoryError";
  }
}

/** More than 20 cache misses in a minute from one IP. */
export class RateLimitError extends Error {
  constructor() {
    super(`More than ${RATE_LIMIT_MISSES} lookups a minute from this address.`);
    this.name = "RateLimitError";
  }
}

interface CacheEntry {
  /** The in-flight fan-out, so concurrent first loads share one set of calls. */
  insight: Promise<AddressInsight>;
  expiresAt: number;
}

interface RateLimitEntry {
  misses: number;
  windowStartedAt: number;
}

interface ProcessState {
  cache: Map<string, CacheEntry>;
  rateLimit: Map<string, RateLimitEntry>;
}

/**
 * Both maps hang off `globalThis` so they survive the module re-evaluation that
 * `next dev` does on every edit. In production this is a plain process-local
 * singleton — which means each serverless instance holds its own cache and its
 * own counter, so the effective limit is a multiple of the configured one.
 * Demo-grade on purpose; production would use shared storage.
 */
const { cache, rateLimit } = ((
  globalThis as typeof globalThis & { __addressInsights?: ProcessState }
).__addressInsights ??= {
  cache: new Map<string, CacheEntry>(),
  rateLimit: new Map<string, RateLimitEntry>(),
});

export interface InsightRequest extends Point {
  /**
   * The caller's IP, as the rate limiter's identity. Callers that can't
   * establish one share the `unknown` bucket, which is the conservative
   * reading.
   */
  ip: string;
}

/**
 * The twelve categories at one address, scored.
 *
 * A cache hit costs nothing: no Mapbox request, and no increment against the
 * limiter — hammering a single address is free, so it stays unlimited. The
 * entry is the in-flight promise rather than its result, so two people opening
 * the same address at once share one fan-out and count one miss between them.
 *
 * A miss counts one, then fetches. If any category is still missing after its
 * retry this throws rather than scoring on what returned: the fixed `/24`
 * denominator would bias a partial score low, and a wrong score is worse than
 * no score.
 */
export function getAddressInsight({
  ip,
  ...point
}: InsightRequest): Promise<AddressInsight> {
  const key = cacheKey(point);
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.insight;

  recordCacheMiss(ip, now);

  const insight = fetchCategories(point).then(scoreAddress);
  const entry = { insight, expiresAt: now + CACHE_TTL_MS };
  cache.set(key, entry);

  // A failed fan-out must not be remembered — the next load should retry it,
  // not read back a rejection for fifteen minutes.
  insight.catch(() => {
    if (cache.get(key) === entry) cache.delete(key);
  });

  return insight;
}

/** Rounded coordinates are the cache identity — `q` never enters the key. */
function cacheKey({ lat, lng }: Point): string {
  return `${lat.toFixed(CACHE_PRECISION)},${lng.toFixed(CACHE_PRECISION)}`;
}

/** Counts one miss against the IP's minute, or throws if it's already spent. */
function recordCacheMiss(ip: string, now: number): void {
  sweep(cache, (entry) => entry.expiresAt <= now);
  sweep(
    rateLimit,
    (entry) => now - entry.windowStartedAt >= RATE_LIMIT_WINDOW_MS,
  );

  const entry = rateLimit.get(ip);
  if (!entry) {
    rateLimit.set(ip, { misses: 1, windowStartedAt: now });
    return;
  }

  if (entry.misses >= RATE_LIMIT_MISSES) throw new RateLimitError();
  entry.misses += 1;
}

/** Drops every expired entry. Both maps are small; a full pass is cheap. */
function sweep<V>(entries: Map<string, V>, isExpired: (entry: V) => boolean) {
  for (const [key, entry] of entries) {
    if (isExpired(entry)) entries.delete(key);
  }
}

/**
 * The twelve categories in one fan-out, four at a time.
 *
 * Every category is required. An empty array is a perfectly good answer — a
 * sparse address genuinely has no library — but a category that errored through
 * its retry is not an answer at all, and takes the whole page down with it.
 */
async function fetchCategories(point: Point): Promise<RawByCategory> {
  const results = await mapWithConcurrency(
    CATEGORY_IDS,
    CONCURRENCY,
    async (category) => {
      try {
        return {
          category,
          features: await fetchCategory(category, point),
          error: null,
        };
      } catch (error) {
        return { category, features: null, error };
      }
    },
  );

  const failed = results.filter((result) => result.features === null);
  if (failed.length > 0) {
    throw new MissingCategoryError(
      failed.map((result) => result.category),
      failed[0].error,
    );
  }

  return Object.fromEntries(
    results.map(({ category, features }) => [category, features]),
  ) as RawByCategory;
}

/** One category, with one retry behind a short backoff. */
async function fetchCategory(
  category: CategoryId,
  point: Point,
): Promise<MapboxFeature[]> {
  try {
    return await requestCategory(category, point);
  } catch {
    await sleep(RETRY_BACKOFF_MS);
    return requestCategory(category, point);
  }
}

async function requestCategory(
  category: CategoryId,
  { lat, lng }: Point,
): Promise<MapboxFeature[]> {
  const token = process.env.MAPBOX_SERVER_TOKEN;
  if (!token) throw new Error("MAPBOX_SERVER_TOKEN is not set.");

  const url = new URL(`${CATEGORY_ENDPOINT}/${category}`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("proximity", `${lng},${lat}`);
  url.searchParams.set("radius", String(RADIUS_DEGREES));
  url.searchParams.set("limit", String(RESULT_LIMIT));
  url.searchParams.set("language", "en");

  const response = await fetch(url, {
    // The in-process cache is the caching layer; Search Box data is
    // temporary-use only, so nothing is persisted by the framework.
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Mapbox ${category} responded ${response.status}.`);
  }

  const body: unknown = await response.json();
  const features = (body as { features?: MapboxFeature[] }).features;
  if (!Array.isArray(features)) {
    throw new Error(`Mapbox ${category} returned no feature collection.`);
  }

  // The hard rule. The endpoint biases rather than bounds, and has been seen
  // returning POIs 237 km out; a feature with no distance can't be placed
  // honestly either. Correctness, not optimisation.
  return features.filter(
    (feature) =>
      typeof feature.properties?.distance === "number" &&
      feature.properties.distance <= RADIUS_M,
  );
}

/** A fixed-size worker pool. Results keep the input order. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index]);
      }
    },
  );

  await Promise.all(runners);
  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
