#!/usr/bin/env python3
"""
Build the CPI-basket price snapshot JSON from per-chain basket exports.

Input  : data/baskets/*.csv  (and *.xlsx if openpyxl is installed) — committed
         source of truth. Each file is one chain's CPI-mapped basket on one date.
Output : data/basket_prices.json  (committed; imported by lib/basketData.js)

Drop a new dated export into data/baskets/ and re-run:

    python3 scripts/build_basket.py

The basket files are the stable, repeatable feed the portal is fed from (unlike
the one-off retail master, whose source catalogs no longer exist). Chains are
scraped on different days, so the "current" view takes each chain's MOST RECENT
date — a cross-sectional basket, not a single-day cut. `trend[]` keeps every date
so a time series accrues as the folder grows.

Schema handled (both variants — Spinneys: `stock`; Carrefour: `stock`+`stock_status`):
  source, cpi_code, cpi_item, code, name, product_name, brand, weight, item_unit,
  base_unit, stock|stock_status, price, discount_price, url, image_url,
  category_l1, category_l2, lebanon_category, date
"""
import csv, json, os, glob, re, statistics
from collections import defaultdict, Counter

BASKET_DIR = "data/baskets"
OUT = "data/basket_prices.json"


# ── Readers ───────────────────────────────────────────────────────────────────
def read_csv(path):
    with open(path, newline="", encoding="utf-8-sig", errors="replace") as f:
        yield from csv.DictReader(f)


def read_xlsx(path):
    try:
        import openpyxl
    except ModuleNotFoundError:
        raise SystemExit(
            f"\n{path} is an .xlsx but openpyxl is not installed.\n"
            f"Either `pip install openpyxl`, or open it in Excel and 'Save As' CSV\n"
            f"into {BASKET_DIR}/ and re-run. CSV is the guaranteed path.\n"
        )
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [str(c).strip() if c is not None else "" for c in next(rows)]
    for r in rows:
        yield {header[i]: ("" if v is None else str(v)) for i, v in enumerate(r)}


def read_any(path):
    return read_xlsx(path) if path.lower().endswith(".xlsx") else read_csv(path)


# ── Field helpers ─────────────────────────────────────────────────────────────
def num(v):
    try:
        f = float(str(v).replace(",", "").strip())
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None


def in_stock(row):
    ss = (row.get("stock_status") or "").strip().lower()
    if ss:
        return ss in ("instock", "lowstock", "in_stock", "low_stock")
    return str(row.get("stock", "")).strip().lower() in ("true", "1", "yes", "instock")


def split_category(raw):
    """'111 - Bread and Cereals' -> ('111', 'Bread and Cereals'). Robust to no dash."""
    s = (raw or "").strip()
    if " - " in s:
        code, name = s.split(" - ", 1)
        return code.strip(), name.strip()
    return "", s


def chain_of(row):
    return (row.get("source") or "").strip().title() or "Unknown"


def med(xs):
    return round(statistics.median(xs), 2) if xs else 0


def mean(xs):
    return round(statistics.mean(xs), 2) if xs else 0


# ── Size normalization ────────────────────────────────────────────────────────
# The feed is price-per-listed-product, so a 900g pack can't be compared to a
# 500g one directly. Parse the `weight` (with unit token where present, e.g.
# Carrefour "900G"/"1KG"/"500ML"; or a bare number in the base unit, e.g.
# Spinneys grams) into a base quantity + unit family so downstream code can
# compute a common-unit price ($/100g, $/100ml, $/piece) — apples-to-apples.
QTY_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilograms?|g|gr|grams?|mg|l|lt|ltr|liters?|litres?|ml|cl|cc|pcs|pc|pieces?)\b",
    re.I,
)
PACK_RE = re.compile(r"(\d+)\s*[x×]", re.I)


def parse_qty(weight):
    """Return (base_qty, family) where family in {mass, vol, count, None}.
    base_qty is grams (mass), ml (vol) or pieces (count). None if not derivable."""
    s = str(weight or "").strip().lower()
    if not s:
        return (None, None)
    pack = 1
    pm = PACK_RE.search(s)
    if pm:
        pack = int(pm.group(1)) or 1
    m = QTY_RE.search(s)
    if m:
        val = float(m.group(1).replace(",", "."))
        u = m.group(2).lower()
        if u.startswith(("kg", "kilogram")):
            fam, base = "mass", val * 1000
        elif u in ("g", "gr") or u.startswith("gram"):
            fam, base = "mass", val
        elif u == "mg":
            fam, base = "mass", val * 0.001
        elif u in ("l", "lt", "ltr") or u.startswith(("liter", "litre")):
            fam, base = "vol", val * 1000
        elif u == "cl":
            fam, base = "vol", val * 10
        elif u in ("ml", "cc"):
            fam, base = "vol", val
        elif u in ("pcs", "pc") or u.startswith("piece"):
            fam, base = "count", val
        else:
            return (None, None)
        base *= pack
        return (base, fam) if base > 0 else (None, None)
    # Bare number: treat as a base quantity in g/ml only when it's clearly one
    # (>= 20). Smaller bare numbers are ambiguous (kg / L / a count) — skip.
    try:
        v = float(s.replace(",", "")) * pack
    except ValueError:
        return (None, None)
    return (v, None) if v >= 20 else (None, None)


UNIT_LABEL = {"mass": "100g", "vol": "100ml", "count": "pc", None: "100u"}


# ── Parse every basket file ───────────────────────────────────────────────────
files = sorted(glob.glob(os.path.join(BASKET_DIR, "*.csv")) +
               glob.glob(os.path.join(BASKET_DIR, "*.xlsx")))
if not files:
    raise SystemExit(f"No basket files found in {BASKET_DIR}/ — nothing to build.")

records = []          # one normalized dict per priced row
for path in files:
    for row in read_any(path):
        price = num(row.get("price"))
        disc = num(row.get("discount_price"))
        eff = disc if disc is not None else price
        if eff is None:
            continue                                   # unpriced row — skip
        code, cat_name = split_category(row.get("lebanon_category"))
        bq, fam = parse_qty(row.get("weight"))
        records.append({
            "chain": chain_of(row),
            "date": (row.get("date") or "").strip(),
            "cpi_code": (row.get("cpi_code") or "").strip(),
            "cpi_item": (row.get("cpi_item") or "").strip(),
            "cat_code": code,
            "category": cat_name,
            "product": (row.get("product_name") or row.get("name") or "").strip(),
            "base_qty": bq,
            "family": fam,
            "price": round(eff, 2),
            "discounted": disc is not None and price is not None and disc < price,
            "in_stock": in_stock(row),
            "url": (row.get("url") or "").strip(),
            "img": (row.get("image_url") or "").strip(),
            "file": os.path.basename(path),
        })

if not records:
    raise SystemExit("Basket files parsed but contained no priced rows.")

all_dates = sorted({r["date"] for r in records if r["date"]})
chains = sorted({r["chain"] for r in records})
latest_date = all_dates[-1] if all_dates else ""

# Each chain's most recent scrape date -> the "current" cross-sectional basket.
chain_latest = {}
for r in records:
    if r["date"] and r["date"] > chain_latest.get(r["chain"], ""):
        chain_latest[r["chain"]] = r["date"]
current = [r for r in records if r["date"] == chain_latest.get(r["chain"])]


# ── Aggregate the current basket ──────────────────────────────────────────────
cur_prices = [r["price"] for r in current]

# Per category (latest): item count, overall median, per-chain median.
cat_rows = defaultdict(list)
cat_code = {}
for r in current:
    cat_rows[r["category"]].append(r)
    cat_code[r["category"]] = r["cat_code"]

categories = []
for name, rs in cat_rows.items():
    by_chain_prices = defaultdict(list)
    for r in rs:
        by_chain_prices[r["chain"]].append(r["price"])
    categories.append({
        "code": cat_code[name],
        "name": name,
        "items": len({r["cpi_code"] for r in rs}),
        "medianPrice": med([r["price"] for r in rs]),
        "byChain": {c: med(p) for c, p in sorted(by_chain_prices.items())},
    })
categories.sort(key=lambda c: c["code"] or c["name"])

# Per chain (each at its own latest date).
chain_list = []
for c in chains:
    rs = [r for r in current if r["chain"] == c]
    if not rs:
        continue
    chain_list.append({
        "name": c,
        "items": len({r["cpi_code"] for r in rs}),
        "medianPrice": med([r["price"] for r in rs]),
        "meanPrice": mean([r["price"] for r in rs]),
        "inStockRate": round(100 * sum(r["in_stock"] for r in rs) / len(rs), 1),
        "latestDate": chain_latest.get(c, ""),
    })
chain_list.sort(key=lambda x: -x["items"])

# Cheapest vs dearest chain per category (only where >=2 chains comparable).
cheapest = []
for c in categories:
    per = c["byChain"]
    if len(per) >= 2:
        winner = min(per, key=per.get)
        dearest = max(per, key=per.get)
        if per[winner] > 0 and winner != dearest:
            cheapest.append({
                "category": c["name"],
                "cheapest": winner, "cheapestPrice": per[winner],
                "dearest": dearest, "dearestPrice": per[dearest],
                "spreadPct": round(100 * (per[dearest] - per[winner]) / per[winner], 0),
            })
cheapest.sort(key=lambda x: -x["spreadPct"])

# Per CPI item: cheapest product per chain, cross-chain spread.
item_groups = defaultdict(list)
for r in current:
    item_groups[(r["cpi_code"], r["cpi_item"])].append(r)

items = []
for (code, item), rs in item_groups.items():
    by_chain = {}
    for r in rs:
        prev = by_chain.get(r["chain"])
        if prev is None or r["price"] < prev["price"]:
            by_chain[r["chain"]] = {
                "price": r["price"], "product": r["product"], "url": r["url"],
                "img": r["img"], "inStock": r["in_stock"], "discounted": r["discounted"],
                "base_qty": r["base_qty"], "family": r["family"],
            }
    prices = [v["price"] for v in by_chain.values()]
    lo, hi = min(prices), max(prices)

    # Common-unit (size-normalized) price per chain: $/100g, $/100ml or $/piece.
    fams = [v["family"] for v in by_chain.values() if v.get("family")]
    item_fam = Counter(fams).most_common(1)[0][0] if fams else None
    unit_by_chain = {}
    for ch, v in by_chain.items():
        bq = v.get("base_qty")
        if bq and bq > 0:
            up = v["price"] / bq if item_fam == "count" else v["price"] / bq * 100
            unit_by_chain[ch] = round(up, 3)
    ups = list(unit_by_chain.values())
    unit_spread = round(100 * (max(ups) - min(ups)) / min(ups)) if len(ups) >= 2 and min(ups) > 0 else None
    for v in by_chain.values():           # keep byChain schema lean
        v.pop("base_qty", None)
        v.pop("family", None)

    items.append({
        "code": code,
        "cpi_item": item,
        "category": rs[0]["category"],
        "min": lo,
        "median": med(prices),
        "spreadPct": round(100 * (hi - lo) / lo, 0) if lo > 0 and len(prices) >= 2 else 0,
        "unit": UNIT_LABEL[item_fam],
        "unitByChain": dict(sorted(unit_by_chain.items())),
        "unitSpreadPct": unit_spread,
        "byChain": dict(sorted(by_chain.items())),
    })
items.sort(key=lambda x: (x["code"]))

# Time series across every date (grows as the folder grows).
by_date = defaultdict(list)
for r in records:
    if r["date"]:
        by_date[r["date"]].append(r)
trend = []
for d in all_dates:
    rs = by_date[d]
    cat_med = defaultdict(list)
    for r in rs:
        cat_med[r["category"]].append(r["price"])
    trend.append({
        "date": d,
        "basketMedian": med([r["price"] for r in rs]),
        "chains": sorted({r["chain"] for r in rs}),
        "byCategory": {k: med(v) for k, v in sorted(cat_med.items())},
    })

out = {
    "meta": {
        "sourceFiles": [os.path.basename(p) for p in files],
        "dates": all_dates,
        "chains": chains,
        "chainDates": chain_latest,
        "rows": len(records),
        "currency": "USD",
        "latestDate": latest_date,
        "note": ("CPI-mapped retail basket across Lebanese chains. Chains are scraped on "
                 "different days, so the current view takes each chain's most recent date "
                 "(cross-sectional, not a single-day cut). Effective price uses the "
                 "discounted price where one is shown."),
    },
    "kpis": {
        "itemsTracked": len({r["cpi_code"] for r in current}),
        "chains": len(chain_list),
        "categories": len(categories),
        "latestDate": latest_date,
        "basketMedian": med(cur_prices),
        "basketMean": mean(cur_prices),
        "inStockRate": round(100 * sum(r["in_stock"] for r in current) / len(current), 1),
        "discountedSharePct": round(100 * sum(r["discounted"] for r in current) / len(current), 1),
    },
    "categories": categories,
    "chains": chain_list,
    "cheapestByCategory": cheapest,
    "items": items,
    "trend": trend,
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

k = out["kpis"]
print(f"Wrote {OUT}  ({os.path.getsize(OUT)} bytes)")
print(f"  files={len(files)}  rows={len(records)}  current-rows={len(current)}")
print(f"  chains={chains}  dates={all_dates}  latest={latest_date}")
print(f"  itemsTracked={k['itemsTracked']}  categories={k['categories']}")
print(f"  basketMedian=${k['basketMedian']}  inStock={k['inStockRate']}%  discounted={k['discountedSharePct']}%")
print(f"  cheapest-by-category rows={len(cheapest)}  trend-dates={len(trend)}")
