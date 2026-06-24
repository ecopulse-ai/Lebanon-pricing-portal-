#!/usr/bin/env python3
"""
Build a compact, strategic analytics snapshot from the raw retail price scrape.

Input  : standardized_master_enriched.csv  (~133k rows, ~47MB — NOT committed)
Output : data/retail_snapshot.json         (small, pre-aggregated, committed)

The raw file is a cross-sectional snapshot of Lebanese retail shelves across four
chains. There is no usable time series (chains were scraped on different days), so
every metric here is positional: who is cheap, what is stocked, where goods come
from. Run from the repo root:

    python3 scripts/build_snapshot.py /path/to/standardized_master_enriched.csv
"""
import csv, json, sys, statistics
from collections import Counter, defaultdict

SRC = sys.argv[1] if len(sys.argv) > 1 else "standardized_master_enriched.csv"
OUT = "data/retail_snapshot.json"

# ── Canonicalize 160 retailer-specific category labels into strategic groups ──
# Order matters: first matching rule wins. Keywords are matched lowercased.
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
# Non-food / lifestyle catch-alls handled before the final "Other".
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

def norm_brand(b):
    b = (b or "").strip().rstrip(".").strip()
    return b.title() if b else ""

# ── Pass over the file ────────────────────────────────────────────────────────
rows = 0
dates = Counter()
retailers = defaultdict(lambda: {"n": 0, "prices": [], "instock": 0})
cat_n = Counter()
cat_prices = defaultdict(list)
cat_ret_prices = defaultdict(lambda: defaultdict(list))   # canon -> retailer -> [price]
origins = Counter()
origin_rows = 0
brands = Counter()
all_prices = []
bands = Counter()
raw_cat_count = set()
cat_origin = defaultdict(Counter)   # canonical category -> origin country -> count

def band(p):
    if p < 1:  return "<$1"
    if p < 2:  return "$1–2"
    if p < 5:  return "$2–5"
    if p < 10: return "$5–10"
    if p < 20: return "$10–20"
    return "$20+"

with open(SRC, newline="", encoding="utf-8", errors="replace") as f:
    for row in csv.DictReader(f):
        rows += 1
        raw_cat_count.add(row["category_top"])
        dates[row["date"]] += 1
        ret = row["retailer"]
        c = canon(row["category_top"])
        d = retailers[ret]; d["n"] += 1
        if row["in_stock"] == "True":
            d["instock"] += 1
        cat_n[c] += 1
        try:
            p = float(row["price_usd"])
        except (TypeError, ValueError):
            p = None
        if p is not None and p > 0:
            d["prices"].append(p)
            cat_prices[c].append(p)
            cat_ret_prices[c][ret].append(p)
            all_prices.append(p)
            bands[band(p)] += 1
        o = (row["origin_probable"] or "").strip()
        if o:
            origins[o] += 1; origin_rows += 1
            cat_origin[c][o] += 1            # category -> origin -> count
        b = norm_brand(row["brand"])
        if b:
            brands[b] += 1

def med(xs): return round(statistics.median(xs), 2) if xs else 0
def mean(xs): return round(statistics.mean(xs), 2) if xs else 0
n_in = sum(d["instock"] for d in retailers.values())

# ── Assemble output ───────────────────────────────────────────────────────────
band_order = ["<$1", "$1–2", "$2–5", "$5–10", "$10–20", "$20+"]

ret_list = sorted(
    ({
        "name": k,
        "products": v["n"],
        "medianPrice": med(v["prices"]),
        "meanPrice": mean(v["prices"]),
        "inStockRate": round(100 * v["instock"] / v["n"], 1) if v["n"] else 0,
    } for k, v in retailers.items()),
    key=lambda x: -x["products"],
)

cat_list = sorted(
    ({
        "name": k,
        "products": cat_n[k],
        "sharePct": round(100 * cat_n[k] / rows, 1),
        "medianPrice": med(cat_prices[k]),
    } for k in cat_n),
    key=lambda x: -x["products"],
)

# Cheapest chain per category — only where ≥2 chains carry ≥30 items (comparable).
cheapest = []
for c in cat_list:
    name = c["name"]
    per = {r: med(p) for r, p in cat_ret_prices[name].items() if len(p) >= 30}
    if len(per) >= 2:
        winner = min(per, key=per.get)
        dearest = max(per, key=per.get)
        cheapest.append({
            "category": name,
            "cheapest": winner, "cheapestPrice": per[winner],
            "dearest": dearest, "dearestPrice": per[dearest],
            "spreadPct": round(100 * (per[dearest] - per[winner]) / per[winner], 0),
            "byRetailer": per,
        })
cheapest.sort(key=lambda x: -x["spreadPct"])

ORIGIN_TOP = 12
origin_common = origins.most_common(ORIGIN_TOP)
origin_list = [{"name": k, "products": v, "sharePct": round(100 * v / origin_rows, 1)}
               for k, v in origin_common]
other = origin_rows - sum(v for _, v in origin_common)
if other > 0:
    origin_list.append({"name": "Other countries", "products": other,
                        "sharePct": round(100 * other / origin_rows, 1)})

out = {
    "meta": {
        "source": "standardized_master_enriched.csv",
        "snapshotDates": sorted(dates),
        "rows": rows,
        "rawCategories": len(raw_cat_count),
        "currency": "USD",
        "note": ("Cross-sectional shelf snapshot across four Lebanese chains. "
                 "Chains were collected on different days, so figures are positional "
                 "(price level, availability, sourcing) — not a time series."),
    },
    "kpis": {
        "products": rows,
        "retailers": len(retailers),
        "categories": len(cat_n),
        "originCountries": len(origins),
        "medianPrice": med(all_prices),
        "meanPrice": mean(all_prices),
        "inStockRate": round(100 * n_in / rows, 1),
        "tracedToOriginPct": round(100 * origin_rows / rows, 1),
    },
    "retailers": ret_list,
    "categories": cat_list,
    "cheapestByCategory": cheapest,
    "origins": origin_list,
    "priceBands": [{"name": b, "count": bands[b],
                    "sharePct": round(100 * bands[b] / sum(bands.values()), 1)}
                   for b in band_order if bands[b]],
    "topBrands": [{"name": k, "products": v} for k, v in brands.most_common(12)],
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"Wrote {OUT}")
print(f"  rows={rows}  retailers={len(retailers)}  canon categories={len(cat_n)}  origins={len(origins)}")
print(f"  median=${out['kpis']['medianPrice']}  inStock={out['kpis']['inStockRate']}%")
print(f"  cheapest-by-category rows={len(cheapest)}")

# ══ Trade & shipping dependency ════════════════════════════════════════════════
# Lebanon imports almost everything by sea through Beirut/Tripoli. We model two
# strategic risks from the country-of-origin signal:
#   1. Single-source concentration — how much of a category leans on one country.
#   2. Chokepoint exposure — which maritime route each origin must transit.
OUT2 = "data/trade_dependency.json"

# Each origin's maritime route to the Eastern Mediterranean, its bloc, and the
# chokepoints a shipment must clear. Origins not listed fall back to direct Med.
ROUTE = {
    "Türkiye":        {"bloc": "Türkiye",          "route": "Direct East Med",      "choke": []},
    "Egypt":          {"bloc": "MENA",             "route": "Direct East Med",      "choke": []},
    "France":         {"bloc": "Europe & UK",      "route": "Across Mediterranean", "choke": []},
    "Ireland":        {"bloc": "Europe & UK",      "route": "Atlantic → Gibraltar", "choke": ["Gibraltar"]},
    "United Kingdom": {"bloc": "Europe & UK",      "route": "Atlantic → Gibraltar", "choke": ["Gibraltar"]},
    "Belgium":        {"bloc": "Europe & UK",      "route": "Atlantic → Gibraltar", "choke": ["Gibraltar"]},
    "Netherlands":    {"bloc": "Europe & UK",      "route": "Atlantic → Gibraltar", "choke": ["Gibraltar"]},
    "Germany":        {"bloc": "Europe & UK",      "route": "Atlantic → Gibraltar", "choke": ["Gibraltar"]},
    "Denmark":        {"bloc": "Europe & UK",      "route": "Atlantic → Gibraltar", "choke": ["Gibraltar"]},
    "Italy":          {"bloc": "Europe & UK",      "route": "Across Mediterranean", "choke": []},
    "Czechia":        {"bloc": "Europe & UK",      "route": "Atlantic → Gibraltar", "choke": ["Gibraltar"]},
    "Hungary":        {"bloc": "Europe & UK",      "route": "Adriatic → Med",       "choke": []},
    "Romania":        {"bloc": "Europe & UK",      "route": "Black Sea → Bosphorus","choke": ["Bosphorus"]},
    "Ukraine":        {"bloc": "Europe & UK",      "route": "Black Sea → Bosphorus","choke": ["Bosphorus"]},
    "Morocco":        {"bloc": "MENA",             "route": "Across Mediterranean", "choke": []},
    "United States":  {"bloc": "Americas",         "route": "Atlantic → Gibraltar", "choke": ["Gibraltar"]},
    "Brazil":         {"bloc": "Americas",         "route": "Atlantic → Gibraltar", "choke": ["Gibraltar"]},
    "Saudi Arabia":   {"bloc": "Gulf & Asia",      "route": "Red Sea → Suez",       "choke": ["Suez"]},
    "Iraq":           {"bloc": "Gulf & Asia",      "route": "Gulf → Hormuz → Suez", "choke": ["Hormuz", "Bab-el-Mandeb", "Suez"]},
    "Oman":           {"bloc": "Gulf & Asia",      "route": "Hormuz → Suez",        "choke": ["Hormuz", "Bab-el-Mandeb", "Suez"]},
    "India":          {"bloc": "Gulf & Asia",      "route": "Arabian Sea → Suez",   "choke": ["Bab-el-Mandeb", "Suez"]},
    "Sri Lanka":      {"bloc": "Gulf & Asia",      "route": "Indian Ocean → Suez",  "choke": ["Bab-el-Mandeb", "Suez"]},
    "Thailand":       {"bloc": "Gulf & Asia",      "route": "Malacca → Suez",       "choke": ["Malacca", "Bab-el-Mandeb", "Suez"]},
    "China":          {"bloc": "Gulf & Asia",      "route": "Malacca → Suez",       "choke": ["Malacca", "Bab-el-Mandeb", "Suez"]},
}
DEFAULT_ROUTE = {"bloc": "Other", "route": "Across Mediterranean", "choke": []}

def route_of(country):
    return ROUTE.get(country, DEFAULT_ROUTE)

# Per-category single-source concentration (the nodes of the dependency map).
dep_cats = []
for c in cat_list:
    name = c["name"]
    dist = cat_origin[name]
    total = sum(dist.values())
    if total < 50:                       # too thin to characterize sourcing
        continue
    top3 = dist.most_common(3)
    lead, lead_n = top3[0]
    dep_cats.append({
        "name": name,
        "tracedItems": total,
        "topSource": lead,
        "topShare": round(100 * lead_n / total, 1),
        "top3": [{"name": k, "sharePct": round(100 * v / total, 1)} for k, v in top3],
        "medianPrice": c["medianPrice"],
    })
dep_cats.sort(key=lambda x: -x["topShare"])

# Per-country supplier power: the categories a country supplies and its grip on each.
countries = []
for country, total_c in origins.most_common():
    if total_c < 200:
        continue
    r = route_of(country)
    supplies = []
    for name, dist in cat_origin.items():
        n = dist.get(country, 0)
        cat_total = sum(dist.values())
        if n >= 25 and cat_total:
            supplies.append({
                "category": name,
                "items": n,
                "gripPct": round(100 * n / cat_total, 1),   # country's share of that category
            })
    supplies.sort(key=lambda x: -x["items"])
    dominant = sum(1 for s in supplies if s["gripPct"] >= 50)
    monopolies = sum(1 for s in supplies if s["gripPct"] >= 80)
    countries.append({
        "name": country,
        "products": total_c,
        "sharePct": round(100 * total_c / origin_rows, 1),
        "bloc": r["bloc"],
        "route": r["route"],
        "chokepoints": r["choke"],
        "dominantCategories": dominant,
        "monopolyCategories": monopolies,
        "supplies": supplies[:14],
    })

# Bloc and chokepoint exposure (share of traced imports).
bloc = Counter()
choke = Counter()
for country, n in origins.items():
    r = route_of(country)
    bloc[r["bloc"]] += n
    for ch in r["choke"]:
        choke[ch] += n
bloc_list = sorted(({"name": k, "products": v, "sharePct": round(100 * v / origin_rows, 1)}
                    for k, v in bloc.items()), key=lambda x: -x["products"])
choke_list = sorted(({"name": k, "products": v, "sharePct": round(100 * v / origin_rows, 1)}
                     for k, v in choke.items()), key=lambda x: -x["products"])

# Top-supplier concentration across the whole basket.
lead_country, lead_n = origins.most_common(1)[0]

dep = {
    "meta": out["meta"],
    "totals": {
        "tracedItems": origin_rows,
        "tracedPct": out["kpis"]["tracedToOriginPct"],
        "countries": len(origins),
        "categories": len(dep_cats),
        "topSupplier": lead_country,
        "topSupplierShare": round(100 * lead_n / origin_rows, 1),
        "suezSharePct": next((x["sharePct"] for x in choke_list if x["name"] == "Suez"), 0),
        "concentratedCategories": sum(1 for c in dep_cats if c["topShare"] >= 50),
    },
    "categories": dep_cats,
    "countries": countries,
    "blocs": bloc_list,
    "chokepoints": choke_list,
}

with open(OUT2, "w", encoding="utf-8") as f:
    json.dump(dep, f, ensure_ascii=False, indent=2)

print(f"Wrote {OUT2}")
print(f"  countries={len(countries)}  dep-categories={len(dep_cats)}")
print(f"  top supplier={lead_country} {dep['totals']['topSupplierShare']}%  Suez exposure={dep['totals']['suezSharePct']}%")
print(f"  blocs={[ (b['name'], b['sharePct']) for b in bloc_list ]}")
