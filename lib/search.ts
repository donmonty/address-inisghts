/**
 * Address search: Mapbox Search Box `/suggest` + `/retrieve`, from the browser.
 *
 * The landing page never submits free text. A visitor picks a suggestion, this
 * module retrieves its coordinates, and only then does the app navigate — which
 * is why `/insights/[lat],[lng]` can treat coordinates as the address's identity
 * and why "address not found" is not a state the app has to render.
 *
 * These two endpoints are billed **per session**, not per request, and the
 * session is defined by the `session_token` query parameter: a whole keystroke
 * sequence plus the `/retrieve` that ends it is one billable session, while a
 * fresh token per keystroke would be one session per keystroke. That makes
 * `createSearchSession` a cost control rather than a tidiness measure — see
 * `docs/research/mapbox-limits-and-tokens.md` §1.
 *
 * Only `NEXT_PUBLIC_MAPBOX_TOKEN` is read here — the URL-restricted public
 * token, the only one that may reach a browser. The server token stays in
 * `lib/amenities.ts`, which is never imported into a Client Component.
 */

const SUGGEST_ENDPOINT = "https://api.mapbox.com/search/searchbox/v1/suggest";
const RETRIEVE_ENDPOINT = "https://api.mapbox.com/search/searchbox/v1/retrieve";

/**
 * Addresses first, but not addresses only: a visitor with no house number in
 * mind should still be able to score a street, a town or a ZIP, and every one
 * of those retrieves to a point the twelve categories can be fanned out from.
 */
const TYPES = "address,street,place,postcode";

/** Six is what fits under the input on a phone without becoming a page. */
const SUGGESTION_LIMIT = 6;

/**
 * Below this, a query is a prefix rather than an address: it would return the
 * same noise for every visitor and still cost a request against the account's
 * 10/s. The combobox reads it too, to tell "not typed enough yet" apart from
 * "no matches" — the two look identical to `/suggest` and must not to a reader.
 */
export const MIN_QUERY_LENGTH = 3;

/** Coordinates in the URL are rounded to ~11 cm; a front door is not finer. */
const HREF_PRECISION = 6;

/** One row of the suggestion list, and the only thing `/retrieve` needs. */
export interface AddressSuggestion {
  /** Mapbox's opaque id. A suggestion without one can never be retrieved. */
  mapboxId: string;
  /** The address line: `1270 Broadway`. */
  name: string;
  /** The city/region line under it, or null when Mapbox published none. */
  context: string | null;
  /** The one-line form, shown on the insights page as `?q=`. */
  label: string;
}

/** A picked address, resolved to the point the whole app is keyed on. */
export interface ResolvedAddress {
  lat: number;
  lng: number;
  label: string;
}

/**
 * One address-input interaction's session token.
 *
 * The token is minted lazily on the first `/suggest` and then held: every
 * keystroke after it, and the `/retrieve` that ends the interaction, share it.
 * `end()` is called when the interaction is genuinely over — a completed
 * retrieve, or an input cleared back to empty — and never on a failed retrieve,
 * where the visitor's next attempt belongs to the same session they already
 * paid for.
 */
export interface SearchSession {
  token(): string;
  end(): void;
}

export function createSearchSession(
  mintToken: () => string = () => crypto.randomUUID(),
): SearchSession {
  let token: string | null = null;

  return {
    token: () => (token ??= mintToken()),
    end: () => {
      token = null;
    },
  };
}

export interface SuggestRequest {
  query: string;
  sessionToken: string;
  /** The debounce's own controller: a superseded keystroke aborts its call. */
  signal?: AbortSignal;
}

/**
 * The suggestions for what has been typed so far.
 *
 * An empty array is a real answer — the "No matches" line — so failure is a
 * throw and never an empty list. The two are separate states under the input
 * and neither is an error the page falls over on.
 */
export async function suggestAddresses({
  query,
  sessionToken,
  signal,
}: SuggestRequest): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const url = new URL(SUGGEST_ENDPOINT);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("session_token", sessionToken);
  url.searchParams.set("access_token", browserToken());
  url.searchParams.set("types", TYPES);
  url.searchParams.set("limit", String(SUGGESTION_LIMIT));
  url.searchParams.set("language", "en");
  // Mapbox biases to the caller's IP. The visitor's own region is the best
  // guess available before they have typed a city, and costs nothing.
  url.searchParams.set("proximity", "ip");

  const body = await request(url, signal, "suggest");
  const suggestions = (body as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions)) {
    throw new Error("Mapbox /suggest returned no suggestion list.");
  }

  return suggestions.map(toSuggestion).filter((entry) => entry !== null);
}

interface RawSuggestion {
  mapbox_id?: unknown;
  name?: unknown;
  place_formatted?: unknown;
  full_address?: unknown;
}

function toSuggestion(raw: RawSuggestion): AddressSuggestion | null {
  const mapboxId = text(raw.mapbox_id);
  const name = text(raw.name);
  if (!mapboxId || !name) return null;

  const context = text(raw.place_formatted);

  return {
    mapboxId,
    name,
    context,
    // `full_address` is the address line and its context already joined, and is
    // absent on the broader types; joining the two parts is the same string.
    label: text(raw.full_address) ?? [name, context].filter(Boolean).join(", "),
  };
}

export interface RetrieveRequest {
  suggestion: AddressSuggestion;
  sessionToken: string;
  signal?: AbortSignal;
}

/**
 * The picked suggestion's coordinates. This is what removes free text from the
 * navigation path: nothing is pushed onto the router until a point is in hand.
 */
export async function retrieveAddress({
  suggestion,
  sessionToken,
  signal,
}: RetrieveRequest): Promise<ResolvedAddress> {
  const url = new URL(`${RETRIEVE_ENDPOINT}/${suggestion.mapboxId}`);
  url.searchParams.set("session_token", sessionToken);
  url.searchParams.set("access_token", browserToken());
  url.searchParams.set("language", "en");

  const body = await request(url, signal, "retrieve");
  const feature = (body as { features?: RetrievedFeature[] }).features?.[0];
  const coordinates = feature?.geometry?.coordinates;

  if (
    !Array.isArray(coordinates) ||
    !Number.isFinite(coordinates[0]) ||
    !Number.isFinite(coordinates[1])
  ) {
    throw new Error("Mapbox /retrieve returned no coordinates.");
  }

  const [lng, lat] = coordinates;

  return {
    lat,
    lng,
    // The retrieved address is the fuller one, but the suggestion's label is
    // what the visitor actually read before picking, so it stands in.
    label: text(feature?.properties?.full_address) ?? suggestion.label,
  };
}

interface RetrievedFeature {
  geometry?: { coordinates?: number[] };
  properties?: { full_address?: unknown };
}

/** `/insights/[lat],[lng]?q=<label>`. The label is cosmetic; the point isn't. */
export function insightsHref({ lat, lng, label }: ResolvedAddress): string {
  const coords = `${round(lat)},${round(lng)}`;
  return `/insights/${coords}?q=${encodeURIComponent(label)}`;
}

function round(value: number): number {
  return Number(value.toFixed(HREF_PRECISION));
}

async function request(
  url: URL,
  signal: AbortSignal | undefined,
  endpoint: string,
): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Mapbox /${endpoint} responded ${response.status}.`);
  }
  return response.json();
}

/**
 * Inlined by Next at build time, which is why it is read as a whole literal
 * expression rather than off a variable key.
 */
function browserToken(): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN is not set.");
  return token;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
