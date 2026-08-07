# Mapbox Search Box API — POI / category search

Research for: geocode an address, then count nearby amenities within ~1km (walk) and ~5km (drive)
to compute heuristic walking / driving / urbanity scores.

**Primary source:** Mapbox Search Box API reference —
<https://docs.mapbox.com/api/search/search-box/> (fetched via the `mapbox-docs` MCP server as
`https://docs.mapbox.com/api/search/search-box.md`). All claims below cite that page unless noted.

Anything not directly stated in Mapbox docs is marked **UNCONFIRMED**.

---

## 1. The `/category/{canonical_id}` endpoint

**Exact URL:**

```
GET https://api.mapbox.com/search/searchbox/v1/category/{canonical_category_id}
```

Source: <https://docs.mapbox.com/api/search/search-box/#retrieve-pois-by-category>

### Required parameters

| Param | Type | Notes |
| --- | --- | --- |
| `access_token` | `string` | The **only** required query param. |

Note: `/category` does **not** require a `session_token` (unlike `/suggest` + `/retrieve`).

### Optional parameters (complete list, verbatim from docs)

| Param | Type | Description |
| --- | --- | --- |
| `language` | `string` | ISO language code. Default English. |
| `limit` | `integer` | Number of results to return, **up to 25**. |
| `proximity` | `string` | `ip`, or `longitude,latitude`. Default is IP proximity. Biases results toward the point. |
| `near` | `string` | Free-form text place name or `longitude,latitude`. Overrides `proximity` (and promotes any existing `proximity` to `origin`). For coarse results may set a `bbox` instead of a point. |
| `bbox` | `string` | `minLon,minLat,maxLon,maxLat`. **Hard filter** — results must be contained within. Cannot cross the 180th meridian. |
| `radius` | `number` | "Limit results to those within a radius, **specified in degrees**, of the `proximity` point. Also provide `proximity` when using this parameter. Must be between `0.00001` and `10`." |
| `country` | `string` | Comma-separated ISO 3166 alpha-2 codes. |
| `types` | `string` | Comma-separated: `country`, `region`, `postcode`, `district`, `place`, `city`, `locality`, `neighborhood`, `block`, `street`, `address`, `poi`, `category`. |
| `poi_category_exclusions` | `string` | Comma-separated canonical category names to exclude. |
| `show_closed_pois` | `boolean` | `true` includes permanently closed POIs. Default excludes them. |
| `exclude_fields` | `string` | Comma-separated metadata fields to omit to shrink payload. Accepts `photos` and `reviews`. |
| `sar_type` | `string` | Search-along-route. Only allowed value: `isochrone`. |
| `route` | `string` | Polyline-encoded linestring (SAR). Can be POSTed in the body for long routes. |
| `route_geometry` | `string` | `polyline` or `polyline6`. Default `polyline`. |
| `time_deviation` | `number` | Max detour in minutes (SAR). |
| `eta_type` | `string` | Only allowed value: `navigation`. Requires `navigation_profile` plus `origin` or `proximity`. **Billed extra as Matrix API elements.** |
| `navigation_profile` | `string` | `driving`, `walking`, or `cycling`. |
| `origin` | `string` | `longitude,latitude`. Distance/ETA origin. When both `proximity` and `origin` are set, `origin` is the route target and `proximity` is the current user location. |

**Maximum `limit` is 25** for `/category`. (Compare: `/suggest` and `/forward` cap at 10.)
There is **no pagination** — the docs say pagination is not available for `/suggest`; no pagination
parameter (offset/page) exists on `/category` either. This is the hard ceiling on counts per request.

**Example request (verbatim from docs):**

```bash
curl -X GET "https://api.mapbox.com/search/searchbox/v1/category/coffee?access_token=YOUR_MAPBOX_ACCESS_TOKEN&language=en&limit=1&proximity=-122.41%2C39&bbox=-124.35526789303981%2C38.41262975705166%2C-120.52250410696067%2C39.54169087094499"
```

---

## 2. Response shape

`/category` returns a **GeoJSON `FeatureCollection`**.

Top level: `type` (always `"FeatureCollection"`), `features` (array), `attribution` (string),
`response_id` (optional string).

Per feature: `type` (`"Feature"`), `geometry` (`{ type: "Point", coordinates: [lon, lat] }`), and
`properties` containing:

- **Identity:** `name`, `name_preferred?`, `name_local?` (keyed by language code), `mapbox_id`,
  `feature_type` (`"poi"` for POIs).
- **Address:** `address` (number + street), `full_address` (address + place_formatted),
  `place_formatted`, and a full `context` object with `country` (`id`, `name`, `country_code`,
  `country_code_alpha_3`), `region` (`id`, `name`, `region_code`, `region_code_full`), `postcode`,
  `district`, `place`, `locality`, `neighborhood`, `block`, `address` (`address_number`,
  `street_name`), `street`.
- **Coordinates:** `coordinates.longitude`, `coordinates.latitude`, optional
  `coordinates.accuracy` (address-type only: `rooftop`, `parcel`, `point`, `interpolated`,
  `intersection`, `approximate`, `street`), optional `coordinates.routable_points[]`
  (`name`, `latitude`, `longitude`, optional `note`). Optional `bbox`.
- **Categorization:** `poi_category` (array of human-readable localized category names),
  `poi_category_ids` (array of **canonical** category IDs), `maki` (icon name).
- **Brand:** `brand` (array of brand names in multiple scripts), `brand_id` (array of canonical
  brand IDs, e.g. `["starbucks"]`).
- **Metadata:** `metadata` object — documented example contains `phone`, `website`, `open_hours`
  (with `periods[]` of `{ open: { day, time }, close: { day, time } }`, `day` 0–6, `time` as
  `"HHMM"`). The `/retrieve` example also shows `rating`, `wheelchair_accessible`, `popularity`.
  `exclude_fields` accepts `photos` and `reviews`, so those keys can also appear.
  The docs do not give an exhaustive schema for `metadata` — treat every key as optional.
- **Status / distance:** `operational_status` (e.g. `active`, `closed`), `external_ids`
  (source name → id), **`distance`** ("approximate distance to the `origin` location, in meters.
  If `origin` is not provided, this shows the approximate distance to the `proximity` location,
  in meters"), `eta` (minutes, only with `eta_type` + `navigation_profile` + `origin`/`proximity`).

**`distance` is exactly what we need** — set `proximity` to the geocoded address and every returned
feature carries straight-line-ish distance in meters from it, with no client-side haversine required.

**Real example response (verbatim, `/category/coffee`):**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "coordinates": [-122.6180785, 38.9307594], "type": "Point" },
      "properties": {
        "name": "Starbucks",
        "mapbox_id": "{mapbox_id}",
        "feature_type": "poi",
        "address": "15885 Dam Road",
        "full_address": "15885 Dam Road, Clearlake, California 95422, United States",
        "place_formatted": "Clearlake, California 95422, United States",
        "context": {
          "country": { "name": "United States", "country_code": "US", "country_code_alpha_3": "USA" },
          "region": { "name": "California", "region_code": "CA", "region_code_full": "US-CA" },
          "postcode": { "id": "POSTCODE_ID", "name": "95422" },
          "place": { "id": "PLACE_ID", "name": "Clearlake" },
          "address": { "name": "15885 Dam Road", "address_number": "15885", "street_name": "Dam Road" },
          "street": { "name": "Dam Road" }
        },
        "coordinates": {
          "latitude": 38.9307594,
          "longitude": -122.6180785,
          "routable_points": [
            { "name": "POI", "latitude": 38.93073970095955, "longitude": -122.61826791641334 }
          ]
        },
        "language": "en",
        "maki": "cafe",
        "poi_category": ["café", "coffee", "coffee shop", "food", "food and drink"],
        "poi_category_ids": ["cafe", "coffee", "coffee_shop", "food", "food_and_drink"],
        "brand": ["Starbucks", "星巴克", "スターバックス", "สตาร์บัคส์", "ستاربكس"],
        "brand_id": ["starbucks"],
        "external_ids": { "provider": "PROVIDER_ID" },
        "metadata": {
          "phone": "PHONE_NUMBER",
          "website": "WEBSITE_URL",
          "open_hours": {
            "periods": [
              { "open": { "day": 0, "time": "0530" }, "close": { "day": 0, "time": "2030" } },
              { "open": { "day": 1, "time": "0500" }, "close": { "day": 1, "time": "2030" } }
            ]
          }
        },
        "distance": 19568
      }
    }
  ],
  "attribution": "© 2026 Mapbox and its suppliers. All rights reserved. …",
  "response_id": "RESPONSE_ID"
}
```

Source: <https://docs.mapbox.com/api/search/search-box/#example-response-search-for-pois-by-category>

Note the `poi_category_ids` array is **hierarchical and multi-valued** — a Starbucks is
simultaneously `cafe`, `coffee`, `coffee_shop`, `food`, `food_and_drink`. This matters for
double-counting in a score.

---

## 3. Category taxonomy

**Yes, there is a list endpoint:**

```
GET https://api.mapbox.com/search/searchbox/v1/list/category?access_token=…&language=en
```

Required: `access_token`. Optional: `language` (default `en`).
Source: <https://docs.mapbox.com/api/search/search-box/#get-category-list>

Response:

```json
{
  "listItems": [
    { "canonical_id": "services", "icon": "marker", "name": "Services", "version": "25:6bd9…", "uuid": "71fed985-…" },
    { "canonical_id": "shopping", "icon": "marker", "name": "Shopping", "version": "25:6bd9…", "uuid": "9d383df0-…" }
  ],
  "attribution": "…",
  "version": "25:6bd9b589a98b57a214d92076ecf35061eed6a629"
}
```

Per item: `canonical_id` (the string to use in `/category/{id}`), `icon` (Maki icon), `name`
(localized), `version` (internal, **not stable**), `uuid` (**not stable across requests, not a
persistent identifier**). The docs explicitly state the endpoint **does not describe parent/child
relationships between categories** — the taxonomy hierarchy is not exposed.

Mapbox's own React POI tutorial confirms this is the canonical discovery path: "A full list of
canonical category ids is available via a call to the Search Box API's category list endpoint."
Source: <https://docs.mapbox.com/help/tutorials/poi-search-react/>

### Canonical IDs confirmed in Mapbox documentation

These strings appear verbatim in Mapbox docs and are safe to use:

| canonical_id | Source |
| --- | --- |
| `services` | `/list/category` example response |
| `shopping` | `/list/category` example response |
| `food_and_drink` | `/list/category` example response + `/category` docs |
| `food` | `/list/category` example response |
| `restaurant` | `/list/category` example response + POI React tutorial |
| `health_services` | `/list/category` example response |
| `office` | `/list/category` example response |
| `education` | `/list/category` example response |
| `nightlife` | `/list/category` example response |
| `lodging` | `/list/category` example response |
| `coffee` | `/category` example request + POI React tutorial |
| `cafe` | `poi_category_ids` in `/category` example response |
| `coffee_shop` | `poi_category_ids` in `/category` example response |
| `indian_restaurant` | `/category` endpoint docs ("Find an Indian restaurant") |
| `gas_station` | `/category` endpoint docs ("Find a gas station along a route") |
| `bar` | POI React tutorial `categoryButtons` |
| `hotel` | POI React tutorial `categoryButtons` |
| `museum` | POI React tutorial `categoryButtons` |
| `sports` | `poi_category_ids` in `/suggest` + `/retrieve` example responses |
| `stadium` | `poi_category_ids` in `/suggest` + `/retrieve` example responses |

Additionally, the Mapbox-authored `mapbox-search-patterns` / `mapbox-location-grounding` agent
skills (shipped in the official `mapbox` Claude Code plugin, i.e. Mapbox-authored but not the API
reference) use `hospital` and `park` as category values, and `["restaurant", "cafe"]` as
`poi_category` values.
Source: `~/.claude/plugins/marketplaces/mapbox-agent-skills/skills/mapbox-search-patterns/references/`
and `.../mapbox-location-grounding/SKILL.md`.

### The ~20 IDs we want — **UNCONFIRMED**

**I could not confirm exact canonical IDs for: grocery, school, park, pharmacy, rail/transit
station, bus stop, gym/fitness, bank, hospital, library.** The Mapbox docs publish only the ten
example `listItems` above; the full taxonomy is only obtainable at runtime. Do **not** hardcode
guesses.

**Required first implementation step:** call `/list/category?language=en` once with our token,
dump the full `listItems` array, and pin the real `canonical_id` strings into a constant in the
repo. Until that is done, treat the amenity list as unresolved.

Plausible-but-unverified candidates to check against that dump (naming style is `snake_case`
singular, per every confirmed ID above): `grocery`, `supermarket`, `school`, `park`, `pharmacy`,
`train_station`, `railway_station`, `bus_stop`, `fitness_center`, `gym`, `bank`, `hospital`,
`library`, `nightclub`, `shopping_mall`, `clothing_store`, `hardware_store`, `post_office`,
`childcare`, `place_of_worship`, `movie_theater`, `parking_lot`, `ev_charging_station`.
Every one of these is **UNCONFIRMED**.

Note also that broad parent IDs — `food_and_drink`, `shopping`, `education`, `health_services`,
`services`, `nightlife` — are confirmed and are arguably better for a density/urbanity index than
narrow leaf categories, because a single request per parent covers a whole amenity class. Their
downside is the 25-result cap saturates fast in dense areas (see §4).

---

## 4. One category per request

**One request per category.** The category is a **path segment**
(`/category/{canonical_category_id}`), not a query parameter, and the docs describe it as "The
endpoint only returns POIs with the specified category" (singular). The Mapbox Search JS wrapper
signature is `category(category: string, options)` — a single string, not an array.
Sources: <https://docs.mapbox.com/api/search/search-box/#retrieve-pois-by-category>,
<https://docs.mapbox.com/mapbox-search-js/api/core/search/>

There is no `poi_category` (inclusion) parameter on `/category` — only
`poi_category_exclusions`. Whether `/category/a,b` (comma-separated path segment) works is
**UNCONFIRMED**; the docs neither permit nor forbid it. Worth a single curl test, but do not
design around it.

**Escape hatch:** the `/forward` text-search endpoint **does** accept a comma-separated
`poi_category` inclusion list ("Limit results to those that belong to one or more categories,
provided as a comma-separated list"), plus `bbox`, `radius`, `proximity`, `country`. But
`/forward` requires a `q` text query and caps `limit` at 10, so it is a worse fit for counting.
Source: <https://docs.mapbox.com/api/search/search-box/#get-search-results>

### Request-count implications

Per address analysed:

- 1 geocode (`/suggest` + `/retrieve` session, or one `/forward` call), plus
- **N_categories × N_radii** category requests.

With 20 categories × 2 radii = **40 requests per address**. If a single request with a large
`bbox`/`radius` covering the 5km circle is used and we bucket by the returned `distance` field
client-side, it collapses to **20 requests per address** (see §5) — strongly recommended.

Two hard constraints:

- **Rate limit: 10 requests/second** default for the Search Box API. 20 sequential-ish requests per
  address means throttle/queue in the route handler; do not fan out 20 unbounded `Promise.all`s
  per concurrent user. Source: <https://docs.mapbox.com/api/search/search-box/#search-box-api-restrictions-and-limits>
- **Billing: `/category` is billed per request**, not per session. 20 categories = 20 billable
  requests per address analysed. Source:
  <https://docs.mapbox.com/api/search/search-box/#search-box-api-pricing>

Also: `limit` max 25 with no pagination means a count of 25 for `restaurant` in Manhattan is a
**censored** count, not a true count. The scoring heuristic must treat 25 as "saturated" rather
than as a literal density measure. (This is a property of the API, not an assumption — the docs
state the cap and state pagination is unavailable.)

---

## 5. Radius / distance filtering

**Both a server-side filter and a client-side option exist.**

Server-side, two filters are available on `/category`:

- **`radius`** — "Limit results to those within a radius, **specified in degrees**, of the
  `proximity` point. Also provide `proximity` when using this parameter. Must be between `0.00001`
  and `10`." So `radius` is a real filter (not just a bias), but its unit is **degrees, not meters**.
  Rough conversion: 1 degree of latitude ≈ 111,320 m, so 1km ≈ `0.009`, 5km ≈ `0.045`.
  **Caveat (UNCONFIRMED):** the docs do not say whether the degree radius is applied as a true
  geodesic circle or in raw degree space. If it is degree space, the east–west extent shrinks with
  latitude (at 50°N, 0.009° of longitude is ~640 m, not 1000 m). Do not rely on `radius` for the
  precise 1km/5km cutoff.
- **`bbox`** — a hard containment filter in `minLon,minLat,maxLon,maxLat`. Square, not circular.

Client-side, every returned feature carries **`properties.distance` in meters** from `proximity`
(or from `origin` if supplied). That is exact enough and unit-correct.

**Recommended approach:** issue **one request per category** with `proximity` = geocoded point and
`radius` ≈ `0.05` (or a bbox comfortably enclosing 5km), `limit=25`, then bucket results in Node by
`properties.distance <= 1000` and `<= 5000`. This halves request count versus one call per radius
and avoids the degrees-vs-meters ambiguity entirely.

If we want *walking* / *driving* distance rather than straight-line, `eta_type=navigation` +
`navigation_profile=walking|driving` + `origin` yields `properties.eta` in minutes — but the docs
warn this "introduces additional latency and incurs extra costs, as Mapbox bills each search result
for which it calculates an ETA (matrix elements) according to Matrix API pricing." For a heuristic
score, straight-line `distance` is the cheaper call.

---

## 6. `/suggest` + `/retrieve` autocomplete flow

### `/suggest`

```
GET https://api.mapbox.com/search/searchbox/v1/suggest?q={search_text}
```

**Required:** `q` (≤ 256 chars), `session_token`, `access_token`.

**Optional (relevant subset):** `language`, `limit` (**up to 10**), `proximity` (`ip` or
`lon,lat`; default IP), `near`, `bbox`, `country`, `types`
(`country|region|postcode|district|place|city|locality|neighborhood|block|street|address|poi|category`),
`poi_category`, `poi_category_exclusions`, `show_closed_pois`, `radius` (degrees, 0.00001–10, needs
`proximity`), plus SAR (`sar_type`/`route`/`route_geometry`/`time_deviation`) and ETA
(`eta_type`/`navigation_profile`/`origin`) params.

For an address input, `types=address` (optionally plus `street`, `place`, `postcode`) and
`country=US` (or whatever we support) narrow it usefully.

**Response:** a plain JSON object `{ suggestions: [...], attribution, response_id? }` —
**not** GeoJSON, and **contains no coordinates**. Each suggestion has `name`, `name_preferred?`,
`name_local?`, `mapbox_id`, `feature_type`, `address?`, `full_address?`, `place_formatted`,
`context{…}`, `language`, `maki?`, `poi_category?`, `poi_category_ids?`, `brand?`, `brand_id?`,
`external_ids?`, `metadata?`, `operational_status?`, `distance?`, `eta?`, `added_distance?`,
`added_time?`. To get coordinates you **must** call `/retrieve` with the `mapbox_id`.

Docs also state for `/suggest`: pagination is not available, and result ordering cannot be
customised.

Example (verbatim):

```bash
curl "https://api.mapbox.com/search/searchbox/v1/suggest?q=Michigan%20Stadium&language=en&limit=1&session_token=example_session&proximity=-83.748708,42.265837&country=US&access_token=YOUR_MAPBOX_ACCESS_TOKEN"
```

### `/retrieve`

```
GET https://api.mapbox.com/search/searchbox/v1/retrieve/{mapbox_id}
```

**Required:** `session_token` (must **match** the token used in the preceding `/suggest` calls),
`access_token`.
**Optional:** `language`, `attribute_sets` (comma-separated; accepts `photos`, `visit`, `venue` —
`basic` is always included), `proximity` (to compute `distance`), `eta_type`,
`navigation_profile`, `origin`.

**Returns a GeoJSON `FeatureCollection`** with the same per-feature property shape as `/category`
(§2): `geometry.coordinates` `[lon, lat]`, `properties.coordinates.{longitude,latitude,accuracy,
routable_points}`, `properties.full_address`, `properties.context.*`, `properties.metadata`
(example shows `phone`, `website`, `rating`, `wheelchair_accessible`, `popularity`),
`properties.operational_status`.

`properties.coordinates.accuracy` is available for address-type results and is the signal for
geocode quality: `rooftop`, `parcel`, `point`, `interpolated`, `intersection`, `approximate`,
`street`. Worth surfacing/gating on — an `approximate` or `street` match will skew every
downstream radius count.

### Session token semantics

- Customer-provided value; **UUIDv4 recommended**.
- Groups a series of requests into one billable **session**. `/category` and `/reverse` are billed
  **per request**; `/suggest` + `/retrieve` are billed **per session**.
- **Each concurrent session must use a distinct `session_token`.** "Reusing a token across
  concurrent sessions may result in unpredictable billing."
- A session **ends** when any of these happens:
  1. a `/suggest` call is followed by a `/retrieve` with the same `session_token`;
  2. `/suggest` is called with no following `/retrieve` within **180 seconds**;
  3. **50 successive `/suggest` calls** share one `session_token`.
- Each completed session counts as **one billable session**, however it ends.
- Rate limiting is still per-request: 10 `/suggest` + 1 `/retrieve` = 11 requests against the
  10 req/s limit, but 1 billable session.

Practical consequence for our app: mint a fresh UUIDv4 per address-input interaction (e.g. on
input focus / after each successful `/retrieve`), keep it for the whole keystroke sequence, and
debounce `/suggest` — never one token globally, and never a fresh token per keystroke.

Sources: <https://docs.mapbox.com/api/search/search-box/#interactive-search-autocomplete>,
<https://docs.mapbox.com/api/search/search-box/#session-billing>,
<https://docs.mapbox.com/api/search/search-box/#search-box-api-restrictions-and-limits>

### Alternative: `/forward` for one-shot geocoding

If we don't need type-ahead, `GET https://api.mapbox.com/search/searchbox/v1/forward?q=…` takes
`q` + `access_token` only (**no session_token**), returns results directly with coordinates, and
supports `proximity`, `bbox`, `country`, `types`, `limit` (up to 10), `poi_category`,
`auto_complete`, `rank_strategy` (`distance` | `relevance`), `open_now`, `minimum_rating`,
`price_levels`. Simpler for a server-side "user pasted an address" flow.
Source: <https://docs.mapbox.com/api/search/search-box/#get-search-results>

---

## 7. Calling these server-side from a Next.js route handler

**Yes — these are plain HTTPS GET endpoints authenticated by an `access_token` query parameter.
No referer or origin is required by the API itself.** There is no documented server-side
prohibition on `/suggest`, `/retrieve`, `/forward`, `/category`, or `/list/category`.

Token type:

- **A `pk.` public token works.** The Search Box API reference lists `access_token` as
  "A valid Mapbox access token" with no scope requirement called out, and Mapbox's documented
  scope table has no search-specific scope — search is covered by default public token
  permissions. **UNCONFIRMED:** the docs never explicitly name the scope required for the Search
  Box API, so I cannot cite a scope name. There is no indication an `sk.` token is needed.
- **An `sk.` secret token is not required.** Mapbox defines `sk` tokens as being for elevated,
  write-capable operations (uploads, tilesets, datasets, token management). Search is read-only.
  Source: <https://docs.mapbox.com/help/dive-deeper/access-tokens/>

**The real gotcha — URL restrictions:**

> "If you use an access token with URL restrictions to make a Mapbox API request in Terminal,
> Postman, or a similar tool, you will receive a `403` error since the request originated from an
> unauthorized URL. To run API requests in Terminal or Postman, use a token that does not have any
> URL restrictions."

URL restrictions work off the **`Referer` header**. A `fetch()` from a Node route handler sends no
`Referer`, so a URL-restricted token will **403** server-side. Docs also confirm URL restrictions
do **not** support IP addresses or wildcards, and `localhost` must be explicitly allowlisted.

Source: <https://docs.mapbox.com/accounts/guides/tokens/#url-restrictions> (also mirrored at
<https://docs.mapbox.com/help/dive-deeper/access-tokens/#url-restrictions>, and the Search Box API
error table notes "using an access token with URL restrictions can also result in a `403` error").

**Recommendation:** use two tokens.

1. A `pk.` token **without URL restrictions**, stored in a server-only env var
   (`MAPBOX_TOKEN`, *not* `NEXT_PUBLIC_*`), used by the route handlers for `/category`,
   `/forward`, `/list/category`. Keeping it server-side is what protects it, since URL restrictions
   are unavailable to us.
2. If we ever render a Mapbox GL JS map or run `/suggest` in the browser, a **separate** `pk.`
   token with URL restrictions scoped to our domains, exposed as `NEXT_PUBLIC_MAPBOX_TOKEN`.

Doing `/suggest` + `/retrieve` through our own route handler (proxying) also keeps the session
token logic and rate limiting in one place, at the cost of one extra network hop of latency per
keystroke.

---

## Other constraints worth knowing

- **Supported geographies: United States, Canada, and Europe only.** Source:
  <https://docs.mapbox.com/api/search/search-box/#supported-geographies>
- **Data is temporary-use only.** "The Mapbox Terms of Service state that all data returned by the
  Search Box API endpoints is only available for temporary use. If your use case requires storing
  position data, contact Mapbox sales." **This directly affects caching POI results per address.**
  Caching a computed *score* is likely fine; persisting the returned POI coordinates/records is
  not, without a commercial agreement. Source:
  <https://docs.mapbox.com/api/search/search-box/#search-box-api-restrictions-and-limits>
- Search JS ToS note: "any rendering of a feature suggestion must be using Mapbox map services
  (for example, displaying results on Google Maps or MapKit JS is not allowed)." Source:
  <https://docs.mapbox.com/mapbox-search-js/api/core/search/>
- Errors: `401 Not authorized` (token), `400 Bad request` (syntax), `403 Forbidden` (account issue
  **or** URL-restricted token). Source:
  <https://docs.mapbox.com/api/search/search-box/#search-box-api-errors>
- Supported query languages: Czech, Croatian, Danish, Dutch, English, Estonian, Finnish, French,
  German, Greek, Hungarian, Italian, Japanese, Lithuanian, Latvian, Polish, Portuguese, Romanian,
  Russian, Slovak, Slovenian, Spanish, Swedish, Turkish, Ukrainian.

---

## Open items to resolve before building

1. **Run `/list/category?language=en` and pin the real canonical IDs.** This is the single biggest
   unknown; §3's wish-list IDs are guesses.
2. Test whether `/category/a,b` accepts multiple categories (one curl).
3. Confirm whether `radius` degrees are applied geodesically or in raw degree space (compare
   `radius=0.009` results against `properties.distance` at a high-latitude test point).
4. Confirm the scope required by a `pk.` token for Search Box (empirically: create a
   minimal-scope public token and call `/category`).
5. Decide the caching posture given the temporary-use ToS restriction.
