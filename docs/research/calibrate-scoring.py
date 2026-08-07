#!/usr/bin/env python3
"""Calibration probe for the Address Insights scoring constants.

Fetches the twelve locked categories at four reference addresses, then reports
the numbers the scoring constants have to be chosen against.
"""
import json, math, os, sys, urllib.parse, urllib.request

TOKEN = None
ENV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env.local")
for line in open(ENV):
    if line.startswith("MAPBOX_SERVER_TOKEN="):
        TOKEN = line.strip().split("=", 1)[1]
assert TOKEN

TIERS = {
    "essential": ["grocery", "pharmacy", "public_transportation_station", "school"],
    "useful": ["restaurant", "cafe", "park", "bank"],
    "amenity": ["bar", "fitness_center", "clothing_store", "library"],
}
CATS = [c for t in TIERS.values() for c in t]

ADDRESSES = [
    ("Herald Square, NYC", "1270 Broadway, New York, NY 10001"),
    ("South Congress, Austin", "1200 S Congress Ave, Austin, TX 78704"),
    ("Legacy Dr, Plano", "5000 Legacy Dr, Plano, TX 75024"),
    ("Marfa, TX", "105 W Murphy St, Marfa, TX 79843"),
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


def norm_key(p):
    """Collapse brand duplicates: same name-ish store at the same coordinates."""
    c = p["geometry"]["coordinates"]
    return (round(c[0], 4), round(c[1], 4), (p["properties"].get("address") or "").lower())


out = {}
for label, q in ADDRESSES:
    lon, lat, full = geocode(q)
    rec = {"query": q, "resolved": full, "lon": lon, "lat": lat, "cats": {}}
    pois = {}          # mapbox_id -> (distance, name)
    coloc = {}         # coordinate/address key -> min distance
    for cat in CATS:
        feats = category(cat, lon, lat)
        ds = sorted(f["properties"].get("distance", 10**9) for f in feats)
        rec["cats"][cat] = {
            "returned": len(feats),
            "nearest": ds[0] if ds else None,
            "furthest": ds[-1] if ds else None,
            "n800": sum(1 for d in ds if d <= 800),
            "n1000": sum(1 for d in ds if d <= 1000),
            "n5000": sum(1 for d in ds if d <= 5000),
            "capped": len(feats) >= 25,
        }
        for f in feats:
            p = f["properties"]
            d = p.get("distance", 10**9)
            pois.setdefault(p["mapbox_id"], (d, p.get("name", ""), norm_key(f)))

    for radius in (800, 1000, 5000):
        ids = {k: v for k, v in pois.items() if v[0] <= radius}
        colo = {v[2] for v in ids.values()}
        area = math.pi * (radius / 1000.0) ** 2
        rec[f"dedup{radius}"] = {
            "by_mapbox_id": len(ids),
            "by_location": len(colo),
            "density_id_per_km2": round(len(ids) / area, 1),
            "density_loc_per_km2": round(len(colo) / area, 1),
        }
    out[label] = rec
    print(f"done: {label}", file=sys.stderr)

json.dump(out, open(os.path.join(os.path.dirname(__file__), "calibration.json"), "w"), indent=1)
print("written")
