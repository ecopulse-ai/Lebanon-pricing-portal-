#!/usr/bin/env python3
"""
Build the searchable product catalogue from the raw scrape.

Input  : standardized_master_enriched.csv  (~133k listings — NOT committed)
Output : data/products.json                 (distinct products, committed)

Listings are grouped into distinct products (by name + brand; the product name
already carries the pack size). For each product we keep a price RANGE across
all outlets — never the outlet names — plus brand, category, origin, image and
stock. Run from the repo root:

    python3 scripts/build_products.py /path/to/standardized_master_enriched.csv
"""
import csv, json, sys, statistics
from collections import defaultdict, Counter

SRC = sys.argv[1] if len(sys.argv) > 1 else "standardized_master_enriched.csv"
OUT = "data/products.json"

# ── Canonical category mapping (kept in sync with build_snapshot.py) ──────────
RULES = [
    ("Fresh Produce",        ["fruit", "vegetable", "produce", "herb", "veg "]),
    ("Meat & Fish",          ["meat", "poultry", "chicken", "fish", "shrimp", "cold cut", "deli"]),
    ("Dairy & Eggs",         ["dairy", "egg", "cheese", "milk", "creamer", "butter"]),
    ("Bakery",               ["bakery", "bread", "cake", "croissant", "baked", "pastr"]),
    ("Frozen",               ["frozen", "ice cream"]),
    ("Snacks & Sweets",      ["snack", "chocolate", "chip", "cracker", "wafer", "biscuit",
                              "candy", "gum", "pop corn", "popcorn", "confection", "nuts",
                              "kernel", "sweet"]),
    ("Beverages",            ["beverage", "coffee", "tea", "juice", "water", "drink", "infusion"]),
    ("Alcohol",              ["alcohol", "wine", "beer", "spirit"]),
    ("Tobacco",              ["tobacco", "tobacoo", "cigar"]),
    ("Baby & Child",         ["baby", "child", "diaper"]),
    ("Personal Care & Beauty",["personal care", "beauty", "shampoo", "bath", "hair",
                              "deodorant", "tooth", "soap", "men's care", "women's care",
                              "conditioner", "condtioner", "handwash", "wipes", "sanitiz",
                              "cotton", "health & fitness", "fitness"]),
    ("Home & Cleaning",      ["home care", "cleaning", "household", "laundry", "detergent",
                              "paper", "plastic", "kitchen", "tissue", "napkin", "disinfect",
                              "disposable", "dishwash", "surface", "floor", "bathroom",
                              "insecticide", "coal", "gas", "battery", "batteries"]),
    ("Pet Care",             ["pet", "cat food", "dog"]),
    ("Electronics & Appliances",["electronic", "appliance", "phone", "automotive", "electric"]),
    ("Grocery & Pantry",     ["grocery", "cupboard", "can", "rice", "pasta", "noodle", "sugar",
                              "oil", "ghee", "bak", "season", "condiment", "sauce", "spread",
                              "breakfast", "cereal", "world food", "grain", "seed", "flour",
                              "soup", "spice", "organic", "healthy", "bio", "ramadan",
                              "lebanese coffee"]),
]
LIFESTYLE = ["toy", "stationery", "school", "fashion", "accessor", "luggage",
             "garden", "outdoor", "kitchenware", "kitchen tools", "kitchen accessor",
             "kitchen supplies", "party"]

def canon(raw):
    s = (raw or "").lower()
    for name, kws in RULES:
        if any(k in s for k in kws):
            return name
    if any(k in s for k in LIFESTYLE):
        return "Home & Living"
    return "Other / Mixed"

def title_brand(b):
    b = (b or "").strip().rstrip(".").strip()
    return b.title() if b else ""

# ── Group listings into distinct products ─────────────────────────────────────
groups = {}
rows = 0
with open(SRC, newline="", encoding="utf-8", errors="replace") as f:
    for row in csv.DictReader(f):
        name = (row["product_name"] or "").strip()
        if not name:
            continue
        rows += 1
        brand = title_brand(row["brand"])
        key = (" ".join(name.lower().split()), brand.lower())
        g = groups.get(key)
        if g is None:
            g = groups[key] = {
                "names": Counter(), "brand": brand,
                "cat": canon(row["category_top"]),
                "prices": [], "imgs": [], "origins": Counter(),
                "units": Counter(), "instock": 0, "listings": 0,
            }
        g["listings"] += 1
        g["names"][name] += 1
        try:
            p = float(row["price_usd"])
            if p > 0:
                g["prices"].append(p)
        except (TypeError, ValueError):
            pass
        if row["img"]:
            g["imgs"].append(row["img"])
        o = (row["origin_probable"] or "").strip()
        if o:
            g["origins"][o] += 1
        u = (row["qty_unit_raw"] or "").strip()
        if u:
            g["units"][u] += 1
        if row["in_stock"] == "True":
            g["instock"] += 1

# ── Emit compact products ─────────────────────────────────────────────────────
products = []
for (name_key, _brand_key), g in groups.items():
    if not g["prices"]:
        continue
    ps = sorted(g["prices"])
    name = g["names"].most_common(1)[0][0]
    products.append({
        "id": None,  # assigned after sort
        "name": name,
        "brand": g["brand"],
        "cat": g["cat"],
        "min": round(ps[0], 2),
        "max": round(ps[-1], 2),
        "med": round(statistics.median(ps), 2),
        "n": g["listings"],
        "origin": g["origins"].most_common(1)[0][0] if g["origins"] else "",
        "unit": g["units"].most_common(1)[0][0] if g["units"] else "",
        "img": g["imgs"][0] if g["imgs"] else "",
        "stock": g["instock"] > 0,
    })

# Most-listed products first (a sensible default order), then assign stable ids.
products.sort(key=lambda x: (-x["n"], x["name"].lower()))
for i, p in enumerate(products):
    p["id"] = i

cats = sorted({p["cat"] for p in products})
out = {
    "meta": {
        "source": "standardized_master_enriched.csv",
        "listings": rows,
        "products": len(products),
        "categories": cats,
        "currency": "USD",
    },
    "products": products,
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

print(f"Wrote {OUT}")
print(f"  listings={rows}  distinct products={len(products)}  categories={len(cats)}")
import os
print(f"  size={os.path.getsize(OUT) / 1e6:.1f} MB")
