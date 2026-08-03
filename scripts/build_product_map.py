#!/usr/bin/env python3
"""
Extend data/productMap.json to full-catalog scale using the Anthropic API.

WHY THIS EXISTS: the map currently shipped in data/productMap.json is a
hand-reviewed SEED, not full coverage. It was built by taking the products
buildProducts.js's algorithm can NEVER link (no parseable pack size in the
title — ~14,700 of ~30,200 distinct products in the 2026-07-31 snapshot),
narrowing to same-category cross-retailer pairs with loose name-token overlap
(>=0.9 Dice coefficient, ~218 candidates), and reviewing every one by hand
(80 initially accepted, corrected to 73 after cross-checking for internal
contradictions -- see data/productMap.json's "correctionNote"). That covers
a meaningful slice, not the whole catalogue -- there are ~40,000 candidate
pairs at a looser 0.3 threshold alone, before even considering products that
DO have a parseable size but were rejected by the algorithm's strict gates.

This script automates that same review process at scale: generate candidates,
ask Claude to judge each one with the SAME standard used in the manual pass
(brand must genuinely match for packaged/branded goods; generic/unbranded
commodities like raw produce can match across different packer labels; pack
size/count/quantity must not conflict; when a product on one side matches
MULTIPLE candidates on the other, that's a sign of ambiguity, not confidence
-- prefer no match over a guess), and merge the results into the existing map.

USAGE:
    export ANTHROPIC_API_KEY=...        # already used elsewhere in this repo
    python3 scripts/build_product_map.py \\
        --promarche data/baskets-lake/promarche_YYYY-MM-DD.csv \\
        --makhazen  data/baskets-lake/almakhazen_YYYY-MM-DD.csv \\
        --spinneys  data/baskets-lake/spinneys_YYYY-MM-DD.csv

    (CSVs are the raw Data Lake exports -- same shape as lib/etl/normalize.js
    expects. This script deliberately does NOT commit those CSVs to the repo;
    point it at wherever you saved that day's pull.)

The script is resumable and additive: it loads the existing productMap.json,
skips any (retailer, name) pair already covered by an existing group, and
only classifies genuinely new candidates -- so re-running it after a new
Data Lake pull only costs API calls for products it hasn't seen before.

COST/SCALE NOTE: at ~40,000 loose candidates, this is a real number of API
calls even batched. Start with --min-similarity 0.6 or narrower categories
(--category "Meat & Fish") to control scope and cost before running the
full sweep.
"""
import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.request
from collections import defaultdict, Counter

MODEL = "claude-sonnet-4-6"
BATCH_SIZE = 20          # candidate pairs judged per API call
API_URL = "https://api.anthropic.com/v1/messages"


def log(msg):
    print(f"[build_product_map] {msg}", file=sys.stderr)


# ── Minimal re-implementation of the JS normalize/phase-1/size-parse logic ──
# Kept intentionally close to lib/etl/normalize.js, lib/etl/buildProducts.js
# and lib/etl/sizeParse.js so candidate generation matches what the live app
# actually sees. If those files change meaningfully, update this too.

SIZE_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gram|grams|mg|l|lt|ltr|liter|litre|ml|cl|cc|pcs|pc)\b", re.I)
UNIT_STRIP_RE = re.compile(r"\b\d+(?:[.,]\d+)?\s*(?:kg|g|gr|gram|grams|mg|l|lt|ltr|liter|litre|ml|cl|cc|pcs|pc|pack)\b", re.I)
PACK_STRIP_RE = re.compile(r"\bx\s*\d+\b|\b\d+\s*x\b", re.I)


def parse_size(name):
    s = (name or "").lower()
    if re.search(r"\d+(?:[.,]\d+)?\s*[-\u2013]\s*\d+(?:[.,]\d+)?\s*(?:kg|g|gr|mg|l|lt|ltr|ml|cl|cc)\b", s):
        return None
    m = SIZE_RE.search(s)
    if not m:
        return None
    val = float(m.group(1).replace(",", "."))
    u = m.group(2)
    if u == "kg":
        fam, base = "mass", val * 1000
    elif u in ("g", "gr", "gram", "grams"):
        fam, base = "mass", val
    elif u in ("l", "lt", "ltr", "liter", "litre"):
        fam, base = "vol", val * 1000
    elif u == "cl":
        fam, base = "vol", val * 10
    elif u in ("ml", "cc"):
        fam, base = "vol", val
    elif u in ("pcs", "pc"):
        fam, base = "count", val
    else:
        return None
    return {"family": fam, "baseQty": base} if base > 0 else None


def core_name(name, brand):
    s = (name or "").lower()
    if brand:
        s = s.replace(brand.lower(), " ")
    s = UNIT_STRIP_RE.sub(" ", s)
    s = PACK_STRIP_RE.sub(" ", s)
    s = re.sub(r"[^a-z\u0600-\u06ff ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def token_sim(a, b):
    wa = {w for w in a.split() if len(w) > 1}
    wb = {w for w in b.split() if len(w) > 1}
    if not wa or not wb:
        return 0.0
    shared = len(wa & wb)
    return (2 * shared) / (len(wa) + len(wb))


# Category canon is intentionally coarse here -- close enough for candidate
# bucketing; the LLM classification step, not this heuristic, is the real gate.
def canon_category(text):
    t = (text or "").lower()
    if any(k in t for k in ["produce", "fruit", "vegetable", "herb"]):
        return "Fresh Produce"
    if any(k in t for k in ["meat", "poultry", "fish", "seafood", "cheese", "dairy", "egg"]):
        return "Meat & Fish"
    if any(k in t for k in ["bakery", "bread", "pastry"]):
        return "Bakery"
    if any(k in t for k in ["snack", "sweet", "chocolate", "candy", "chip"]):
        return "Snacks & Sweets"
    if any(k in t for k in ["clean", "household", "detergent"]):
        return "Home & Cleaning"
    if any(k in t for k in ["beverage", "drink", "juice", "water", "soda"]):
        return "Beverages"
    return "Other / Mixed"


def read_csv(path):
    with open(path, newline="", encoding="utf-8-sig", errors="replace") as f:
        return list(csv.DictReader(f))


def normalize_weevi(rows, retailer):
    out = []
    for r in rows:
        title = (r.get("title") or "").strip()
        if not title:
            continue
        try:
            price = float(r.get("final_price") or 0)
        except ValueError:
            price = 0
        if price <= 0:
            continue
        out.append({"retailer": retailer, "name": title, "brand": (r.get("brand") or "").strip(),
                     "cat": canon_category(r.get("categories")), "price": price})
    return out


def normalize_spinneys(rows):
    out = []
    for r in rows:
        name = (r.get("name") or "").strip()
        if not name:
            continue
        try:
            special = float(r.get("special_usd") or 0)
        except ValueError:
            special = 0
        try:
            price = special if special > 0 else float(r.get("price_usd") or 0)
        except ValueError:
            price = 0
        if price <= 0:
            continue
        cat_text = " ".join(filter(None, [r.get("category_l0"), r.get("category_l1"), r.get("category_l2")]))
        out.append({"retailer": "Spinneys", "name": name, "brand": "",
                     "cat": canon_category(cat_text), "price": price})
    return out


def build_source_products(rows):
    groups = {}
    for r in rows:
        key = (r["retailer"], r["name"].lower().strip(), r["brand"].lower())
        groups.setdefault(key, {"retailer": r["retailer"], "name": r["name"], "brand": r["brand"], "cat": r["cat"]})
    return list(groups.values())


def generate_candidates(source_products, min_sim, category_filter):
    no_size = [sp for sp in source_products if not parse_size(sp["name"])]
    by_cat = defaultdict(list)
    for sp in no_size:
        if category_filter and sp["cat"] != category_filter:
            continue
        by_cat[sp["cat"]].append(sp)

    pairs = []
    for cat, items in by_cat.items():
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, b = items[i], items[j]
                if a["retailer"] == b["retailer"]:
                    continue
                sim = token_sim(core_name(a["name"], a["brand"]), core_name(b["name"], b["brand"]))
                if sim >= min_sim:
                    pairs.append({"cat": cat, "sim": sim, "a": a, "b": b})
    pairs.sort(key=lambda p: -p["sim"])
    return pairs


CLASSIFY_SYSTEM = """You are reviewing candidate product-matching pairs for a Lebanese grocery \
price-comparison tool. For each pair (one listing from each of two different supermarkets), decide \
whether they are the SAME physical product a shopper could fairly compare prices on.

Rules, applied strictly:
- For BRANDED/PACKAGED goods (packaged snacks, cheese, packaged meat, dairy, alcohol, tobacco, \
  cosmetics, etc.): the BRAND must genuinely match. A missing/unstated brand on one side is NOT \
  enough evidence to assume it's the same brand as the other side -- reject unless you have real \
  signal (e.g. a distinctive product-line name like "Bueno" or "Primula" appearing on both sides).
- IMPORTANT, discovered via manual review: a matching brand is NECESSARY but NOT SUFFICIENT. Many \
  false matches share a confirmed brand but differ in flavor, variant, texture, cut, or form -- \
  e.g. "Wilco Chicken Drumsticks" vs "Wilco Chicken Pops" (different cut), "Always Ultra Thin" vs \
  "Always Maxi Thick" (opposite product), "Cadbury Dairy Milk Plain" vs "Cadbury Milk Pistachio" \
  (different flavor), "Domo Jelly Beef Cherry" vs "Domo DIET Jelly Beef Cherry" (diet vs regular -- \
  note this conflict can be ONE-SIDED: one listing stating "diet"/"light"/a flavor and the other \
  saying nothing is still a real conflict, not a neutral default). Always check for this even when \
  the brand and general product type match.
- Watch for products that share a brand and a broad category but are actually a DIFFERENT specific \
  product entirely, not just a different variant (e.g. "Light Akkawi Cheese" vs "Candia Halloumi \
  Light" -- Akkawi and Halloumi are different cheese types, this is not a variant of the same thing).
- Pack size, count, weight, or format must NOT conflict (a "5+1 promo bundle" is not the same as a \
  single unit; a "2-finger" bar is not a "4-finger" bar; "6 months aged" is not "12 months aged"; \
  "8lb" is not "1.8lb").
- For GENERIC/UNBRANDED raw commodities (fresh produce, herbs, eggs with no brand): different \
  packer/supplier labels on a generic commodity ARE the same item for comparison purposes (a lemon \
  is a lemon regardless of which farm packed it) -- these can match even without a shared brand name.
- If one listing plausibly matches MULTIPLE different candidates on the other side, that is a sign \
  of genuine ambiguity -- do not accept any of them with confidence.
- When genuinely uncertain, answer NO. A missed match costs nothing; a wrong match produces a \
  misleading price comparison shown to real shoppers.

Respond ONLY with a JSON array, one object per input pair in the same order, each exactly:
{"match": true|false, "reason": "<one short phrase>"}
No other text, no markdown fences."""


def call_claude(pairs_batch, api_key):
    content = "\n".join(
        f"{i+1}. [{p['cat']}] {p['a']['retailer']}: {p['a']['name']}"
        f" (brand: {p['a']['brand'] or 'none stated'})"
        f"  <=>  {p['b']['retailer']}: {p['b']['name']}"
        f" (brand: {p['b']['brand'] or 'none stated'})"
        for i, p in enumerate(pairs_batch)
    )
    body = json.dumps({
        "model": MODEL,
        "max_tokens": 2000,
        "system": CLASSIFY_SYSTEM,
        "messages": [{"role": "user", "content": content}],
    }).encode("utf-8")
    req = urllib.request.Request(API_URL, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    })
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
    text = "".join(b["text"] for b in data["content"] if b["type"] == "text")
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    return json.loads(text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--promarche", required=True)
    ap.add_argument("--makhazen", required=True)
    ap.add_argument("--spinneys", required=True)
    ap.add_argument("--out", default="data/productMap.json")
    ap.add_argument("--min-similarity", type=float, default=0.6)
    ap.add_argument("--category", default=None, help="Restrict to one canonical category to control cost")
    ap.add_argument("--dry-run", action="store_true", help="Generate candidates and cost estimate only, no API calls")
    args = ap.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key and not args.dry_run:
        raise SystemExit("ANTHROPIC_API_KEY not set. Export it, or pass --dry-run to just see candidate counts.")

    rows = (
        normalize_weevi(read_csv(args.promarche), "Promarche")
        + normalize_weevi(read_csv(args.makhazen), "Al-Makhazen")
        + normalize_spinneys(read_csv(args.spinneys))
    )
    log(f"normalized {len(rows)} rows")
    source_products = build_source_products(rows)
    log(f"{len(source_products)} distinct source-products after branch-collapse")

    existing = json.load(open(args.out)) if os.path.exists(args.out) else {"groups": []}
    already_covered = set()
    for g in existing["groups"]:
        for m in g["members"]:
            already_covered.add((m["retailer"], m["name"].lower().strip()))

    candidates = generate_candidates(source_products, args.min_similarity, args.category)
    candidates = [
        p for p in candidates
        if (p["a"]["retailer"], p["a"]["name"].lower().strip()) not in already_covered
        or (p["b"]["retailer"], p["b"]["name"].lower().strip()) not in already_covered
    ]
    log(f"{len(candidates)} new candidate pairs at similarity >= {args.min_similarity}"
        f"{' in category ' + args.category if args.category else ''}"
        f" (already-covered pairs skipped)")

    if args.dry_run:
        log(f"dry run -- would make ~{-(-len(candidates)//BATCH_SIZE)} API calls. Exiting.")
        return

    accepted = []
    next_id = 1 + max((int(g["id"].lstrip("m").split("_")[0]) for g in existing["groups"] if g["id"][1:2].isdigit()), default=0)
    for start in range(0, len(candidates), BATCH_SIZE):
        batch = candidates[start:start + BATCH_SIZE]
        log(f"classifying pairs {start+1}-{start+len(batch)} of {len(candidates)}...")
        try:
            results = call_claude(batch, api_key)
        except Exception as e:
            log(f"batch failed ({e!r}), skipping -- rerun later to retry")
            continue
        for p, r in zip(batch, results):
            if r.get("match"):
                accepted.append({
                    "id": f"m{next_id}",
                    "members": [
                        {"retailer": p["a"]["retailer"], "name": p["a"]["name"]},
                        {"retailer": p["b"]["retailer"], "name": p["b"]["name"]},
                    ],
                    "reviewedSimilarity": round(p["sim"], 2),
                    "note": r.get("reason", ""),
                })
                next_id += 1
        time.sleep(0.5)  # gentle rate limiting

    log(f"{len(accepted)} new groups accepted out of {len(candidates)} candidates classified")
    existing["groups"].extend(accepted)
    existing["acceptedGroups"] = len(existing["groups"])
    json.dump(existing, open(args.out, "w"), indent=2, ensure_ascii=False)
    log(f"wrote {args.out} ({existing['acceptedGroups']} total groups)")


if __name__ == "__main__":
    main()
