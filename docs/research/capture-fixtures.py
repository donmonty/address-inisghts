#!/usr/bin/env python3
"""Capture the scoring fixtures from the live Mapbox category endpoint.

Fetches the twelve locked categories at the four calibration addresses and
writes one JSON file per address into `lib/__fixtures__/`. Those files are
committed, so `lib/scoring.test.ts` is hermetic while still asserting against
the exact upstream payloads the published numbers came from.

Same four addresses, same twelve categories, same request shape as
`calibrate-scoring.py` — that script reports aggregates, this one preserves the
raw features.

Needs MAPBOX_SERVER_TOKEN in .env.local. Re-running overwrites the fixtures:
upstream data drifts, so expect the published numbers to need re-checking.
"""
import json, os, sys, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
OUT_DIR = os.path.join(ROOT, "lib", "__fixtures__")

TOKEN = None
for line in open(os.path.join(ROOT, ".env.local")):
    if line.startswith("MAPBOX_SERVER_TOKEN="):
        TOKEN = line.strip().split("=", 1)[1]
assert TOKEN, "MAPBOX_SERVER_TOKEN missing from .env.local"

# Kept in step with CATEGORY_IDS/TIERS in lib/scoring.ts (and TIERS in
# calibrate-scoring.py). Changing the category set means editing all three and
# recapturing — see docs/research/mapbox-category-ids.md.
CATS = [
    "grocery",
    "pharmacy",
    "public_transportation_station",
    "school",
    "restaurant",
    "cafe",
    "park",
    "bank",
    "bar",
    "fitness_center",
    "clothing_store",
    "library",
]

ADDRESSES = [
    ("herald-square", "1270 Broadway, New York, NY 10001"),
    ("s-congress", "1200 S Congress Ave, Austin, TX 78704"),
    ("marfa", "105 W Murphy St, Marfa, TX 79843"),
    ("plano", "5000 Legacy Dr, Plano, TX 75024"),
]


def get(url):
    with urllib.request.urlopen(url) as r:
        return json.load(r)


def geocode(q):
    url = "https://api.mapbox.com/search/searchbox/v1/forward?" + urllib.parse.urlencode(
        {"q": q, "access_token": TOKEN, "limit": 1, "country": "us"}
    )
    f = get(url)["features"][0]
    lon, lat = f["geometry"]["coordinates"]
    return lon, lat, f["properties"].get("full_address") or f["properties"]["name"]


def category(cat, lon, lat):
    url = f"https://api.mapbox.com/search/searchbox/v1/category/{cat}?" + urllib.parse.urlencode(
        {"access_token": TOKEN, "proximity": f"{lon},{lat}", "limit": 25, "language": "en"}
    )
    return get(url)["features"]


os.makedirs(OUT_DIR, exist_ok=True)
for slug, q in ADDRESSES:
    lon, lat, full = geocode(q)
    rec = {
        "query": q,
        "resolved": full,
        "lon": lon,
        "lat": lat,
        "byCategory": {cat: category(cat, lon, lat) for cat in CATS},
    }
    path = os.path.join(OUT_DIR, f"{slug}.json")
    with open(path, "w") as fh:
        json.dump(rec, fh, indent=1)
        fh.write("\n")
    print(f"done: {slug} -> {path}", file=sys.stderr)
