# Scoring calibration

Empirical calibration of the scoring constants, run 2026-08-07 against the live Mapbox Search Box
category endpoint using the twelve canonical category IDs locked in
[mapbox-category-ids.md](mapbox-category-ids.md). Resolves
[Fix the scoring constants: radii, tier weights, and band boundaries](https://github.com/donmonty/address-inisghts/issues/4).

Reproduce with [`calibrate-scoring.py`](calibrate-scoring.py) (needs `MAPBOX_SERVER_TOKEN` in `.env.local`).

## The formulas

```
coverage(r) = Σ (tier weight of category c, for every c with ≥1 POI within r) / 24

walk  = 70 × coverage(1000m) + 30 × min(1, POIs within 1000m / 150)
drive = 100 × coverage(5000m)
delta = 100 × (coverage(5000m) − coverage(1000m))

amenity density index = min(100, round(POIs per km² within 1000m))
```

Tier weights: **essential 3, useful 2, amenity 1**. Four categories per tier, so the maximum weighted
score is `4×3 + 4×2 + 4×1 = 24` — the divisor is derived from the category set, not chosen. Change the
tiers and 24 changes with them.

Distances are straight-line, from each feature's `distance` property. No street-network routing.

## The constants and why

| Constant | Value | Justification |
| --- | --- | --- |
| Walking radius | 1000m | The daily-needs radius. Straight-line, so it is conservative — a crow-flies 1000m is a longer walk on a real street grid. |
| Driving radius | 5000m | ~8–10 minutes of suburban driving. Costs zero extra requests: everything is fetched at 5km and bucketed by each feature's `distance`. |
| Tier weights | 3 / 2 / 1 | The simplest weighting that isn't flat. Flat coverage would say a library matters as much as a pharmacy. |
| Coverage divisor | 24 | Derived: the maximum achievable weighted score. |
| Depth split | 70 / 30 | Coverage is provably immune to the API's result cap; counts are not (see below). The reliable term carries the weight. |
| Depth target | 150 | Half the maximum observable count (12 categories × 25 cap = 300). Calibrated so only the densest example saturates — see the sensitivity table. |
| Distance decay | none | Presence inside the radius is binary. Every threshold has a cliff; adding a taper adds a second constant to defend rather than removing the first. The UI shows actual distances instead. |
| Index mapping | identity | The index *is* deduped POIs per km², capped at 100. Zero constants, and 100 means something real rather than being a normalization artifact. |

## The 25-per-category cap

`/search/searchbox/v1/category/{id}` takes a `limit` that maxes at **25**, with **no pagination, no
offset, and no total count**. You get the 25 nearest, ordered by distance. This is the single fact that
shaped the whole design.

At Herald Square, 10 of 12 categories returned a full 25, several within a few hundred metres:

| Category | Returned | Furthest |
| --- | --- | --- |
| restaurant | 25 | 119m |
| clothing_store | 25 | 146m |
| bank | 25 | 254m |
| grocery | 25 | 443m |
| pharmacy | 25 | 526m |

So 282 POIs within 1km at Herald Square is a **floor, not a count**. The ceiling on what is observable
anywhere is 12 × 25 = 300.

**Coverage is exact regardless.** Results are nearest-first, so: fewer than 25 returned means the list is
complete; 25 returned with the nearest inside the radius is a definite yes; 25 returned with the nearest
outside the radius means nothing closer exists, a definite no. Presence is never wrong. Counts are floors
in dense areas — which is why depth is capped with `min(1, …)` (saturation is intended, not an error),
why the density index caps at 100, and why the driving score drops the count term entirely: at 5km every
non-rural address sits near the 300 ceiling, so a count term there measures the API, not the place.

## Calibration addresses and results

| Address | Coverage ≤1km | POIs ≤1km | Density /km² | **Walk** | **Drive** | **Delta** | **Index** | Band |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1270 Broadway, New York NY | 24/24 | 282 | 89.8 | **100** | **100** | **0** | **90** | Very dense |
| 1200 S Congress Ave, Austin TX | 18/24 | 102 | 32.5 | **73** | **100** | **+25** | **33** | Dense |
| 105 W Murphy St, Marfa TX | 18/24 | 37 | 11.8 | **60** | **75** | **0** | **12** | Moderate |
| 5000 Legacy Dr, Plano TX | 11/24 | 18 | 5.7 | **36** | **88** | **+42** | **6** | Sparse |

These four double as the landing page's seeded examples.

### Worked example: 5000 Legacy Dr, Plano

Five categories have at least one POI within 1km: pharmacy (3 found, weight 3), school (3, weight 3),
restaurant (3, weight 2), bank (5, weight 2), fitness_center (4, weight 1) — weighted total **11/24**.

- coverage(1km) = 11/24 = 0.458 → 32.1 points
- depth = min(1, 18/150) = 0.12 → 3.6 points
- **walk = 36**

At 5km every category appears except `public_transportation_station` — nearest station 9.6km — so
coverage(5km) = 21/24 = 0.875 → **drive = 88**, **delta = +42**.

Reads as: *you can walk to a bank, a pharmacy, a school, a gym and a restaurant, and nothing else; a car
gets you everything except public transport, which does not exist here at any distance.*

## Sensitivity of the depth target

Depth points (of 30) at each candidate target:

| Target | NYC | Austin | Marfa | Plano |
| --- | --- | --- | --- | --- |
| 100 | 30.0 (max) | **30.0 (max)** | 11.1 | 5.4 |
| **150** | **30.0 (max)** | **20.4** | **7.4** | **3.6** |
| 200 | 30.0 (max) | 15.3 | 5.6 | 2.7 |

At 100, South Congress saturates alongside Manhattan — plainly wrong. At 200 the spread compresses and
Marfa and Plano converge. 150 is where only the densest example maxes out.

**This is the one number calibrated against four addresses rather than derived.** If challenged, the
honest answer is this table, not a fake pedigree.

## Why the index is not called "urban/suburban"

The brief asked for an urban/suburban index. Measuring it showed **downtown Marfa (density 11.8) is denser
than suburban Plano (5.7)** — and on walkability Marfa scores 60 against Plano's 36. That is *true*:
Marfa's town centre has a grocery, pharmacy, restaurant, café, park, bank, bar, gym, clothing store and
library within 1km, and the Plano address has a bank and some schools. But it makes *urban* the wrong word
for what the number measures.

Shipped as **Amenity Density** with bands **Very dense ≥60 · Dense 25–60 · Moderate 8–25 · Sparse <8**,
plus a plain-English line doing the settlement-type translation in prose rather than in a label.

The alternative considered and rejected: keep the urban/suburban labels and add a 5km rural override
(deduped POIs within 5km < 100 forces "Rural"), which would have demoted Marfa. Rejected as a second
constant propping up a word that was wrong anyway.

## Dedupe: measured, and it is a no-op

The map recorded dedupe by `mapbox_id` as **load-bearing**, on the theory that hierarchical
`poi_category_ids` makes one café arrive under several categories. **Measured overlap is exactly zero** at
all four addresses, at both radii:

| Address | r=1km raw / deduped | r=5km raw / deduped |
| --- | --- | --- |
| Herald Square | 282 / 282 | 300 / 300 |
| S Congress | 102 / 102 | 281 / 281 |
| Legacy Dr | 18 / 18 | 249 / 249 |
| Marfa | 37 / 37 | 41 / 41 |

The category endpoint returns each POI under the category queried, and the 25-cap means the nearest-25 sets
do not collide. The `Set` stays in the code as one line of free insurance, but it is a documented no-op,
not a load-bearing mechanism.

### Known limitation: co-located brand duplicates

Distinct `mapbox_id`s exist for the same physical store under sibling brands — Walgreens and Duane Reade
appear separately at 1270 Broadway (33m and 36m), at 333 7th Ave, and at 777 6th Ave. Collapsing by
rounded coordinate + street address would cut Herald Square's count from 282 to 265 (−6%), Austin 102→98,
Plano 18→17, Marfa unchanged.

**Not implemented.** The effect moves no band, and a merge rule keyed on address would eat genuinely
distinct shops in dense buildings. Named as a limitation rather than papered over with a heuristic.

## Other findings

- **Unfiltered results reach absurd distances.** Marfa returned a transit station at 168km and a park at
  237km. Radius filtering is correctness, not optimization.
- **`school` can return zero.** Marfa returned no results at all for `school`, and one transit station at
  168km. Sparse-address handling must tolerate empty category responses.
- **The delta is coverage-to-coverage, not a subtraction of the two displayed scores.** Subtracting walk
  from drive would give Marfa +15, an artifact of Marfa's walking depth penalty rather than anything a car
  reaches. Coverage-to-coverage correctly gives Marfa **0**: there is nothing to drive to either.
