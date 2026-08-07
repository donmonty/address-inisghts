# Mapbox: free-tier limits, billing units, and access-token security

Research date: 2026-08-06. Sources are Mapbox's own docs (via the `mapbox-docs` MCP
server) plus the live pricing page. Every claim below carries a URL. Anything I could
not verify against a primary source is marked **UNCONFIRMED**.

Context this was written for: a small Next.js demo on Vercel using (a) Mapbox GL JS in
the browser, (b) Search Box `/suggest` + `/retrieve` autocomplete, (c) Search Box
`/category` POI queries fired server-side, ~10–20 per address lookup.

---

## 1. Free-tier allowances and billable units

### Summary table

| Product | Billable unit | Free per month |
| --- | --- | --- |
| Mapbox GL JS (web maps) | 1 map load = 1 `Map` object initialization | 50,000 map loads |
| Search Box `/suggest` + `/retrieve` | 1 **session** (not 1 request) | 500 sessions (introductory preview) / 2,500 sessions (standard) |
| Search Box `/category`, `/reverse` | 1 **request** | 50,000 requests (introductory preview) / 25,000 requests (standard) |
| Geocoding API (temporary) | 1 request | 100,000 requests |
| Geocoding API (permanent) | 1 request | **0** — no free tier, $5.00/1,000 from the first request |

> **UNCONFIRMED — which Search Box price table applies to a new account.** The pricing
> page shows two side-by-side tables for both Search Box SKUs, labelled "Introductory
> preview pricing\*" and "Standard pricing". The asterisk footnote defining the
> qualifying condition or end date is not present in the page's static HTML, and no
> docs page explains it. Note the free tiers move in *opposite* directions between the
> two tables (introductory = fewer free sessions but more free requests). Verify in
> the console/billing page before relying on either number.
> Source: <https://www.mapbox.com/pricing> (Search section)

### Map loads

> "A **map load** occurs whenever a Mapbox GL JS `Map` object is initialized on a
> webpage." Users can pan, zoom, toggle layers and switch styles without incurring
> additional charges. "The maximum session length for a map load is 12 hours. If a user
> has the same map open after 12 hours, we will count that as a new map load session."
> A new map load occurs on every page load, **including every page reload**.
>
> — <https://docs.mapbox.com/help/glossary/map-loads/>,
>   <https://docs.mapbox.com/mapbox-gl-js/guides/pricing/>

A map load includes unlimited Vector Tiles API and Raster Tiles API requests.
Pricing beyond the free 50,000: $5.00/1,000 (50,001–100,000), $4.00/1,000
(100,001–200,000), $3.00/1,000 (200,001–1M), $2.50/1,000 (1M–5M).
— <https://www.mapbox.com/pricing>

This applies to Mapbox GL JS **v2 and v3**. v1 counted a load only when a `Map` was
initialized *and* a Mapbox-hosted tile was requested; pre-v1 was billed per tile
request. — <https://docs.mapbox.com/accounts/guides/pricing/#mapbox-gl-js--v100>

### Search Box: what is one billable unit

The rule is endpoint-dependent:

> "Pricing for the Mapbox Search Box API is based on which API endpoints are used. If
> you use the `/suggest` or `/retrieve` endpoints, Mapbox bills usage **per search
> session**. If you use the `/category` or `/reverse` endpoints, Mapbox bills usage
> **per request**."
>
> — <https://docs.mapbox.com/api/search/search-box/#search-box-api-pricing>

**Is a suggest+retrieve pair one session? Yes — and so is a much longer chain.** A
session is grouped by the `session_token` query parameter (UUIDv4 recommended), which
is *required* on `/suggest` and `/retrieve`. The docs define session termination
explicitly:

> "The following actions end a session:
> - Calling `/suggest` followed by a call to `/retrieve` with a common `session_token`.
> - Calling `/suggest` without a following `/retrieve` call within 180 seconds.
> - 50 successive calls to `/suggest` with a common `session_token`.
>
> Each completed session, regardless of how it ends, counts as one billable session."
>
> — <https://docs.mapbox.com/api/search/search-box/#session-billing>

So 12 keystroke-driven `/suggest` calls plus one `/retrieve`, all sharing one
`session_token`, is **1 billable session**. Crucially, an *abandoned* search (user
types, never picks a result) still bills as one session once it expires. Each
concurrent session must use a distinct `session_token`; reusing one across concurrent
sessions "may result in unpredictable billing."

The pricing page phrases the cap slightly differently from the API docs — it says a
session "includes 50 /suggest calls, and 1 /retrieve call, and it will automatically
expire after **2 minutes** of inactivity" (<https://www.mapbox.com/pricing>), whereas
the API reference says **180 seconds**. Treat the API reference as authoritative for
behavior; the discrepancy does not change the unit count.

**`/category` bills per request, not per session.** It does not accept a
`session_token` parameter at all — its only required parameter is `access_token`.
There is no way to bundle N category calls into one billable unit.
— <https://docs.mapbox.com/api/search/search-box/#retrieve-pois-by-category>

`/forward` (one-off search) is also billed per request per the migration guide
(<https://docs.mapbox.com/api/search/search-box/>, "Using search requests"), though the
pricing page's Requests SKU description names only `/category` and `/reverse`. If you
adopt `/forward`, confirm which SKU it lands in.

### Geocoding API

Billed per request. Free tier 100,000 temporary requests/month; then $0.75/1,000
(100,001–500,000), $0.60/1,000 (500,001–1M), $0.45/1,000 (1M+).
— <https://www.mapbox.com/pricing>, <https://docs.mapbox.com/api/search/geocoding/#geocoding-api-pricing>

Two gotchas:

- **Autocomplete multiplies requests.** "When autocomplete is enabled, each user
  keystroke counts as one request to the Geocoding API. For example, a search for
  'Cali' would be reflected as four separate Geocoding API requests."
  — <https://docs.mapbox.com/api/search/geocoding/>
- **Batch geocoding is not a discount.** "Each individual search in a batch geocoding
  request counts as one request."
  — <https://docs.mapbox.com/api/search/geocoding/#batch-geocoding-and-pricing>

---

## 2. Rate limits

| API | Documented limit |
| --- | --- |
| Search Box API (all endpoints, incl. `/category`, `/suggest`, `/retrieve`) | **10 requests per second** = 600/min, default, adjustable via sales |
| Geocoding API | **1,000 requests per minute**, default, adjustable per account |

> "The default rate limit for the Mapbox Search Box API is 10 requests per second. If
> you require a higher rate limit, contact Mapbox sales." … "Each API call in a *search
> session* counts individually against the rate limit. For example, 10 sequential calls
> to `/suggest` with the same `session_token` and one call to `/retrieve` are 11
> requests per the rate limit, but are billed as belonging to a single session."
>
> — <https://docs.mapbox.com/api/search/search-box/#search-box-api-restrictions-and-limits>

> "The default Geocoding API rate limit is 1000 requests per minute, but can be
> adjusted on a per-account basis. … An HTTP error code of `429` will be returned if the
> rate limit is reached."
>
> — <https://docs.mapbox.com/api/search/geocoding/#geocoding-restrictions-and-rate-limits>

**UNCONFIRMED:** the docs give a single Search Box limit; they do **not** publish
separate per-endpoint limits for `/category` vs `/suggest`/`/retrieve`. Assume the
10 req/s ceiling is shared across all Search Box endpoints for the account.

**Practical warning for this app.** Firing 10–20 `/category` requests concurrently from
a route handler for a single address lookup consumes 10–20 of your 10-requests-per-
second budget in one burst. Two simultaneous users will trip `429`. Throttle the
fan-out (e.g. a concurrency limiter of 4–5) or serialize with a small delay.

---

## 3. How many address lookups fit in the free tier?

Model one "address lookup" as:

- 1 Search Box **session** (the user's suggest/retrieve autocomplete interaction), plus
- N Search Box **requests** where N = 10–20 (`/category` calls)

These consume two *separate* SKUs, each with its own free tier, so the answer is the
minimum of two independent limits.

### Under introductory preview pricing (500 free sessions, 50,000 free requests)

```
Session-bound ceiling:  500 sessions       / 1 session  per lookup =    500 lookups
Request-bound ceiling (N=10):  50,000 req  / 10 req     per lookup =  5,000 lookups
Request-bound ceiling (N=20):  50,000 req  / 20 req     per lookup =  2,500 lookups

Binding constraint = min(500, 2,500..5,000) = 500 lookups/month
```

### Under standard pricing (2,500 free sessions, 25,000 free requests)

```
Session-bound ceiling: 2,500 sessions      / 1 session  per lookup =  2,500 lookups
Request-bound ceiling (N=10):  25,000 req  / 10 req     per lookup =  2,500 lookups
Request-bound ceiling (N=20):  25,000 req  / 20 req     per lookup =  1,250 lookups

Binding constraint (N=20) = min(2,500, 1,250) = 1,250 lookups/month
Binding constraint (N=10) = min(2,500, 2,500) = 2,500 lookups/month
```

### Takeaways

- **Roughly 500–2,500 lookups/month**, depending on which price table applies and how
  many categories you query. Call it ~500/month if introductory pricing applies, since
  the *session* tier (500) is far tighter than the request tier there.
- The `/category` fan-out is **not** what breaks you under introductory pricing — the
  autocomplete session tier is. Under standard pricing the fan-out *is* the binding
  constraint at N=20.
- Abandoned autocompletes still bill a session, so real session count > completed
  lookups. Budget conservatively.
- Map loads are unlikely to bind: 50,000 free map loads ≫ a few thousand lookups, but
  remember every page reload is a new load.
- **Cheapest lever:** cut N. Ten categories instead of twenty doubles your ceiling under
  standard pricing. Second lever: debounce `/suggest` — it does not reduce *sessions*,
  but it does reduce rate-limit pressure.

---

## 4. `pk.` vs `sk.` tokens — scopes and which endpoints need which

> "All public access tokens start with `pk` while all secret access tokens start with
> `sk`." Public tokens "are designed to be used in client-side applications, meaning
> they can be safely exposed in web browsers." Secret tokens "are designed for
> server-side applications" and "should never be exposed in client-side code."
>
> — <https://docs.mapbox.com/help/dive-deeper/access-tokens/>

**Public scopes** (the only four; all available on a `pk.` token):

| Scope | Purpose |
| --- | --- |
| `styles:tiles` | Read style as PNG tiles / static images (Static Images API, Static Tiles API) |
| `styles:read` | Read styles — **required to initialize a map style in Mapbox GL JS** |
| `fonts:read` | Read fonts / glyph ranges for rendering labels |
| `datasets:read` | Read datasets via the Datasets API |

**Secret scopes** (`sk.` only — `scopes:list`, `map:read`, `map:write`, `user:read`,
`user:write`, `uploads:read/list/write`, `styles:write/list/protect`,
`tokens:read/write`, `datasets:list/write`, `tilesets:list/read/write`,
`downloads:read`, `atlas:read`) are all write/admin/account operations.

> "Secret scopes cannot be added to a public (`pk`) token. You must create a new secret
> (`sk`) token with secret scopes."
>
> — <https://docs.mapbox.com/accounts/guides/tokens/#scopes>

### Which endpoints require which

- **Mapbox GL JS map rendering** → `pk.` with `styles:read` + `fonts:read` (add
  `styles:tiles` if you also use Static Images/Tiles).
- **Search Box `/suggest`, `/retrieve`, `/category`, `/reverse`, `/forward`** → the docs
  list only `access_token`: "A valid Mapbox access token." **No search-specific scope
  exists** in either the public or secret scope table.
  — <https://docs.mapbox.com/api/search/search-box/>
- **Geocoding API** → likewise, only "a valid Mapbox access token", no dedicated scope.
  — <https://docs.mapbox.com/api/search/geocoding/>

Mapbox's own troubleshooting guidance confirms the intent:

> "For most use cases where you are reading resources from Mapbox (such as loading a map
> or **performing location searches**), you will use a public token. Secret tokens are
> usually required for uses that require writing data."
>
> — <https://docs.mapbox.com/help/troubleshooting/token-errors/#should-i-use-a-public-or-secret-token>

### Do Search Box endpoints work with a `pk.` from a server?

**Yes.** Search endpoints require no secret scope, and nothing in the docs restricts
them to browser origins. The one caveat is URL restrictions (see §5): a `pk.` that has
URL restrictions configured will return `403` when called from a server, because there
is no `Referer` header. Use an *unrestricted* token for server-side calls.

There is no security benefit to using an `sk.` token for Search Box — an `sk.` token
carries write/admin scopes you do not need, so it is strictly worse if leaked. The
right server-side token is a **second, unrestricted, minimal-scope `pk.` token** held
in a server-only env var. That gives you a distinct token to meter and rotate
independently without granting account-write power.

---

## 5. URL restrictions on public tokens

### What they are and how to configure them

> "When you add URL restrictions to a token, that token will only work for requests to
> billable Mapbox services that originate from the URLs you specify. Requests from
> unauthorized URLs will return status code `403: Forbidden`. Tokens without
> restrictions will work for requests originating from any URL."
>
> — <https://docs.mapbox.com/accounts/guides/tokens/#url-restrictions>

Configure them either on the [Access Tokens page](https://console.mapbox.com/account/access-tokens/)
in the console or programmatically via the Tokens API (`allowedURLs` in the token
metadata object). Up to **100 distinct URL restrictions per token**.

Valid entry formats — only a domain is required; protocol, subdomain, port, path and
query string are optional:

| Form | Example |
| --- | --- |
| Domain only | `mapbox.com` |
| Domain with port | `mapbox.com:2019` |
| Protocol and domain | `http://mapbox.com` |
| Subdomain | `docs.mapbox.com` |
| Domain with path | `mapbox.com/help/getting-started/access-tokens` |
| Domain with query parameter | `mapbox.com/?page=1` |

Matching rules:

- Subdomains of an allowed domain are allowed (`http://example.com` authorizes
  `http://www.production.example.com`).
- Subpaths of an allowed path are allowed; **paths are case-sensitive**
  (`/path` authorizes `/path/more`, not `/Path`).
- If a protocol is specified it must match; if omitted, any protocol is accepted.
- If no port is given, ports 80 and 443 are allowed by default.

### What they do NOT protect against / do not support

- **Default access tokens** cannot have URL restrictions at all — you must create a new
  public token. (Same for scopes.)
  — <https://docs.mapbox.com/accounts/guides/tokens/#default-public-access-token>
- **Wildcard characters** and **IP addresses** are not supported.
- Requests from sites with a `noreferrer` or `same-origin` **Referrer-Policy** are
  blocked — the mechanism is entirely `Referer`-header based.
- A strict **Content Security Policy** can strip the `Referer` header, producing `403`.
- Mapbox GL JS **before v0.53.1** may not send a referer at all.
- Browsers with privacy-blocking extensions (Brave Shields, Ghostery) can strip the
  referer and get `403`.
- Mobile SDK requests are not covered.
- `localhost` is blocked unless explicitly added — "To develop locally, we recommend
  creating a separate token with more permissive URL restrictions."
- Mapbox's own framing: "URL restrictions are a **best-effort mitigation technique**…
  If you believe your token is being used without consent, contact Mapbox." They do not
  stop someone who copies your token and forges a `Referer` header with curl.

### Do they interfere with server-side calls?

**Yes — this is the key operational trap.** Server-side `fetch` from a Next.js route
handler sends no `Referer` header, so a restricted token gets `403`. Mapbox documents
exactly this failure mode:

> "If you use an access token with URL restrictions to make a Mapbox API request in
> Terminal, Postman, or a similar tool, you will receive a `403` error since the request
> originated from an unauthorized URL. To run API requests in Terminal or Postman, use a
> token that does not have any URL restrictions."
>
> — <https://docs.mapbox.com/accounts/guides/tokens/#url-restrictions>

The Search Box API error table repeats it: a `403 Forbidden` can mean "using an access
token with URL restrictions."
— <https://docs.mapbox.com/api/search/search-box/#search-box-api-errors>

So: **restricted token for the browser, unrestricted token for the server.** Never one
token for both.

Also note the debugging tip: after adding restrictions, test in incognito, because your
device and Mapbox's CDN may have cached pre-restriction responses.

---

## 6. Token rotation, and the Next.js-on-Vercel pattern

### Rotation, per Mapbox

> "To rotate access tokens, create a new token, replace it in your project's code,
> redeploy the application, and delete the older token. Invalidation for requests that
> have not been cached locally, in the browser, or in Mapbox infrastructure will happen
> immediately. The length of cached requests varies by service."
>
> — <https://docs.mapbox.com/accounts/guides/tokens/#rotating-access-tokens>

Additional Mapbox guidance:
— <https://docs.mapbox.com/help/dive-deeper/how-to-use-mapbox-securely/#access-tokens>

- **Avoid the default public token** — it supports neither scopes nor URL restrictions.
- **Isolate tokens**: "Generate a separate access token for each application you build.
  This will make it easier to track usage and identify unexpected activity."
- **Store tokens in environment variables** or server-side application configuration.
- Use the [Tokens API](https://docs.mapbox.com/api/accounts/tokens/) to rotate on a
  schedule. Note the Tokens API can also mint **temporary `tk.` tokens** with an
  expiry up to 1 hour in the future — useful if you ever want the browser to receive a
  short-lived token instead of a long-lived `pk.`.
  — <https://docs.mapbox.com/accounts/guides/tokens/#mapbox-tokens-api>
- Secret tokens are shown **once** at creation and **cannot be edited** afterward —
  rotating an `sk.` means creating a new one.
  — <https://docs.mapbox.com/help/troubleshooting/token-errors/#why-cant-i-edit-my-secret-token>

### Recommended env var layout

The mapping below is my recommendation derived from the Mapbox docs above plus how
Next.js `NEXT_PUBLIC_` inlining works. **Mapbox publishes no Vercel- or Next.js-specific
guidance — UNCONFIRMED as an official Mapbox recommendation.**

| Env var | Token | Scopes | URL restrictions | Used by |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | `pk.` (browser) | `styles:read`, `fonts:read` (+ `styles:tiles` only if using Static APIs) | **Yes** — your production domain(s) + Vercel preview domain(s) | Mapbox GL JS map init; any client-side `/suggest`/`/retrieve` |
| `MAPBOX_SERVER_TOKEN` | a **different** `pk.` | minimal (search needs none; `styles:read` harmless) | **No** — must be unrestricted | Route handlers calling `/category`, `/retrieve`, `/forward` |

Rules that follow from this:

- Anything in a `NEXT_PUBLIC_` var is inlined into the client bundle and is public by
  definition. Only ever put a URL-restricted `pk.` there.
- **Never put an `sk.` token in a `NEXT_PUBLIC_` var.** And there is no reason to have
  an `sk.` in this app at all — no endpoint it uses requires a secret scope.
- Set `MAPBOX_SERVER_TOKEN` in Vercel project settings as a plain (non-public)
  environment variable, scoped to Production/Preview/Development as appropriate.
- Vercel preview deployments get generated `*.vercel.app` hostnames. Because URL
  restrictions do not support wildcards, either add the bare `vercel.app`-suffixed
  project domain (subdomain matching means `myproject.vercel.app` covers
  `x.myproject.vercel.app`, but *not* arbitrary `myproject-git-abc-team.vercel.app`
  deployment URLs), or use a separate, less-restricted preview token bound to the
  Preview environment. **UNCONFIRMED** which of these Vercel-specific arrangements
  Mapbox considers acceptable; the wildcard limitation is confirmed, the Vercel
  workaround is inference.
- For local dev, either add `localhost` to the dev token's allowed list or keep a
  separate unrestricted dev token — Mapbox explicitly recommends the latter.
- Rotation drill: create new token → update the Vercel env var → redeploy → verify →
  delete the old token. Because the browser token is inlined at build time, rotating it
  **requires a redeploy**, not just an env var edit.

---

## 7. Caching and terms-of-service restrictions on storing responses

This is the part that most affects the plan to cache POI results.

### Search Box API: temporary use only, full stop

> "The Mapbox Terms of Service state that all data returned by the Search Box API
> endpoints is only available for **temporary use**. If your use case requires storing
> position data, contact Mapbox sales."
>
> — <https://docs.mapbox.com/api/search/search-box/#search-box-api-restrictions-and-limits>

There is **no `permanent` parameter on any Search Box endpoint** — I checked the full
parameter tables for `/suggest`, `/retrieve`, `/forward`, `/category`, `/reverse` and
`/list/category` and none accepts one. The permanent/temporary toggle exists only on the
Geocoding API.

**Implication: persistently caching `/category` POI results in your own store is, on the
face of the docs, not permitted, and there is no self-serve paid upgrade that makes it
permitted.** The documented route is to contact Mapbox sales. Short-lived in-request or
in-session caching (deduplicating repeat calls within one user's active session) is
consistent with "temporary use"; a durable Redis/Postgres/KV cache of POIs reused across
users and days is not. **UNCONFIRMED:** the docs do not define a numeric TTL boundary
between "temporary" and "stored", so where exactly the line falls is a question for
Mapbox, not something to infer.

### Geocoding API: temporary vs permanent is explicit

> "Temporary results are **not allowed to be cached**, while Permanent results are
> allowed to be **cached and stored indefinitely**." … "By default, the Geocoding API
> will use Temporary geocoding. To use Permanent geocoding, set the optional `permanent`
> parameter to `true`." Permanent storage "requires that you have a valid credit card on
> file or an active enterprise contract."
>
> — <https://docs.mapbox.com/api/search/geocoding/>

Permanent geocoding has **no free tier** — $5.00/1,000 from request #1, $4.00/1,000 above
500,000. — <https://www.mapbox.com/pricing>

Also from the Geocoding pricing section: **"You may only use responses from the
Geocoding API in conjunction with a Mapbox map."**
— <https://docs.mapbox.com/api/search/geocoding/#geocoding-api-pricing>

Supporting overview: <https://docs.mapbox.com/help/dive-deeper/understand-temporary-vs-permanent-geocoding/>

### Mapbox-side CDN caching (different thing, but relevant to token rotation)

Mapbox caches responses at its own CDN. You cannot invalidate it.

> "No, the CDN cache for styles and tilesets cannot be invalidated." Style changes take
> ≥15 minutes to propagate; device TTL for vector tiles is 12 hours; Static API cached
> tiles ≥12 hours.
>
> — <https://docs.mapbox.com/help/dive-deeper/api-caching/>

This is why a rotated/deleted token may appear to keep working briefly, and why URL
restrictions should be tested in incognito.

### What I could not confirm

- **UNCONFIRMED:** I could not locate the specific ToS/Product Terms clause text that
  the Search Box docs paraphrase. `https://www.mapbox.com/legal/tos` contains only
  generic caching language about Mapbox's own CDN, and
  `https://www.mapbox.com/legal/product-terms` serves the operative Product Terms as a
  **PDF** ("Mapbox Product Terms") that I did not parse. If caching POI data is
  load-bearing for this project, read that PDF or ask Mapbox directly — do not rely on
  the docs paraphrase alone.

---

## Practical recommendations for this app

1. **Cut the `/category` fan-out.** It is the single biggest cost lever and, at N=20
   under standard pricing, the binding free-tier constraint. Ten categories doubles the
   ceiling.
2. **Rate-limit the fan-out.** 10–20 parallel requests against a 10 req/s account limit
   means a second concurrent user gets `429`. Cap concurrency at ~4.
3. **Debounce `/suggest`.** It will not reduce session count, but it reduces rate-limit
   pressure, and it *would* matter a lot if you ever fall back to the Geocoding API
   (which bills per keystroke).
4. **Two tokens, both `pk.`**: a URL-restricted one in `NEXT_PUBLIC_MAPBOX_TOKEN`, an
   unrestricted one in `MAPBOX_SERVER_TOKEN`. No `sk.` token is needed anywhere in this
   app.
5. **Do not build a durable POI cache without checking with Mapbox.** Search Box data is
   temporary-use only and there is no `permanent=true` escape hatch. In-session
   deduplication is the safe version of this optimization.
6. **Watch the console Statistics page** per token to see which SKU you are actually
   being billed under, and to settle the introductory-vs-standard pricing question
   empirically: <https://console.mapbox.com/account/statistics/>
