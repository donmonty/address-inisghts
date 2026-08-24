# Dencity

**Score any address.**

Type an address, get walking, driving and amenity-density scores for that exact point. Every score decomposes into the twelve amenity categories that produced it,
and every place behind those categories is listed with its distance, hours, and a directions link.

Live: <https://getdencity.com/>

---

## Contents

- [What it does](#what-it-does)
- [The scoring](#the-scoring)
- [Architecture](#architecture)

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
| Depth split | 70 / 30 | Coverage is probably immune to the API's 25-per-category result cap; raw counts are not. The reliable term carries the weight. |
| Depth target | 150 | **The one number calibrated against the four addresses rather than derived.** Half the maximum observable count (12 × 25 = 300), tuned so only the densest example saturates. |
| Index mapping | identity | The index is POIs per km², capped at 100. |

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


