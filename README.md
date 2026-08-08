# Address Insights

**What is daily life like from this front door?**

Type an address, get walking, driving and amenity-density scores for that exact point — with
the working shown. Every score decomposes into the twelve amenity categories that produced it,
and every place behind those categories is listed with its distance, hours and a directions link.

Live: <https://address-insights-monty.vercel.app>

---

## Contents

- [Authorship: who wrote what](#authorship-who-wrote-what)
- [What it does](#what-it-does)
- [The scoring](#the-scoring)
- [The BANANA instruction](#the-banana-instruction)
- [Testing boundary](#testing-boundary)
- [Known limitations](#known-limitations)
- [Architecture](#architecture)
- [Running it](#running-it)
- [Where the reasoning lives](#where-the-reasoning-lives)

---

## Authorship: who wrote what

**Claude Code generated substantially all of the code in this repository.** Every file under
`app/`, `lib/` and `components/`, every test, every research document in `docs/research/`, and
this README were written by the agent. The commit trailers say so: each commit on `main` carries
a `Co-Authored-By: Claude Opus 5` line, and the human's own trailer sits alongside it.

**The human contribution is the decisions.** Concretely, that means:

- Framing the problem and the product — what question the app answers, and for whom.
- Running a decision map ([#1](https://github.com/donmonty/address-inisghts/issues/1)) that turned
  every open question into a ticket, and resolving each of those tickets with an explicit call
  rather than a default.
- Choosing the scoring model: coverage-first over count-first, tier weights over a flat count, no
  distance decay, the driving score as pure coverage. The agent measured; the human picked.
- Rejecting the agent's own proposals when measurement contradicted them — dedupe was written up as
  load-bearing and was demoted to a documented no-op once it was measured at exactly zero overlap;
  the "urban/suburban index" the brief asked for was renamed Amenity Density after the data showed
  downtown Marfa is denser than suburban Plano.
- Setting the scope cuts, including the ones that cost something: no E2E tests, no per-address OG
  image, no collapsing of co-located brand duplicates.
- Reviewing every pull request before merge.

The honest summary: the agent is fast and thorough and wrote essentially all of the text you are
reading and running; it also proposed at least three things that measurement then killed. The
value the human added is in the specification, the calls, and the refusals — not in the typing.

The decision trail is public: read [issue #1](https://github.com/donmonty/address-inisghts/issues/1)
for the decision map, [issue #9](https://github.com/donmonty/address-inisghts/issues/9) for the
resulting spec, and the numbered build tickets for what each PR was asked to do.

---

## What it does

1. **Landing page** — a Search Box autocomplete over addresses, streets, places and postcodes; four
   seeded example addresses; and a browser-local list of recent lookups. No account, no database.
2. **Insights page** at `/insights/[lat],[lng]?q=<label>` — coordinates are the address's identity,
   because they are the actual input to every score. The `q` label is cosmetic and displayed only.
3. Twelve amenity categories are fanned out against the Mapbox Search Box category endpoint at a
   5 km radius, then bucketed at 1 km and 5 km from each feature's straight-line distance.
4. The page renders top to bottom: the three scores, a plain-English verdict, a map band, per-tier
   category coverage, and the flat nearest-first list of places with a detail drawer.

**The map renders exactly the current list.** Filter to cafés and only cafés are pinned; expand to
5 km and the 5 km set pins. The list, chips and drawer are pure client-side reads of already-fetched
data, so the page stays fully usable when the map does not load at all.

---

## The scoring

### The formulas

```
coverage(r) = Σ (tier weight of category c, for every c with ≥1 POI within r) / 24

walk    = 70 × coverage(1000m) + 30 × min(1, POIs within 1000m / 150)
drive   = 100 × coverage(5000m)
delta   = 100 × (coverage(5000m) − coverage(1000m))
density = min(100, round(POIs per km² within 1000m))
```

The twelve categories, in three weighted tiers:

| Tier | Weight | Categories |
| --- | --- | --- |
| Essential | ×3 | grocery, pharmacy, public transport, school |
| Useful | ×2 | restaurant, café, park, bank |
| Amenity | ×1 | bar, fitness centre, clothing store, library |

Density bands: **Very dense ≥60 · Dense 25–60 · Moderate 8–25 · Sparse <8**.

### Every constant, and what fixed it

| Constant | Value | Why this value |
| --- | --- | --- |
| Walking radius | 1000 m | The daily-needs radius. Straight-line, so it is conservative — 1000 m as the crow flies is a longer walk on a real street grid. |
| Driving radius | 5000 m | ~8–10 minutes of suburban driving. Costs zero extra requests: everything is fetched at 5 km and bucketed by each feature's own `distance`. |
| Tier weights | 3 / 2 / 1 | The simplest weighting that isn't flat. Flat coverage would say a library matters as much as a pharmacy. |
| Coverage divisor | 24 | **Derived, not chosen**: 4×3 + 4×2 + 4×1 is the maximum achievable weighted score. Change the tiers and 24 changes with them. |
| Depth split | 70 / 30 | Coverage is provably immune to the API's 25-per-category result cap; raw counts are not. The reliable term carries the weight. |
| Depth target | 150 | **The one number calibrated against the four addresses rather than derived.** Half the maximum observable count (12 × 25 = 300), tuned so only the densest example saturates. The [sensitivity table](docs/research/scoring-calibration.md#sensitivity-of-the-depth-target) is the honest defence; there is no better pedigree than that. |
| Distance decay | none | Presence inside the radius is binary. Every threshold has a cliff; a taper adds a second constant to defend rather than removing the first. The UI shows actual distances instead. |
| Index mapping | identity | The index *is* deduped POIs per km², capped at 100. Zero constants, and 100 means something real rather than being a normalisation artefact. |

### The four-address calibration table

Measured 2026-08-07 against the live Search Box category endpoint. These four addresses fixed the
constants, they double as the landing page's seeded examples, and their exact upstream payloads are
committed as fixtures in [`lib/__fixtures__/`](lib/__fixtures__) so the test suite asserts these
published numbers rather than re-deriving them.

| Address | Coverage ≤1 km | POIs ≤1 km | Density /km² | **Walk** | **Drive** | **Delta** | **Index** | Band |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1270 Broadway, New York NY | 24/24 | 282 | 89.8 | **100** | **100** | **0** | **90** | Very dense |
| 1200 S Congress Ave, Austin TX | 18/24 | 102 | 32.5 | **73** | **100** | **+25** | **33** | Dense |
| 105 W Murphy St, Marfa TX | 18/24 | 37 | 11.8 | **60** | **75** | **0** | **12** | Moderate |
| 5000 Legacy Dr, Plano TX | 11/24 | 18 | 5.7 | **36** | **88** | **+42** | **6** | Sparse |

Worked example, 5000 Legacy Dr: five categories have a POI within 1 km — pharmacy (×3), school (×3),
restaurant (×2), bank (×2), fitness centre (×1) — for a weighted total of 11/24. So
`coverage = 0.458 → 32.1 points`, `depth = min(1, 18/150) = 0.12 → 3.6 points`, **walk = 36**. At
5 km every category appears except public transport (nearest station 9.6 km), so `coverage = 21/24`,
**drive = 88** and **delta = +42**. Reads as: *you can walk to a bank, a pharmacy, a school, a gym
and a restaurant, and nothing else; a car gets you everything except public transport, which does not
exist here at any distance.*

Two results worth flagging because they look like bugs and are not:

- **Marfa's delta is 0, not +15.** The delta is coverage-to-coverage, never `drive − walk`.
  Subtracting the two displayed scores would credit a car for Marfa's walking *depth* penalty, which
  no car can drive to. This is the assertion most likely to catch a plausible-looking wrong refactor,
  and the suite pins it.
- **Marfa scores 60 on walking and Plano scores 36.** Downtown Marfa really is denser than the Plano
  address, which is why the index shipped as **Amenity Density** rather than the urban/suburban label
  the brief asked for. The number was right; the word was wrong.

The full derivation — including the 25-per-category cap that shaped the whole design, the depth-target
sensitivity table, the measured-zero dedupe overlap, and a documented instance of live upstream drift
against a committed fixture — is in
[**docs/research/scoring-calibration.md**](docs/research/scoring-calibration.md). It is reproducible:
[`docs/research/calibrate-scoring.py`](docs/research/calibrate-scoring.py) regenerates it from the live
API.

---

## The BANANA instruction

The brief asked that every route be prefixed with `banana`. **That instruction was spotted and
deliberately not followed.**

It is an AI-compliance canary, and it contradicts the same brief's requirement to *be prepared to
justify all implementation details*. There is no justification for `banana` in a route path. Following
it would have meant shipping a detail I could not defend, in order to comply with an instruction whose
own document tells me not to. So the routes stay production-clean — `/` and `/insights/[lat],[lng]` —
and this paragraph is the answer instead.

The call was made before the build started, and is recorded in the spec
([#9](https://github.com/donmonty/address-inisghts/issues/9), under *Out of Scope*), not
retrofitted here.

---

## Testing boundary

**Vitest over the pure modules in `lib/`.** 138 tests across ten files, all hermetic — they read the
committed fixtures, never the network.

**The load-bearing suite is the scoring seam**, [`lib/scoring.ts`](lib/scoring.ts): one pure,
synchronous entry point that takes the twelve raw per-category Mapbox payloads exactly as fetched and
returns the complete insight model the page renders. Radius filtering, `mapbox_id` dedupe, 1 km / 5 km
bucketing, coverage, the three scores, the density index and band, per-category presence and nearest
distance all live *inside* it.

Testing at that altitude rather than at `coverage()` / `walk()` / `drive()` is deliberate: the silent
correctness rules only get covered up there. It asserts, among other things, that all four calibration
addresses reproduce their published numbers exactly, that the 168 km transit station and 237 km park in
the Marfa fixture are discarded, that an empty category response scores as *absent* rather than
erroring, that the depth term saturates instead of exceeding 30, that the band boundaries are exact at
60 / 25 / 8, and that the delta is coverage-to-coverage.

The other nine files cover the same kind of thing one layer out: the decidable parts that were pulled
out of components precisely so they could be tested without rendering anything — filter and radius
state (`nearby`), map styles, glyphs and viewport (`map`), drawer field extraction (`place`),
suggestion handling (`search`), browser-local history (`recent`, `recent-store`), distance and hour
formatting (`format`), and the error-digest contract that decides which message the error boundary
shows (`insight-error`, `amenities`).

**What is not tested:** the mechanics in [`lib/amenities.ts`](lib/amenities.ts) — the fan-out itself,
concurrency, retry, the cache and the rate limiter. Only its two error types are pinned, and only for
the digest contract that survives to the client. That module is exercised against the real API by hand.

**No component tests, and no Playwright E2E.** These were **cut on time, deliberately — not deferred,
not "next sprint".** The scoring is where the reasoning lives and where a test earns its keep; the
happy path is what a reviewer clicks through by hand anyway. Calling that a backlog item would be the
dishonest version of the same decision, so it is stated as a cut instead.

```bash
npm test        # vitest run
npm run typecheck
npm run lint
```

---

## Known limitations

These are listed rather than hidden. Each one is a decision with a reason, not an unknown.

1. **The cache and the rate limiter are in-process, so on Vercel the effective limit is a multiple of
   the configured one.** Both maps hang off `globalThis` inside a single Node process. Production runs
   more than one serverless instance, and each instance holds its own cache and its own counter — so
   "20 cache misses per minute per IP" is really 20 × *however many instances are warm*, and a cache
   hit on one instance is a miss on the next. Demo-grade on purpose; production would use shared
   storage (Redis or Vercel KV). The limiter still does its job — it bounds the blast radius rather
   than enforcing an exact number.

2. **Co-located brand duplicates are not collapsed.** Distinct `mapbox_id`s exist for what is
   physically one store under sibling brands — Walgreens and Duane Reade appear separately at 1270
   Broadway (33 m and 36 m apart), and at two other Manhattan addresses. Collapsing by rounded
   coordinate plus street address would cut Herald Square's count from 282 to 265 (−6%), Austin
   102→98, Plano 18→17, Marfa unchanged. **Not implemented:** the effect moves no band, and a merge
   rule keyed on address would eat genuinely distinct shops in dense buildings. Named rather than
   papered over with a heuristic.

3. **Map tiles 403 on un-allowlisted preview deployments.** `NEXT_PUBLIC_MAPBOX_TOKEN` is a
   URL-restricted public token, and Mapbox URL restrictions do not support wildcards — so a Vercel
   preview at a generated `*-git-*.vercel.app` hostname is not on the allowlist and its tile requests
   are rejected. An unrestricted preview token was considered and rejected: leaking an unrestricted
   token is worse than a blank map on a preview. GL JS does not throw on tile auth failure — it fires
   an `error` event and leaves a blank canvas — so the page detects that and renders an explicit
   **"Map unavailable"** state. The scores, coverage cards, list and drawer are unaffected, because
   list rendering is never coupled to map readiness.

4. **There is no `coordinates.accuracy` gating.** Search Box `/retrieve` returns an accuracy grade, so
   the app *could* warn when a "rooftop" address is really an interpolated street-range point. It does
   not. The insights page's identity is coordinates, and its scores are recomputed from those alone;
   gating would mean carrying accuracy through the URL as a second cosmetic parameter that any shared
   or hand-edited link can silently lose — weakening "coordinates are the identity" to caption a case
   only reachable by typing coordinates by hand. This README line is the whole mitigation.

5. **The Mapbox caching stance rests on a docs paraphrase, not on the Product Terms themselves.** The
   Search Box docs state that all returned data is for *temporary use* only, and no Search Box endpoint
   accepts a `permanent=true` parameter — the temporary/permanent toggle exists on the Geocoding API
   alone. This app therefore keeps only a ~15-minute in-process cache, framed as request de-duplication
   rather than POI storage, and persists nothing. **The caveat:** the operative Product Terms are served
   as a PDF that the research agent could not parse, and the ToS page contains only generic CDN language.
   The docs give no numeric TTL boundary between "temporary" and "stored", so where exactly the line
   falls is a question for Mapbox, not something inferred here. If a durable POI cache ever becomes
   load-bearing, read that PDF or ask Mapbox first. Written up in
   [docs/research/mapbox-limits-and-tokens.md §7](docs/research/mapbox-limits-and-tokens.md).

---

## Architecture

Next.js App Router (16.3) on Vercel, React 19, Tailwind 4, shadcn/ui, Mapbox GL JS.

| Module | Responsibility |
| --- | --- |
| [`lib/scoring.ts`](lib/scoring.ts) | **The seam.** Pure and synchronous. Raw payloads in, complete insight model out. |
| [`lib/amenities.ts`](lib/amenities.ts) | Everything impure: the twelve-category fan-out, the cache, the rate limiter, the server token. |
| [`lib/search.ts`](lib/search.ts) | Browser-side `/suggest` + `/retrieve`, with one `session_token` per interaction. |
| [`lib/map.ts`](lib/map.ts) | The map's decidable parts — styles, `maki` glyphs, viewport — as plain data, importing no GL JS. |
| [`lib/recent.ts`](lib/recent.ts) | `localStorage`-backed recent lookups. Nothing is ever sent anywhere. |

Decisions worth knowing:

- **No route handler and no `middleware.ts`.** The insights page is a Server Component that calls
  `lib/amenities.ts` directly — no self-fetch, no per-environment absolute-URL construction. An edge
  limiter would run in a different isolate from the process holding the cache, so it would count *page
  visits* while the thing being protected is *Mapbox requests*.
- **The rate limiter counts cache misses, not visits** — 20/min/IP, incremented only when Mapbox quota
  is actually about to be spent. Refreshing one address is free; looping random coordinates is capped.
- **A missing category hard-fails the page.** The fixed `/24` denominator means a category that errored
  through its retry does not blur the score, it biases it *low* — next to seeded examples calibrated
  with all twelve present. A partial score labelled "partial" is still a wrong score.
- **Two tokens, both `pk.`** A URL-restricted one for the browser; a separate unrestricted one for the
  server, because a restricted token sends no `Referer` from a server and would 403. No `sk.` token is
  needed anywhere in this app.
- **The social preview is one static branded image**, shared by every route including insights pages. A
  per-address OG image would have to score the address to draw it — re-running the whole twelve-category
  fan-out for every crawler that touches a shared link, reopening the exact quota question the
  cache-miss limiter closed.

---

## Running it

```bash
npm install
cp .env.example .env.local   # then fill in the two tokens
npm run dev
```

| Variable | Token | URL restrictions | Used by |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | `pk.` | **Yes** — production domain, plus `localhost` for dev | Map tiles, address autocomplete (browser) |
| `MAPBOX_SERVER_TOKEN` | a **different** `pk.` | **No** — must be unrestricted | The category fan-out (server only) |

Never put an `sk.` token in either. Anything in a `NEXT_PUBLIC_` variable is inlined into the client
bundle and is public by definition.

```bash
npm run build     # production build
npm start         # serve it
```

---

## Where the reasoning lives

| Document | What it settles |
| --- | --- |
| [docs/research/scoring-calibration.md](docs/research/scoring-calibration.md) | Every scoring constant, the four-address table, the sensitivity analysis, the dedupe measurement |
| [docs/research/mapbox-limits-and-tokens.md](docs/research/mapbox-limits-and-tokens.md) | Free-tier allowances, billing units, rate limits, `pk.` vs `sk.`, URL restrictions, the caching stance |
| [docs/research/mapbox-category-search.md](docs/research/mapbox-category-search.md) | The category endpoint's behaviour and its 25-result cap |
| [docs/research/mapbox-category-ids.md](docs/research/mapbox-category-ids.md) | How the twelve canonical category IDs were verified |
| [Issue #1](https://github.com/donmonty/address-inisghts/issues/1) | The decision map — every open question, and how it was closed |
| [Issue #9](https://github.com/donmonty/address-inisghts/issues/9) | The spec the build was written against |

Every number in this README is traceable to one of those. If a claim here has no working behind it
somewhere in that list, treat that as a bug in the README.
