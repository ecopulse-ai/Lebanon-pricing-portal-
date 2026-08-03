#!/usr/bin/env python3
"""
Build the CPI-basket price snapshot JSON from per-chain basket exports.

Input  : data/baskets/*.csv  (and *.xlsx if openpyxl is installed) — committed
         source of truth. Each file is one chain's CPI-mapped basket on one date.
         data/classes.csv — maps a CPI code's 3-digit prefix (code_class) to a
         category name (e.g. "111" -> "Bread and cereals"). This is now the
         SOLE source of category assignment — each source's own free-text
         category columns (category_l1/category_l2/lebanon_category) differ in
         format between chains and are no longer trusted for grouping.
Output : data/basket_prices.json  (committed; imported by lib/basketData.js)

Drop a new dated export into data/baskets/ and re-run:

    python3 scripts/build_basket.py

The basket files are the stable, repeatable feed the portal is fed from (unlike
the one-off retail master, whose source catalogs no longer exist). Chains are
scraped on different days, so the "current" view takes each chain's MOST RECENT
date — a cross-sectional basket, not a single-day cut. `trend[]` keeps every date
so a time series accrues as the folder grows.

── 2026-08 methodology change ──────────────────────────────────────────────
1. cpi_code normalization: some exports (older Spinneys/Tawfeer files) write
   the code as a float-formatted string ("11101.0") while others write it as
   a plain string ("11101"). Left unnormalized, this silently prevents the
   SAME cpi_code from ever being grouped across chains (confirmed: before this
   fix, Tawfeer's 97 basket items had ZERO overlap with Carrefour/Spinneys on
   any cpi_code, purely because of this formatting mismatch — not a real data
   gap). Every code is now normalized by stripping a trailing ".0" at parse
   time, uniformly, for every row from every file — so this class of bug can't
   reoccur silently if a future export reintroduces it.
2. Category assignment now comes ONLY from data/classes.csv, keyed by the
   cpi_code's first 3 digits — not from each chain's own category text, which
   is phrased differently per source and can't be trusted to align.
3. Item-level gap = dearest chain's unit price vs. the GEOMETRIC MEAN of all
   comparable chains' unit prices for that item (not the old dearest/cheapest
   ratio). Rationale: with 3 chains now regularly comparable per item (after
   fix #1), a raw dearest/cheapest ratio throws away the middle data point and
   overweights whichever two chains happen to be furthest apart. The geometric
   mean is the standard way to average price RATIOS/relatives (prices are
   multiplicative quantities, not additive — this is the same reason
   statistical agencies use geometric means, e.g. Jevons indices, for price
   index construction) and uses all available chains' prices, not just two.
4. Category-level gap = WEIGHTED AVERAGE of item-level gaps within the
   category, weighted by each item's CPI importance weight (NonCoreItemBreakdown.Share in
   Azure SQL, InflationFoodSec_Lebanon). Weighted avg = sum(w_i * gap_i) /
   sum(w_i) — dividing by the sum of weights ACTUALLY used automatically
   renormalizes for any items excluded by the filters below, so there is no
   separate renormalization step needed; it falls out of the standard
   weighted-average formula.
5. Only items present in ALL THREE chains are used in the gap calculations
   (both item-level and category-level). This is enforced upstream, before
   step 3, by intersecting cpi_codes across chains.
6. Each item is standardized to its own ACTUAL pack unit (e.g. "900G", "1KG",
   "30PCS") rather than a synthetic per-100 basis. When chains disagree on
   pack size for the same item, the majority chain's reported size is used as
   the reference quantity (tie -> falls back to the median size, logged).
   Every chain's price is still mathematically scaled to that reference
   quantity before comparison — changing the LABEL to a natural unit doesn't
   remove the need to correct for real pack-size differences; skipping that
   correction is exactly the bug this methodology change is fixing elsewhere,
   so it is deliberately NOT skipped here.
7. cpi_code/cpi_item is a CLASSIFICATION, not proof two chains' rows are the
   same product — a chain routinely lists several different brands under one
   code (e.g. multiple wheat brands under "Peeled Wheat"). Picking whichever
   row happened to be cheapest per chain (the old approach) could silently
   compare unrelated products that only share a broad category tag — e.g.
   one real case: three chains' "Mamoul" rows were an oat-and-date snack bar,
   a cereal cookie, and a ghraybeh (a different traditional cookie entirely),
   which produced a large but meaningless "gap". Item selection now matches
   on PRODUCT NAME similarity (word-overlap after stripping pack-size
   tokens) across chains within a cpi_code, requiring every pair in the
   matched triple to clear a similarity threshold — cpi_code narrows the
   candidate pool, product name decides whether they're actually comparable.
   If no combination of candidates is mutually similar enough, the item is
   excluded (logged with the closest attempt), never guessed.

Schema handled (both variants — Spinneys: `stock`; Carrefour: `stock`+`stock_status`):
  source, cpi_code, cpi_item, code, name, product_name, brand, weight, item_unit,
  base_unit, stock|stock_status, price, discount_price, url, image_url,
  category_l1, category_l2, lebanon_category, date
"""
import csv, json, os, glob, re, statistics, sys, math, itertools
from collections import defaultdict, Counter

BASKET_DIR = "data/baskets"
CLASSES_FILE = "data/classes.csv"
OUT = "data/basket_prices.json"
ACTIVE_CHAINS = ["Carrefour", "Spinneys"]  # Chains currently included in gap
    # calculations. Per instruction (2026-08): only Carrefour and Spinneys for
    # now, Tawfeer set aside. To bring a chain back (Tawfeer, or add a new
    # one), just add its name to this list -- everything below (product
    # clustering, coverage classification, item/category rollups) is written
    # generically for however many chains are listed here, nothing is
    # hardcoded to 2 or 3. A chain NOT in this list is dropped entirely from
    # this build (no KPI card, no gap participation) -- see the filter applied
    # to `records` right after parsing.
CREDIBLE_GAP_LO, CREDIBLE_GAP_HI = 10, 150   # unchanged from before
CATEGORY_FLAG_THRESHOLD = 10  # % — a category is flagged "needs review" at/above
                               # this weighted gap. Chosen to match the existing
                               # item-level credible-band FLOOR (10%), so the
                               # flag threshold isn't a new, unexplained number —
                               # it's "the same bar an individual item has to
                               # clear to count as a real gap at all". No upper
                               # bound is applied at category level: the upper
                               # bound at item level exists to catch unit/grade
                               # mismatches on a SINGLE product; once averaged
                               # across many weighted items that specific risk
                               # is already diluted, so capping the aggregate
                               # would just hide a genuinely large, real gap.


def log(msg):
    print(f"[build_basket] {msg}", file=sys.stderr)


def log_warn(msg):
    print(f"[build_basket] WARNING: {msg}", file=sys.stderr)


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


def norm_code(raw):
    """Normalize a cpi_code so the SAME code matches across chains regardless
    of which export formatted it as a float-like string. '11101.0' -> '11101'.
    Applied to every row from every file, not just the ones known to be
    affected today, so a future export with the same artifact doesn't
    silently break cross-chain matching again."""
    s = (raw or "").strip()
    return re.sub(r"\.0$", "", s)


def in_stock(row):
    ss = (row.get("stock_status") or "").strip().lower()
    if ss:
        return ss in ("instock", "lowstock", "in_stock", "low_stock")
    return str(row.get("stock", "")).strip().lower() in ("true", "1", "yes", "instock")


def chain_of(row):
    return (row.get("source") or "").strip().title() or "Unknown"


# ── Brand inference for chains that don't populate the CSV's brand column ────
# Checked directly against these files: Carrefour and Spinneys are 100% empty
# on `brand` (0/236, 0/210+0/206); only Tawfeer has real brand data (125/173).
# Rather than hand-editing the raw CSVs with guessed values (which would (a)
# silently stop applying the moment a fresh export replaces these files, and
# (b) blur "real scraped fact" with "inferred guess" inside what's supposed to
# be raw source data), brand is derived at PROCESSING TIME from the product
# name text, matched against a KNOWN-BRANDS reference so nothing is invented
# out of thin air -- a name only gets a brand if one of these actually,
# verifiably appears in it.
#
# The known-brands set combines:
#   1. Every brand actually observed in this basket's own data (mainly
#      Tawfeer's real, populated brand column -- direct ground truth for
#      exactly these products).
#   2. lib/etl/brandOrigin.json (1,802 brands) and
#      lib/etl/spinneysSupplementBrands.json (148 brands) -- already-curated
#      reference lists built for the live Data Lake pipeline; reused here
#      rather than duplicating that curation work.
BRAND_REFERENCE_FILES = ["lib/etl/brandOrigin.json", "lib/etl/spinneysSupplementBrands.json"]

# Checked directly: these two curated reference files (shared with the live
# Data Lake pipeline -- see lib/etl/normalize.js) contain a small number of
# generic descriptive words as standalone "brand" entries, not real brands
# ("Chicken", "Fresh" confirmed by direct inspection). Matching on these
# would false-positive on almost any chicken/fresh product regardless of
# actual brand. Excluded here rather than edited in the shared files, since
# fixing this properly means auditing 1,950 entries across a file also used
# by the live product catalogue -- worth doing, but out of scope for this
# change; this denylist is the safe, scoped fix for this script specifically.
KNOWN_BAD_BRAND_ENTRIES = {"chicken", "fresh"}


def load_reference_brands():
    brands = set()
    for path in BRAND_REFERENCE_FILES:
        if not os.path.exists(path):
            log_warn(f"brand reference file not found (skipped): {path}")
            continue
        try:
            data = json.load(open(path, encoding="utf-8"))
            if isinstance(data, dict):
                brands.update(data.keys())
            elif isinstance(data, list):
                brands.update(data)
        except Exception as e:
            log_warn(f"could not load brand reference {path}: {e!r}")
    excluded = {b for b in brands if b.strip().lower() in KNOWN_BAD_BRAND_ENTRIES}
    if excluded:
        log_warn(f"excluded {len(excluded)} generic-word entr{'y' if len(excluded)==1 else 'ies'} from the "
                  f"brand reference (not real brands): {sorted(excluded)}")
    return brands - excluded


def _pad(s):
    return " " + re.sub(r"\s+", " ", s.strip().lower()) + " "


def build_brand_matcher(known_brands):
    """Returns a function name -> matched brand string, or None. Matching is
    WHOLE-WORD (the brand padded with spaces must appear in the padded,
    lowercased name) -- plain substring containment produces real false
    positives here (e.g. "Ron"/"On" both substring-match inside "Deroni"),
    confirmed against this actual data before choosing this approach. Longest
    brand wins when more than one matches (so a multi-word brand like "Al Wadi
    Al Akhdar" is preferred over any shorter brand it happens to contain)."""
    ordered = sorted((b for b in known_brands if b and b.strip()), key=len, reverse=True)
    padded = [(b, _pad(b)) for b in ordered]

    def match(name):
        if not name:
            return None
        n = _pad(name)
        for brand, pb in padded:
            if pb in n:
                return brand
        return None

    return match


def med(xs):
    return round(statistics.median(xs), 2) if xs else 0


def mean(xs):
    return round(statistics.mean(xs), 2) if xs else 0


def geo_mean(xs):
    """Geometric mean — the correct way to average price RATIOS (prices are
    multiplicative quantities). Undefined for non-positive values; callers
    must ensure xs are all > 0 before calling."""
    if not xs:
        return None
    if any(x <= 0 for x in xs):
        return None
    return math.exp(sum(math.log(x) for x in xs) / len(xs))


# cpi_code/cpi_item is a CLASSIFICATION (e.g. "Mamoul"), not proof two rows are
# the same product — a chain can (and often does) list several different
# brands/products under one CPI code. Matching by name similarity, not just
# the shared code, is what stops e.g. an oat-and-date snack bar, a cereal
# cookie, and a ghraybeh being compared to each other just because a curator
# tagged all three "Mamoul".
# cpi_code/cpi_item is a CLASSIFICATION (e.g. "Mamoul"), not proof two rows are
# the same product — a chain can (and often does) list several different
# brands/products under one CPI code. Matching by name similarity, not just
# the shared code, is what stops e.g. an oat-and-date snack bar, a cereal
# cookie, and a ghraybeh being compared to each other just because a curator
# tagged all three "Mamoul".
#
# 2026-08 rewrite: PRODUCT identity is now its own level, between cpi_code
# ("item") and the raw row. A "product" is a cluster of rows -- across chains,
# and potentially across DIFFERENT BRANDS within one chain -- whose name is
# similar enough (after stripping the brand) to be the same underlying good,
# e.g. "Zain Peeled Wheat 900g" and "Aoun Peeled Wheat 900g" cluster into one
# "Peeled Wheat" product even though the brand differs. Clustering is
# deliberately BRAND-AGNOSTIC (it strips brand before comparing) precisely so
# that a chain carrying multiple brands of the same generic good, and another
# chain carrying just one of those brands, still land in the same cluster --
# the BRAND-INTERSECTION step below then decides which of a chain's rows to
# actually use when computing that chain's price for the product.
NAME_STRIP_RE = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(?:kg|kgs|g|gr|grams?|mg|l|lt|ltr|liters?|litres?|ml|cl|cc|pcs?|pieces?)\b"
    r"|\bx\s*\d+\b|\b\d+\s*x\b",
    re.I,
)
NAME_SIM_THRESHOLD = 0.4  # Dice coefficient (2*shared / total words), after
    # stripping brand + pack-size tokens. Calibrated against real basket data
    # (see git history / prior session): genuine same-type-different-brand
    # pairs score 0.5-0.67; unrelated products sharing only a cpi_code score
    # ~0. 0.4 sits clearly between the two clusters.


def core_text(name, brand):
    """Product name with the brand and any pack-size tokens stripped out --
    the text actually compared for product-identity clustering. Brand is
    removed ON PURPOSE (see module note above): clustering must be able to
    group different brands of the same generic good."""
    s = (name or "").lower()
    if brand:
        s = s.replace(brand.lower(), " ")
    s = NAME_STRIP_RE.sub(" ", s)
    s = re.sub(r"[^a-z\u0600-\u06ff ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def text_tokens(s):
    return {w for w in s.split() if len(w) > 1}


def text_similarity(a, b):
    ta, tb = text_tokens(a), text_tokens(b)
    if not ta or not tb:
        return 0.0
    shared = len(ta & tb)
    return (2 * shared) / (len(ta) + len(tb))


SIZE_TOLERANCE_RATIO = 1.3  # chosen against this real basket data: gray-zone
    # cases up to ~1.25x (e.g. basmati rice sold as 720g/750g/900g bags,
    # vermicelli at 400g vs 500g) look like genuine, ordinary pack-size
    # variance between retailers -- still the same product. Cases at 1.33x+
    # (a croissant at 100g vs 75g, ketchup at 810g vs 510g, a chicken burger
    # pack at 500g vs 900g) look like real format differences, not the same
    # product. 1.3 sits on the line between those two clusters.


def resolve_reference_qty(chain_rows):
    """chain_rows: {chain: [rows with a valid base_qty]}. Finds the LARGEST
    group of rows, from >=2 DIFFERENT chains, whose base_qty values are all
    mutually within SIZE_TOLERANCE_RATIO of each other -- this replaces exact-
    value majority voting (which missed near-matches like 899g vs 900g) and
    the blind median/mean fallback (which averaged genuinely different pack
    sizes, like 5kg vs 900g, into a synthetic size neither retailer sells).
    Generalizes cleanly past 2 chains: with 3+, a single chain whose size is
    a real outlier gets dropped from JUST this product, while the chains that
    do agree still get compared -- rather than one outlier corrupting a
    "majority" that required exact equality, or forcing the whole product to
    be thrown out.
    Returns (ref_qty, chains_used) or (None, None) if no such group exists
    covering at least 2 chains."""
    flat = [(ch, r) for ch, rows in chain_rows.items() for r in rows]
    flat.sort(key=lambda x: x[1]["base_qty"])
    n = len(flat)
    best = None  # (n_chains_covered, n_rows, i, j)
    for i in range(n):
        lo = flat[i][1]["base_qty"]
        for j in range(i, n):
            hi = flat[j][1]["base_qty"]
            if hi / lo > SIZE_TOLERANCE_RATIO:
                break  # flat is sorted, so nothing past j will fit either
            chains_covered = {flat[k][0] for k in range(i, j + 1)}
            if len(chains_covered) < 2:
                continue
            candidate = (len(chains_covered), j - i + 1, i, j)
            if best is None or candidate[:2] > best[:2]:
                best = candidate
    if best is None:
        return None, None
    _, _, i, j = best
    window = [flat[k][1]["base_qty"] for k in range(i, j + 1)]
    chains_used = {flat[k][0] for k in range(i, j + 1)}
    return statistics.median(window), chains_used


def cluster_products(rows):
    """Cluster rows (regardless of chain or brand) into "products" by
    core-text similarity -- simple union-find over all pairs. Small inputs
    per cpi_code (real data: a handful of rows per chain), so an O(n^2)
    pairwise comparison is fine; this runs offline, not per web request."""
    n = len(rows)
    texts = [core_text(r["product"], r["brand"]) for r in rows]
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i, j):
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[ri] = rj

    for i in range(n):
        for j in range(i + 1, n):
            if texts[i] and texts[j] and text_similarity(texts[i], texts[j]) >= NAME_SIM_THRESHOLD:
                union(i, j)

    clusters = defaultdict(list)
    for i, r in enumerate(rows):
        clusters[find(i)].append(r)
    return list(clusters.values())


# ── classes.csv — the sole source of category assignment ─────────────────────
def load_classes():
    if not os.path.exists(CLASSES_FILE):
        raise SystemExit(
            f"{CLASSES_FILE} not found — this file maps a cpi_code's first 3\n"
            f"digits to a category name and is required. Nothing can be\n"
            f"categorized without it."
        )
    classes = {}
    with open(CLASSES_FILE, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            prefix = (row.get("code_class") or "").strip()
            name = (row.get("name") or "").strip()
            if prefix and name:
                classes[prefix] = name
    log(f"loaded {len(classes)} category classes from {CLASSES_FILE}")
    return classes


CLASSES = load_classes()


def category_for(code):
    prefix = code[:3]
    name = CLASSES.get(prefix)
    if name is None:
        log_warn(f"cpi_code '{code}' has no matching 3-digit class in {CLASSES_FILE} "
                  f"(prefix '{prefix}') -- labelled 'Uncategorized'.")
        return "Uncategorized", prefix
    return name, prefix


# ── Size normalization ────────────────────────────────────────────────────────
QTY_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilograms?|g|gr|grams?|mg|l|lt|ltr|liters?|litres?|ml|cl|cc|pcs|pc|pieces?)\b",
    re.I,
)
PACK_RE = re.compile(r"(\d+)\s*[x\u00d7]", re.I)


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
    # (>= 20). Smaller bare numbers are ambiguous (kg / L / a count) — skip
    # rather than guess, since guessing wrong here silently mixes mass and
    # volume in a "same unit" comparison later.
    try:
        v = float(s.replace(",", "")) * pack
    except ValueError:
        return (None, None)
    return (v, None) if v >= 20 else (None, None)


def format_ref_unit(base_qty, family):
    """Turn a reference base_qty back into a natural display label, e.g.
    900 (mass) -> '900G', 1000 (mass) -> '1KG', 30 (count) -> '30PCS'."""
    if family == "mass":
        return f"{base_qty/1000:g}KG" if base_qty >= 1000 else f"{base_qty:g}G"
    if family == "vol":
        return f"{base_qty/1000:g}L" if base_qty >= 1000 else f"{base_qty:g}ML"
    if family == "count":
        return f"{base_qty:g}PC" if base_qty == 1 else f"{base_qty:g}PCS"
    return f"{base_qty:g}U"


# ── Parse every basket file ───────────────────────────────────────────────────
files = sorted(glob.glob(os.path.join(BASKET_DIR, "*.csv")) +
               glob.glob(os.path.join(BASKET_DIR, "*.xlsx")))
if not files:
    raise SystemExit(f"No basket files found in {BASKET_DIR}/ -- nothing to build.")

records = []          # one normalized dict per priced row
skipped_unpriced = 0
for path in files:
    for row in read_any(path):
        price = num(row.get("price"))
        disc = num(row.get("discount_price"))
        eff = disc if disc is not None else price
        if eff is None:
            skipped_unpriced += 1
            continue                                   # unpriced row — skip
        code = norm_code(row.get("cpi_code"))
        cat_name, cat_code = category_for(code) if code else ("Uncategorized", "")
        bq, fam = parse_qty(row.get("weight"))
        records.append({
            "chain": chain_of(row),
            "date": (row.get("date") or "").strip(),
            "cpi_code": code,
            "cpi_item": (row.get("cpi_item") or "").strip(),
            "cat_code": cat_code,
            "category": cat_name,
            "product": (row.get("product_name") or row.get("name") or "").strip(),
            "brand": (row.get("brand") or "").strip(),
            "brandInferred": False,  # flipped to True below if brand had to be inferred from the name
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
log(f"parsed {len(records)} priced rows from {len(files)} files ({skipped_unpriced} unpriced rows skipped)")

# ── Apply brand inference (see build_brand_matcher above) ────────────────────
observed_brands = {r["brand"] for r in records if r["brand"]}
known_brands = load_reference_brands() | observed_brands
log(f"brand reference: {len(observed_brands)} observed in this basket's own data "
    f"+ {len(known_brands) - len(observed_brands)} from curated reference lists "
    f"= {len(known_brands)} total")
match_brand = build_brand_matcher(known_brands)

missing_before = sum(1 for r in records if not r["brand"])
inferred_count = 0
for r in records:
    if not r["brand"]:
        guess = match_brand(r["product"])
        if guess:
            r["brand"] = guess
            r["brandInferred"] = True
            inferred_count += 1
log(f"brand inference: {missing_before} rows had no brand from the CSV; "
    f"{inferred_count} got one inferred from the product name matching a known brand; "
    f"{missing_before - inferred_count} still have none (no known brand found in the name -- left blank, not guessed).")

all_chains_seen = sorted({r["chain"] for r in records})
inactive = [c for c in all_chains_seen if c not in ACTIVE_CHAINS]
if inactive:
    log(f"chains present in the data but NOT in ACTIVE_CHAINS (excluded from this build entirely): {inactive}")
records = [r for r in records if r["chain"] in ACTIVE_CHAINS]
if not records:
    raise SystemExit(f"No rows left after filtering to ACTIVE_CHAINS={ACTIVE_CHAINS} -- check the chain names match exactly (case-sensitive) what's in the basket CSVs' `source` column.")

all_dates = sorted({r["date"] for r in records if r["date"]})
chains = sorted({r["chain"] for r in records})
latest_date = all_dates[-1] if all_dates else ""
log(f"chains found: {chains}")

# Each chain's most recent scrape date -> the "current" cross-sectional basket.
chain_latest = {}
for r in records:
    if r["date"] and r["date"] > chain_latest.get(r["chain"], ""):
        chain_latest[r["chain"]] = r["date"]
current = [r for r in records if r["date"] == chain_latest.get(r["chain"])]
log(f"'current' cross-section: {len(current)} rows, per-chain dates = {chain_latest}")
if chain_latest and len(set(chain_latest.values())) > 1:
    log_warn(f"chains' 'current' dates differ ({chain_latest}) — this is a "
              f"cross-sectional snapshot, NOT a same-day comparison. A gap between "
              f"chains may partly reflect time elapsed, not just a price difference.")


# ── Fetch CPI item weights (Azure SQL, NonCoreItemBreakdown.Share) for the weighted category
#    gap. See lib/azure/itemWeights.js / azure-function/item_weights_api for the
#    live path. Falls back to EQUAL weights (loudly logged) if unavailable, so
#    a missing/broken connection degrades to an unweighted average rather than
#    silently fabricating differentiated weights.
def fetch_item_weights():
    url = os.environ.get("AZURE_ITEM_WEIGHTS_FUNCTION_URL")
    key = os.environ.get("AZURE_ITEM_WEIGHTS_FUNCTION_KEY")
    if not url or not key:
        log_warn("AZURE_ITEM_WEIGHTS_FUNCTION_URL/_KEY not set -- category gaps "
                  "will use EQUAL weights (a plain unweighted average), NOT real "
                  "CPI importance weights, until this is wired up. See "
                  "azure-function/item_weights_api/ for the endpoint to deploy "
                  "and grant, matching the existing cpi_api pattern.")
        return {}
    try:
        import urllib.request
        req = urllib.request.Request(f"{url}?code={key}")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        weights = {norm_code(str(r.get("code"))): float(r["weight"])
                   for r in data if r.get("code") is not None and r.get("weight") is not None}
        log(f"fetched {len(weights)} item weights from Azure SQL (NonCoreItemBreakdown.Share)")
        return weights
    except Exception as e:
        log_warn(f"item-weights fetch failed ({e!r}) -- falling back to EQUAL weights.")
        return {}


ITEM_WEIGHTS = fetch_item_weights()
USING_EQUAL_WEIGHTS = len(ITEM_WEIGHTS) == 0


# NOTE: there's no cpi_code-level pre-filter anymore ("must be present in all
# chains") -- that gate now happens at the PRODUCT level, inside the
# clustering loop below, since that's the level at which "present in all
# active chains" actually needs to be decided (a cpi_code can easily have
# rows in every chain while no single matched PRODUCT within it does).
codes_seen_by_chain = defaultdict(set)
for r in current:
    if r["cpi_code"] and r["chain"] in ACTIVE_CHAINS:
        codes_seen_by_chain[r["chain"]].add(r["cpi_code"])
total_distinct = len(set().union(*codes_seen_by_chain.values())) if codes_seen_by_chain else 0
log(f"{total_distinct} distinct cpi_codes seen across ACTIVE_CHAINS={ACTIVE_CHAINS}")



# ── Aggregate the current basket ──────────────────────────────────────────────
cur_prices = [r["price"] for r in current]

# Per category (latest, ALL current rows — this KPI/summary block is descriptive,
# not part of the gap math, so it isn't restricted to the all-3-chains set).
cat_rows = defaultdict(list)
cat_code_map = {}
for r in current:
    cat_rows[r["category"]].append(r)
    cat_code_map[r["category"]] = r["cat_code"]

cat_summary = []
for name, rs in cat_rows.items():
    by_chain_prices = defaultdict(list)
    for r in rs:
        by_chain_prices[r["chain"]].append(r["price"])
    cat_summary.append({
        "code": cat_code_map[name],
        "name": name,
        "items": len({r["cpi_code"] for r in rs}),
        "medianPrice": med([r["price"] for r in rs]),
        "byChain": {c: med(p) for c, p in sorted(by_chain_prices.items())},
    })
cat_summary.sort(key=lambda c: c["code"] or c["name"])

# Per chain (each at its own latest date). Descriptive KPI block — every chain
# gets a card even if (like Tawfeer before this fix) it has no items comparable
# to the other two; itemsCompared/dearestItems/avgPremiumPct are filled in below
# ONLY for chains that actually appear in the comparable (all-3-chains) set.
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
        "itemsCompared": 0,
        "dearestItems": 0,
        "avgPremiumPct": None,   # null, not 0 — 0 would falsely read as "no premium"
    })
chain_list.sort(key=lambda x: -x["items"])


# ── Product level, then Item level: two-tier GM-anchored gap ─────────────────
# See module docstring's 2026-08 section for the full methodology. Summary:
#   1. Within a cpi_code, cluster rows into PRODUCTS by brand-agnostic name
#      similarity (a product can span multiple brands at one chain).
#   2. Per product, per chain: if the chain has multiple rows in the cluster
#      (multiple brands), keep only brands that also appear at every OTHER
#      chain present for this product (brand intersection) -- fall back to
#      using all of that chain's rows only if no brand is common anywhere.
#      Collapse to one price per chain via geometric mean.
#   3. Product-level gap = dearest chain price vs. GM of all chains' prices.
#      A product needs >=2 chains to get a gap at all. If it's found in ALL
#      of ACTIVE_CHAINS that's "full" coverage and it feeds the item-level
#      rollup below; if found in a strict subset (only possible once a 3rd+
#      chain is active) that's "partial" coverage -- still shown on its own,
#      explicitly labelled, but excluded from item/category aggregation.
#   4. Item level: geometric-mean the FULL-coverage products' per-chain prices
#      to get one price per chain for the whole cpi_item, then the same
#      dearest-vs-GM gap formula again.
NUM_ACTIVE = len(ACTIVE_CHAINS)

item_groups = defaultdict(list)
for r in current:
    if r["chain"] in ACTIVE_CHAINS and r["cpi_code"]:
        item_groups[r["cpi_code"]].append(r)

products = []           # every product with a valid >=2-chain gap (full AND partial)
items = []              # item-level rollups (full-coverage products only)
skipped_products = []   # clusters that never produced a usable gap, for auditing

for code, rs in item_groups.items():
    item_label = rs[0]["cpi_item"]
    category = rs[0]["category"]

    clusters = cluster_products(rs)
    item_full_products = []

    for cluster in clusters:
        by_chain_rows = defaultdict(list)
        for r in cluster:
            by_chain_rows[r["chain"]].append(r)
        chains_present = sorted(by_chain_rows)
        if len(chains_present) < 2:
            continue  # nothing to compare this product against -- not even worth logging, too common/noisy

        # Brand intersection: only meaningful if EVERY chain present has
        # brand data on its rows in this cluster. If any chain's rows lack
        # brand info entirely, we can't compute a fair intersection -- fall
        # through to using all rows (logged).
        brand_sets = {ch: {r["brand"] for r in by_chain_rows[ch] if r["brand"]} for ch in chains_present}
        all_have_brands = all(brand_sets[ch] for ch in chains_present)
        common_brands = set.intersection(*brand_sets.values()) if all_have_brands else set()
        any_inferred = any(r.get("brandInferred") for r in cluster if r["brand"] in common_brands) if common_brands else False

        chain_rows_used = {}
        brand_note = None
        if common_brands:
            for ch in chains_present:
                filtered = [r for r in by_chain_rows[ch] if r["brand"] in common_brands]
                chain_rows_used[ch] = filtered
            brand_note = f"brand-intersected on: {sorted(common_brands)}"
            if any_inferred:
                brand_note += " (at least one side's brand was INFERRED from the product name, not from the source CSV)"
        else:
            for ch in chains_present:
                chain_rows_used[ch] = by_chain_rows[ch]
            if any(len(by_chain_rows[ch]) > 1 for ch in chains_present):
                brand_note = "no brand common to every chain present -- used all available rows per chain"

        # Need a parseable size on at least one row per chain to compute a
        # fair per-unit price; drop rows that can't be sized, drop a chain
        # entirely if NONE of its rows for this product can be sized.
        sizeable = {ch: [r for r in chain_rows_used[ch] if r["base_qty"]] for ch in chains_present}
        sizeable = {ch: rs_ for ch, rs_ in sizeable.items() if rs_}
        if len(sizeable) < 2:
            skipped_products.append((code, item_label, {"reason": "fewer than 2 chains had a parseable size for this product cluster"}))
            continue

        all_valid_rows = [r for rs_ in sizeable.values() for r in rs_]
        fam_counts = Counter(r["family"] for r in all_valid_rows if r["family"])
        family = fam_counts.most_common(1)[0][0] if fam_counts else None

        ref_qty, chains_for_size = resolve_reference_qty(sizeable)
        if ref_qty is None:
            skipped_products.append((code, item_label, {
                "reason": f"no 2+ chains had sizes within {SIZE_TOLERANCE_RATIO}x of each other -- "
                          f"treated as not the same product",
                "sizesSeen": {ch: [r["base_qty"] for r in rs_] for ch, rs_ in sizeable.items()},
            }))
            continue
        dropped_as_outlier = set(sizeable) - chains_for_size
        if dropped_as_outlier:
            log(f"item '{item_label}' ({code}): {sorted(dropped_as_outlier)} dropped as a size outlier "
                f"(>{SIZE_TOLERANCE_RATIO}x from the {len(chains_for_size)}-chain group used: "
                f"{sorted(chains_for_size)}) -- product gap uses only the agreeing chains.")
        sizeable = {ch: rs_ for ch, rs_ in sizeable.items() if ch in chains_for_size}
        if len(sizeable) < 2:
            continue  # shouldn't happen (resolve_reference_qty already required >=2), but guard anyway

        chain_unit_price = {}
        for ch, rows_ in sizeable.items():
            ups = [round(r["price"] / r["base_qty"] * ref_qty, 3) for r in rows_ if r["base_qty"] > 0]
            ups = [u for u in ups if u > 0]
            if not ups:
                continue
            chain_unit_price[ch] = round(geo_mean(ups), 3) if len(ups) > 1 else ups[0]

        if len(chain_unit_price) < 2:
            skipped_products.append((code, item_label, {"reason": "fewer than 2 chains had a usable unit price after brand/size filtering"}))
            continue

        gm = geo_mean(list(chain_unit_price.values()))
        if not gm:
            continue
        dear_ch = max(chain_unit_price, key=chain_unit_price.get)
        cheap_ch = min(chain_unit_price, key=chain_unit_price.get)
        gap = round((chain_unit_price[dear_ch] / gm - 1) * 100)

        coverage = "full" if len(chain_unit_price) == NUM_ACTIVE else "partial"
        # Display name from the rows ACTUALLY used for pricing (post brand-
        # intersection and size-filtering) -- not the raw cluster, which can
        # still contain other brands that got excluded from the price itself.
        # Using the raw cluster here was a real bug: it could label a product
        # "Deroni Egyptian Rice" while the price shown was actually Zain's,
        # because Zain (not Deroni) was the brand common to both chains.
        priced_rows = [r for rows_ in sizeable.values() for r in rows_]
        name_counts = Counter(r["product"] for r in priced_rows)
        product_name = name_counts.most_common(1)[0][0]

        product_record = {
            "code": code,
            "cpi_item": item_label,
            "category": category,
            "productName": product_name,
            "unit": format_ref_unit(ref_qty, family),
            "unitByChain": dict(sorted(chain_unit_price.items())),
            "geoMeanUnitPrice": round(gm, 3),
            "dearChain": dear_ch, "dearUnitPrice": chain_unit_price[dear_ch],
            "cheapChain": cheap_ch, "cheapUnitPrice": chain_unit_price[cheap_ch],
            "gapPct": gap,
            "chainsCompared": sorted(chain_unit_price),
            "coverage": coverage,   # "full" (all ACTIVE_CHAINS) | "partial" (subset, >=2)
            "brandNote": brand_note,
        }
        products.append(product_record)
        if coverage == "full":
            item_full_products.append(product_record)

    # ── Item-level rollup: GM the full-coverage products' per-chain prices ──
    if not item_full_products:
        continue
    chain_item_prices = defaultdict(list)
    for p in item_full_products:
        for ch, up in p["unitByChain"].items():
            chain_item_prices[ch].append(up)
    item_chain_price = {ch: geo_mean(ups) for ch, ups in chain_item_prices.items() if ups}
    item_chain_price = {ch: v for ch, v in item_chain_price.items() if v}
    if len(item_chain_price) != NUM_ACTIVE:
        continue  # a product-level chain dropout shouldn't happen given "full" already
                  # required all ACTIVE_CHAINS, but guard anyway rather than assume

    gm_item = geo_mean(list(item_chain_price.values()))
    if not gm_item:
        continue
    dear_ch = max(item_chain_price, key=item_chain_price.get)
    cheap_ch = min(item_chain_price, key=item_chain_price.get)
    gap_item = round((item_chain_price[dear_ch] / gm_item - 1) * 100)

    units_seen = {p["unit"] for p in item_full_products}
    unit_label = next(iter(units_seen)) if len(units_seen) == 1 else f"mixed units across {len(item_full_products)} products"

    items.append({
        "code": code,
        "cpi_item": item_label,
        "category": category,
        "unit": unit_label,
        "unitByChain": {ch: round(v, 3) for ch, v in item_chain_price.items()},
        "geoMeanUnitPrice": round(gm_item, 3),
        "dearChain": dear_ch, "dearUnitPrice": round(item_chain_price[dear_ch], 3),
        "cheapChain": cheap_ch, "cheapUnitPrice": round(item_chain_price[cheap_ch], 3),
        "gapPct": gap_item,
        "nChains": len(item_chain_price),
        "nProducts": len(item_full_products),
        "weight": ITEM_WEIGHTS.get(code),
        "products": [p["productName"] for p in item_full_products],
    })

if skipped_products:
    log_warn(f"{len(skipped_products)} product-cluster(s) never produced a usable >=2-chain gap:")
    for code, label, detail in skipped_products[:15]:
        log_warn(f"    {code} '{label}': {detail}")
    if len(skipped_products) > 15:
        log_warn(f"    ...and {len(skipped_products) - 15} more")

partial_count = sum(1 for p in products if p["coverage"] == "partial")
log(f"{len(products)} product-level gaps computed ({len(products) - partial_count} full coverage across "
    f"all {NUM_ACTIVE} active chains, {partial_count} partial -- shown individually but excluded from "
    f"item/category rollups)")

items.sort(key=lambda x: x["code"])
products.sort(key=lambda x: (x["code"], x["productName"]))

# Credible band — same 10-150% window as before, now applied to the GM-anchored
# gap. Outside it, treat as a different-grade/format product, not a real markup.
flagged = [it for it in items if it["gapPct"] is not None and CREDIBLE_GAP_LO <= it["gapPct"] <= CREDIBLE_GAP_HI]
log(f"{len(items)} items with a valid full-coverage GM gap (across all {NUM_ACTIVE} active chains); "
    f"{len(flagged)} inside the credible {CREDIBLE_GAP_LO}-{CREDIBLE_GAP_HI}% band")

# Chain rollups — mean premium & dearest-item count, computed ONLY over flagged
# items (so a chain with zero comparable/credible items shows no premium rather
# than a fabricated one).
cAgg = {}
for it in flagged:
    gm = it["geoMeanUnitPrice"]
    for ch, up in it["unitByChain"].items():
        a = cAgg.setdefault(ch, {"items": 0, "dearest": 0, "premSum": 0.0})
        a["items"] += 1
        a["premSum"] += (up / gm - 1)
    cAgg[it["dearChain"]]["dearest"] += 1

for c in chain_list:
    a = cAgg.get(c["name"])
    if a and a["items"]:
        c["itemsCompared"] = a["items"]
        c["dearestItems"] = a["dearest"]
        c["avgPremiumPct"] = round((a["premSum"] / a["items"]) * 100)
    # else: leave the zero/None defaults set above — this chain has no
    # comparable+credible items yet, which is a true statement, not a 0% gap.


# ── Category-level: WEIGHTED average of item gaps (weight = NonCoreItemBreakdown.Share) ────
cat_items = defaultdict(list)
for it in items:  # use ALL items with a valid gap, not just "flagged", so every
                   # category gets a number; the flag decides if it's "concerning"
    if it["gapPct"] is not None:
        cat_items[it["category"]].append(it)

all_category_names = sorted(set(CLASSES.values()) | set(cat_items.keys()))
category_gaps = []
for cat_name in all_category_names:
    its = cat_items.get(cat_name, [])
    weighted_pairs = [(it["gapPct"], it["weight"] if it["weight"] is not None else 1.0) for it in its]
    weight_sum = sum(w for _, w in weighted_pairs)
    code_for_name = next((code for code, name in CLASSES.items() if name == cat_name), None)
    if its and weight_sum > 0:
        weighted_gap = round(sum(g * w for g, w in weighted_pairs) / weight_sum)
        dear_votes = Counter(it["dearChain"] for it in its)
        cheap_votes = Counter(it["cheapChain"] for it in its)
        dearest = dear_votes.most_common(1)[0][0]
        cheapest = cheap_votes.most_common(1)[0][0]
        category_gaps.append({
            "category": cat_name,
            "code": code_for_name,
            "nItems": len(its),
            "usingEqualWeights": USING_EQUAL_WEIGHTS,
            "dearest": dearest, "cheapest": cheapest,
            "gapPct": weighted_gap,
            "needsReview": weighted_gap >= CATEGORY_FLAG_THRESHOLD,
            "insufficientData": False,
        })
    else:
        category_gaps.append({
            "category": cat_name,
            "code": code_for_name,
            "nItems": 0,
            "usingEqualWeights": USING_EQUAL_WEIGHTS,
            "dearest": None, "cheapest": None,
            "gapPct": None,
            "needsReview": False,
            "insufficientData": True,
        })
category_gaps.sort(key=lambda c: (c["gapPct"] is None, -(c["gapPct"] or 0)))
if USING_EQUAL_WEIGHTS:
    log_warn("category gapPct values above are an UNWEIGHTED average (equal "
              "weights) -- real NonCoreItemBreakdown.Share was not available at build time.")


# Cheapest vs dearest chain per category (all current rows, descriptive KPI —
# separate from the weighted gap analysis above).
cheapest = []
for c in cat_summary:
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
        "activeChains": ACTIVE_CHAINS,
        "inactiveChains": inactive,
        "chainDates": chain_latest,
        "rows": len(records),
        "currency": "USD",
        "latestDate": latest_date,
        "usingEqualWeights": USING_EQUAL_WEIGHTS,
        "note": ("CPI-mapped retail basket across Lebanese chains. Chains are scraped on "
                 "different days, so the current view takes each chain's most recent date "
                 "(cross-sectional, not a single-day cut). Effective price uses the "
                 "discounted price where one is shown. Gap calculations only use ACTIVE_CHAINS "
                 "(currently: " + ", ".join(ACTIVE_CHAINS) + "). Product gap = dearest chain vs. "
                 "geometric mean of a matched product's chain prices (brand-intersected where "
                 "a chain carries multiple brands); item gap = geometric mean of its full-"
                 "coverage products' prices, same dearest-vs-GM formula one level up; category "
                 "gap = weighted average of item gaps by CPI weight (NonCoreItemBreakdown.Share)."),
    },
    "kpis": {
        "itemsTracked": len({r["cpi_code"] for r in current if r["chain"] in ACTIVE_CHAINS}),
        "chains": len(chain_list),
        "categories": len(cat_summary),
        "latestDate": latest_date,
        "basketMedian": med(cur_prices),
        "basketMean": mean(cur_prices),
        "inStockRate": round(100 * sum(r["in_stock"] for r in current) / len(current), 1),
        "discountedSharePct": round(100 * sum(r["discounted"] for r in current) / len(current), 1),
        "comparableProducts": len(products),
        "fullCoverageProducts": sum(1 for p in products if p["coverage"] == "full"),
        "partialCoverageProducts": sum(1 for p in products if p["coverage"] == "partial"),
        "comparableItems": len(items),
        "flaggedItems": len(flagged),
    },
    "categorySummary": cat_summary,
    "chains": chain_list,
    "cheapestByCategory": cheapest,
    "products": products,
    "items": items,
    "flaggedItems": flagged,
    "categoryGaps": category_gaps,
    "trend": trend,
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

k = out["kpis"]
log(f"Wrote {OUT}  ({os.path.getsize(OUT)} bytes)")
log(f"files={len(files)}  rows={len(records)}  current-rows={len(current)}")
log(f"chains={chains}  activeChains={ACTIVE_CHAINS}  dates={all_dates}  latest={latest_date}")
log(f"products={k['comparableProducts']} (full={k['fullCoverageProducts']}, partial={k['partialCoverageProducts']})  "
    f"comparableItems={k['comparableItems']}  flaggedItems={k['flaggedItems']}")
log(f"categories={k['categories']}  categoryGaps rows={len(category_gaps)} (needsReview={sum(c['needsReview'] for c in category_gaps)})")
log(f"basketMedian=${k['basketMedian']}  inStock={k['inStockRate']}%  discounted={k['discountedSharePct']}%")
if USING_EQUAL_WEIGHTS:
    log_warn("REMINDER: category gaps used EQUAL weights, not real NonCoreItemBreakdown.Share. "
              "Set AZURE_ITEM_WEIGHTS_FUNCTION_URL/_KEY and re-run once the endpoint is live.")
