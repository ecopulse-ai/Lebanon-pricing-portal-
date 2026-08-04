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

── 2026-08 methodology (current) ────────────────────────────────────────────
1. cpi_code normalization: some exports write the code as a float-formatted
   string ("11101.0") while others write it as a plain string ("11101").
   Every code is normalized by stripping a trailing ".0" at parse time,
   uniformly, for every row from every file.
2. Category assignment comes ONLY from data/classes.csv, keyed by the
   cpi_code's first 3-digit prefix — not from each chain's own category text,
   which is phrased differently per source and can't be trusted to align.
3. ACTIVE_CHAINS (currently Carrefour + Spinneys) is a plain list — every
   part of the matching/gap logic below is written generically for however
   many chains are in it, nothing is hardcoded to 2 or 3. A chain not in the
   list is excluded from this build entirely.
4. Product matching, in priority order:
   a. PRIMARY — a curated Excel-derived catalog (data/item_product_catalog.json):
      for each cpi_code, the real, exact product names that officially
      represent that item at each chain, plus an authoritative Base Unit.
      Verbatim-matched against the actual basket rows. "Drop uncommon items
      between retailers": a cpi_code is only used if EVERY active chain has
      at least one real match — a chain with zero matches means the item
      isn't comparable here, full stop, not partially comparable.
   b. FALLBACK — name-similarity clustering (word-overlap after stripping
      brand + pack-size tokens) for any cpi_code the catalog doesn't cover,
      combined with the tolerance-based size resolution described below.
      cpi_code/cpi_item is a CLASSIFICATION, not proof two chains' rows are
      the same product (a chain can list several different brands under one
      code) — this is why name similarity, not just a shared code, decides
      whether two rows are actually comparable.
5. Reference unit:
   - Catalog-matched items use the catalog's own authoritative Base Unit —
     every matched row is scaled to THIS fixed unit using its own real pack
     size. This is deliberately NOT a size chains have to agree with each
     other on; a 3L bottle and a 1.8L bottle both scale cleanly onto the same
     basis without needing to be numerically close to each other first.
   - Fallback-matched items have no catalog Base Unit, so the reference
     quantity is resolved from whichever chains' actual sizes are mutually
     within a tolerance ratio of each other (SIZE_TOLERANCE_RATIO) — chains
     whose size is a real outlier are excluded from just that item, not
     averaged into a synthetic size that matches no real product.
   - A bare number with no unit (e.g. Spinneys recording "3" for a 3-litre
     oil bottle) is not guessed in isolation — it's resolved ONLY when
     another row for the SAME item has an explicit unit to infer the family
     (mass/volume) from (see resolve_ambiguous_qty).
6. Geometric mean is used in EXACTLY ONE place: when a chain has multiple
   matched products (brands) for one item, their scaled prices are collapsed
   into a single representative price for that chain via geometric mean.
   Geometric mean is NEVER used to compute a gap. The item-level gap is a
   PLAIN ratio between the two (possibly GM'd) chain prices: dearest / cheapest - 1.
7. Category-level gap = WEIGHTED AVERAGE of item-level gaps within the
   category, weighted by each item's real CPI importance weight (from the
   same curated Excel catalog, not a live DB connection). Weighted avg =
   sum(w_i * gap_i) / sum(w_i) — dividing by the sum of weights ACTUALLY used
   automatically renormalizes for any items excluded upstream.
8. Categories with zero comparable items are dropped from the output
   entirely, not shown as a placeholder.

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
    """Return (base_qty, family, ambiguous_raw).
    base_qty is grams (mass), ml (vol) or pieces (count); family in
    {mass, vol, count, None}; both None if not derivable at all.
    ambiguous_raw carries a small bare number (<20, e.g. Spinneys recording
    "3" for a 3-litre oil bottle) that COULD be a real quantity but whose
    unit can't be told from the string alone -- kept (not discarded) so
    cluster-level resolution can later infer it from sibling rows in the same
    matched product that DO have an explicit unit (see resolve_ambiguous_qty
    below). Confirmed necessary against real data: several Spinneys oil rows
    record whole litres as a bare "2"/"3" with no unit token, which used to
    be silently dropped as "ambiguous" even though every Carrefour sibling in
    the same cluster explicitly says litres for the same item."""
    s = str(weight or "").strip().lower()
    if not s:
        return (None, None, None)
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
            return (None, None, None)
        base *= pack
        return (base, fam, None) if base > 0 else (None, None, None)
    # Bare number: treat as a base quantity in g/ml only when it's clearly one
    # (>= 20). Smaller bare numbers are ambiguous (kg / L / a count) -- never
    # guessed here; returned as ambiguous_raw for cluster-context resolution.
    try:
        v = float(s.replace(",", "")) * pack
    except ValueError:
        return (None, None, None)
    if v >= 20:
        return (v, None, None)
    return (None, None, v if v > 0 else None)


def resolve_ambiguous_qty(chain_rows):
    """Second pass over a matched cluster's rows (chain_rows: {chain: [rows]}):
    any row with an ambiguous small bare number (base_qty=None, ambigQty set)
    gets resolved IF the cluster has a confident family from at least one
    OTHER row with an explicit unit (mass or vol; count isn't in scope -- a
    bare small count is not the same ambiguity).

    Two candidate interpretations are considered for the bare number: as-is
    (e.g. "19" -> 19g) or as the "large" unit (e.g. "19" -> 19kg = 19000g).
    Whichever is CLOSER in magnitude to the real sibling evidence in this
    same cluster wins -- this is not a blanket assumption either way.
    Confirmed necessary on real data: a first version of this function always
    assumed the large-unit reading (right for a Spinneys "3" meaning 3 litres
    of oil, alongside explicit-litre siblings), but that same rule silently
    turned a Spinneys "19" (meaning a 19g instant-coffee sachet, alongside a
    Carrefour sibling explicitly saying "19.3G") into 19,000g -- producing a
    67,600% gap on an item that should have been a normal few-percent
    difference. Picking whichever candidate is numerically closest to real
    sibling values avoids both failure modes with the same logic.

    Mutates rows in place (base_qty/family) for any row it resolves; does
    nothing if no confident family is available (row stays unusable)."""
    sibling_qtys_by_family = defaultdict(list)
    for rows in chain_rows.values():
        for r in rows:
            if r.get("family") in ("mass", "vol") and r.get("base_qty"):
                sibling_qtys_by_family[r["family"]].append(r["base_qty"])
    if not sibling_qtys_by_family:
        return
    fam = max(sibling_qtys_by_family, key=lambda f: len(sibling_qtys_by_family[f]))
    siblings = sibling_qtys_by_family[fam]

    def closest_ratio(candidate):
        return min(max(candidate, s) / max(min(candidate, s), 1e-9) for s in siblings)

    resolved = 0
    for rows in chain_rows.values():
        for r in rows:
            if r.get("base_qty") is None and r.get("ambigQty") is not None:
                as_is = r["ambigQty"]
                as_large_unit = r["ambigQty"] * 1000
                chosen = as_is if closest_ratio(as_is) <= closest_ratio(as_large_unit) else as_large_unit
                r["base_qty"] = chosen
                r["family"] = fam
                resolved += 1
                log(f"    resolved ambiguous size {r['ambigQty']!r} -> {chosen} {fam} "
                    f"(chose {'as-is' if chosen == as_is else 'x1000'}, nearest sibling(s): {siblings})")
    if resolved:
        log(f"    resolved {resolved} ambiguous bare-number size(s) as '{fam}' from sibling context")


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
        bq, fam, ambig_qty = parse_qty(row.get("weight"))
        records.append({
            "chain": chain_of(row),
            "ambigQty": ambig_qty,
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


# ── CPI item weights, from the curated Excel catalog (data/item_product_catalog.json) ──
# 2026-08: switched from the Azure SQL NonCoreItemBreakdown.Share connection
# to this. The same spreadsheet that supplies the primary product matching
# (see ITEM_CATALOG below) also carries each leaf item's real CPI weight,
# already verified against the classes.csv category hierarchy (the weights
# roll up correctly to each 3-digit category's total, e.g. "Bread and
# cereals" = 2.07255, matching the sum of its leaf items). No live DB
# connection needed for this anymore. The Azure Function
# (azure-function/item_weights_api) and lib/azure/itemWeights.js are left in
# the repo but are no longer called from here -- kept in case a live DB path
# is wanted again later, not deleted.
#
# Falls back to EQUAL weights (loudly logged) only if the catalog file itself
# is missing or a given code has no weight value -- never fabricates one.
ITEM_CATALOG_FILE = "data/item_product_catalog.json"


def load_item_weights():
    if not os.path.exists(ITEM_CATALOG_FILE):
        log_warn(f"{ITEM_CATALOG_FILE} not found -- category gaps will use EQUAL "
                  f"weights (a plain unweighted average), NOT real CPI importance weights.")
        return {}
    try:
        rows = json.load(open(ITEM_CATALOG_FILE, encoding="utf-8"))
    except Exception as e:
        log_warn(f"could not load {ITEM_CATALOG_FILE} for weights: {e!r} -- falling back to EQUAL weights.")
        return {}
    weights = {}
    for r in rows:
        w = r.get("weight")
        if w is not None:
            weights[norm_code(str(r["code"]))] = float(w)
    missing = len(rows) - len(weights)
    if missing:
        log_warn(f"{missing} catalog item(s) have no weight value -- those items will fall back "
                  f"to equal weighting individually within their category (see weighted-average "
                  f"formula: an item with no weight contributes nothing, not a fabricated one).")
    log(f"loaded {len(weights)} real CPI item weights from {ITEM_CATALOG_FILE}")
    return weights


ITEM_WEIGHTS = load_item_weights()
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
        "productsCompared": 0,
        "catalogMatched": 0,
        "clusteringMatched": 0,
    })
chain_list.sort(key=lambda x: -x["items"])


# ── Item-level gap: unified per-chain price via GM, then a PLAIN ratio ───────
# 2026-08 rewrite. Summary:
#   1. PRIMARY matcher: the curated Excel catalog. For a cpi_code it covers,
#      every chain's list of officially-listed products is verbatim-matched
#      against the real basket rows; an item is only used if EVERY active
#      chain has at least one real match ("drop uncommon items between
#      retailers" -- a chain with zero matches means this item isn't
#      comparable here at all, full stop, not partially comparable).
#      Prices are scaled to the catalog's own authoritative Base Unit (not a
#      unit inferred from whatever sizes happen to be on sale) -- this is
#      what lets genuinely different real pack sizes (e.g. a 3L bottle vs a
#      1.8L and a 5L option) still compare fairly on a common basis, instead
#      of being excluded for "disagreeing" on size.
#   2. FALLBACK: for any cpi_code the catalog doesn't cover, the older name-
#      similarity clustering + tolerance-based size resolution still applies.
#   3. Geometric mean is used in EXACTLY ONE place: collapsing multiple
#      matched products (different brands) AT ONE CHAIN into a single
#      representative price for that chain. It is NEVER used to compute the
#      gap itself.
#   4. The item-level gap is a PLAIN ratio between the two chains' (possibly
#      GM'd) prices: dearest chain's price / cheapest chain's price - 1.
#      No geometric mean is involved in this step.
NUM_ACTIVE = len(ACTIVE_CHAINS)

# ── Product matching, PRIMARY source: curated Excel catalog ─────────────────
# 2026-08: replaces name-similarity clustering as the primary way products are
# matched across chains. data/item_product_catalog.json is extracted from a
# hand-curated spreadsheet (per cpi_code: the exact, real product names that
# officially represent that item at each retailer) -- verified directly
# against the actual basket CSVs before adopting this: 85% of its Spinneys
# names and 78% of its Carrefour names match a real row VERBATIM, covering
# 156 of 162 leaf CPI items. This is ground truth, not inferred similarity --
# used whenever it produces a usable match (>=2 chains with >=1 real row).
# cluster_products() (name-similarity) remains the FALLBACK for any cpi_code
# the catalog doesn't cover, or where matching fails for other reasons.
EXCEL_CHAIN_KEY = {"Carrefour": "carrefour", "Spinneys": "spinneys"}  # extend
    # this mapping (not the matching logic) if the catalog spreadsheet ever
    # adds another chain's column.

BASE_UNIT_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(kgs?|kg|g|gm|gr|grams?|mg|l|lt|ltr|liters?|litres?|ml|cl|cc|"
    r"pcs?|pieces?|pack|packs|bar|bars|bundle|bundles|bag|bags|loaf|loaves)\b",
    re.I,
)
COUNT_WORDS = {"pcs", "pc", "pieces", "piece", "pack", "packs", "bar", "bars",
                "bundle", "bundles", "bag", "bags", "loaf", "loaves"}


def parse_base_unit(text):
    """Parse the Excel's 'Base Unit' column (e.g. '1.5 L', '100 gm', '10 Kg',
    '4 pcs') into (base_qty, family). Takes the FIRST number+unit match --
    several entries have messy multi-value text ('155 g, 160 g', '1 Kg,1 M3')
    where taking the first is the safest read, not an attempt to reconcile
    conflicting values. Returns (None, None) if nothing matches at all (the
    caller falls back to the old tolerance-based size resolution for that
    item, same as if the catalog didn't cover it)."""
    if not text:
        return (None, None)
    m = BASE_UNIT_RE.search(text.strip().lower())
    if not m:
        return (None, None)
    val = float(m.group(1).replace(",", "."))
    u = m.group(2)
    if u.startswith("kg"):
        return (val * 1000, "mass")
    if u in ("g", "gm", "gr") or u.startswith("gram"):
        return (val, "mass")
    if u == "mg":
        return (val * 0.001, "mass")
    if u in ("l", "lt", "ltr") or u.startswith(("liter", "litre")):
        return (val * 1000, "vol")
    if u == "cl":
        return (val * 10, "vol")
    if u in ("ml", "cc"):
        return (val, "vol")
    if u in COUNT_WORDS:
        return (val, "count")
    return (None, None)


def load_item_catalog():
    if not os.path.exists(ITEM_CATALOG_FILE):
        log_warn(f"{ITEM_CATALOG_FILE} not found -- falling back to name-similarity "
                  f"clustering for ALL items, not just uncovered ones.")
        return {}
    try:
        rows = json.load(open(ITEM_CATALOG_FILE, encoding="utf-8"))
    except Exception as e:
        log_warn(f"could not load {ITEM_CATALOG_FILE}: {e!r} -- falling back to "
                  f"name-similarity clustering for ALL items.")
        return {}
    catalog = {}
    no_base_unit = 0
    for r in rows:
        by_chain = {}
        for chain, key in EXCEL_CHAIN_KEY.items():
            names = {n.strip().lower() for n in (r.get(key) or []) if n and n.strip()}
            if names:
                by_chain[chain] = names
        if not by_chain:
            continue
        ref_qty, family = parse_base_unit(r.get("baseUnit"))
        if ref_qty is None:
            no_base_unit += 1
        catalog[r["code"]] = {"byChain": by_chain, "refQty": ref_qty, "family": family,
                               "baseUnitRaw": r.get("baseUnit")}
    if no_base_unit:
        log_warn(f"{no_base_unit} catalog item(s) have a product list but no parseable Base Unit -- "
                  f"those fall through to the name-similarity/tolerance-based fallback for sizing.")
    log(f"loaded item-product catalog: {len(catalog)} cpi_codes with a curated product list "
        f"from {ITEM_CATALOG_FILE}")
    return catalog


ITEM_CATALOG = load_item_catalog()


def scale_price(row, ref_qty):
    """Scale a row's price to ref_qty using its own parsed pack size. None if
    the row has no usable size."""
    bq = row.get("base_qty")
    if not bq or bq <= 0:
        return None
    return round(row["price"] / bq * ref_qty, 4)


def gm_or_single(values):
    """Geometric mean if there's more than one value, else just the value.
    THIS is the only place geometric mean is used anywhere in this script:
    collapsing multiple matched products (brands) AT ONE CHAIN into a single
    representative price for that chain. It has nothing to do with computing
    the gap itself -- see the plain dear/cheap ratio below."""
    values = [v for v in values if v and v > 0]
    if not values:
        return None
    return values[0] if len(values) == 1 else geo_mean(values)


item_groups = defaultdict(list)
for r in current:
    if r["chain"] in ACTIVE_CHAINS and r["cpi_code"]:
        item_groups[r["cpi_code"]].append(r)

products = []            # every individual matched product's own scaled price
                          # -- display/graph only, NEVER used to compute item
                          # or category gaps (those use the GM'd chain price).
items = []                # item-level rollups: gap = plain (dear/cheap - 1)
                          # between the two chains' GM'd prices.
skipped_items = []
catalog_matched_codes = 0
fallback_matched_codes = 0

for code, rs in item_groups.items():
    item_label = rs[0]["cpi_item"]
    category = rs[0]["category"]

    chain_rows = None   # {chain: [rows]}, once resolved
    ref_qty = None
    family = None
    match_source = None

    # ── PRIMARY: curated Excel catalog, with its own authoritative Base Unit.
    # "Drop uncommon items between retailers": an item is only usable if
    # EVERY active chain has at least one real, verbatim-matched row from the
    # catalog's list for that chain -- a chain with zero matches means this
    # item isn't comparable at all here, not partially comparable.
    cat_entry = ITEM_CATALOG.get(code)
    if cat_entry and cat_entry["refQty"]:
        wanted = cat_entry["byChain"]
        candidate = {
            ch: [r for r in rs if r["chain"] == ch and r["product"].strip().lower() in wanted.get(ch, set())]
            for ch in ACTIVE_CHAINS
        }
        if all(candidate.get(ch) for ch in ACTIVE_CHAINS):
            # Same sibling-context resolution as the fallback path uses (see
            # resolve_ambiguous_qty above) -- was previously only wired into
            # the fallback path, silently leaving bare ambiguous numbers
            # (e.g. Spinneys recording "1" for a 1kg item) unresolved here
            # even when the OTHER chain's row in the SAME item has an
            # explicit unit to infer from.
            resolve_ambiguous_qty(candidate)

            # Plausibility check on the catalog's own Base Unit: confirmed on
            # real data that this file has at least one data-entry error --
            # "cashew" (11657) lists a Base Unit of "500 kg" while its real
            # matched products are 30GR/15GR packs, a >10,000x mismatch, which
            # produced a nonsensical $14,166-per-"unit" price. Rather than
            # trust the catalog's stated unit blindly, compare it against the
            # real parsed sizes of the actual matched rows; if it's wildly
            # off (here: >20x in either direction), the catalog's PRODUCT
            # MATCH is still used (that part is reliable), but the SIZE falls
            # back to being resolved from real evidence, same as an item with
            # no catalog Base Unit at all.
            real_qtys = [r["base_qty"] for rows_ in candidate.values() for r in rows_ if r.get("base_qty")]
            real_fams = Counter(r["family"] for rows_ in candidate.values() for r in rows_ if r.get("family"))
            implausible = False
            if real_qtys and cat_entry["family"] in ("mass", "vol"):
                # Only meaningful within the SAME family -- a count-based Base
                # Unit ("1 pack", "1 bar", "7 loaves") compared numerically
                # against real MASS sizes (grams) is comparing different
                # kinds of quantity, not a data error, so it's excluded here
                # entirely (confirmed: "1 pack" vs real 82.5g biscuits and
                # "7 loaves" vs real 825g bread both flagged as false
                # positives under a same-number check before this fix).
                # Threshold set well above a legitimate small-packet-to-kg/L
                # scaling factor -- confirmed elsewhere in this same catalog
                # that ~50x (a 20g cardamom packet standardized to a 1kg
                # reference) is a normal, intended design, not an error; the
                # genuine case this guard exists for ("cashew": 500,000g
                # Base Unit vs ~50g real packs) is off by ~9,500x, nowhere
                # near this line.
                same_fam_qtys = [q for q, r in zip(real_qtys, [r for rows_ in candidate.values() for r in rows_ if r.get("base_qty")]) if r.get("family") == cat_entry["family"]]
                if same_fam_qtys:
                    med_real = statistics.median(same_fam_qtys)
                    if med_real > 0 and not (1/200 <= cat_entry["refQty"] / med_real <= 200):
                        implausible = True
                        log_warn(f"item '{item_label}' ({code}): catalog Base Unit "
                                  f"'{cat_entry['baseUnitRaw']}' ({cat_entry['refQty']}) is implausible next to "
                                  f"the real matched products' sizes (median {med_real}, same family) -- likely "
                                  f"a data-entry error in the catalog spreadsheet. Using the products (still "
                                  f"trustworthy) but resolving size from real evidence instead of the stated "
                                  f"Base Unit.")

            if not implausible:
                chain_rows = candidate
                ref_qty, family = cat_entry["refQty"], cat_entry["family"]
                match_source = "catalog"
                catalog_matched_codes += 1
            else:
                sizeable = {ch: [r for r in rows_ if r["base_qty"]] for ch, rows_ in candidate.items()}
                if all(sizeable.get(ch) for ch in ACTIVE_CHAINS):
                    rq, chains_for_size = resolve_reference_qty(sizeable)
                    if rq is not None:
                        sizeable = {ch: rs_ for ch, rs_ in sizeable.items() if ch in chains_for_size}
                        if all(sizeable.get(ch) for ch in ACTIVE_CHAINS):
                            chain_rows = sizeable
                            ref_qty = rq
                            all_rows = [r for rows_ in chain_rows.values() for r in rows_]
                            fam_counts = Counter(r["family"] for r in all_rows if r["family"])
                            family = fam_counts.most_common(1)[0][0] if fam_counts else None
                            match_source = "catalog"
                            catalog_matched_codes += 1

    # ── FALLBACK: name-similarity clustering + the tolerance-based size
    # resolution from before, only reached when the catalog doesn't cover
    # this item (or its match didn't survive verbatim-matching above).
    if chain_rows is None:
        best, best_score = None, -1
        for cluster in cluster_products(rs):
            by_chain_rows = defaultdict(list)
            for r in cluster:
                by_chain_rows[r["chain"]].append(r)
            if not all(by_chain_rows.get(ch) for ch in ACTIVE_CHAINS):
                continue
            resolve_ambiguous_qty(by_chain_rows)
            sizeable = {ch: [r for r in rows_ if r["base_qty"]] for ch, rows_ in by_chain_rows.items()}
            if not all(sizeable.get(ch) for ch in ACTIVE_CHAINS):
                continue
            rq, chains_for_size = resolve_reference_qty(sizeable)
            if rq is None:
                continue
            sizeable = {ch: rs_ for ch, rs_ in sizeable.items() if ch in chains_for_size}
            if not all(sizeable.get(ch) for ch in ACTIVE_CHAINS):
                continue
            score = sum(len(v) for v in sizeable.values())  # prefer the best-evidenced cluster
            if score > best_score:
                best_score, best = score, (sizeable, rq)
        if best:
            chain_rows, ref_qty = best
            all_rows = [r for rows_ in chain_rows.values() for r in rows_]
            fam_counts = Counter(r["family"] for r in all_rows if r["family"])
            family = fam_counts.most_common(1)[0][0] if fam_counts else None
            match_source = "clustering"
            fallback_matched_codes += 1

    if chain_rows is None:
        skipped_items.append((code, item_label, "no >=2-chain match via catalog or clustering fallback"))
        continue

    unit_label = format_ref_unit(ref_qty, family)

    # ── Product-level (display/graph only): each matched row's own scaled
    # price. No GM, no gap math here -- just what each real listing costs on
    # a common basis.
    for ch, rows_ in chain_rows.items():
        for r in rows_:
            up = scale_price(r, ref_qty)
            if up is None:
                continue
            products.append({
                "code": code, "cpi_item": item_label, "category": category,
                "chain": ch, "productName": r["product"], "unit": unit_label,
                "unitPrice": up, "matchSource": match_source,
            })

    # ── Item-level: GM collapses each chain's matched products into ONE
    # price; the gap is then a PLAIN ratio between the two chains' prices --
    # geometric mean plays no further role past this point.
    chain_price = {}
    for ch, rows_ in chain_rows.items():
        prices = [scale_price(r, ref_qty) for r in rows_]
        gm = gm_or_single(prices)
        if gm:
            chain_price[ch] = round(gm, 3)

    if len(chain_price) < 2:
        skipped_items.append((code, item_label, f"fewer than 2 chains had a usable price after unit scaling: {chain_price}"))
        continue

    dear_ch = max(chain_price, key=chain_price.get)
    cheap_ch = min(chain_price, key=chain_price.get)
    dear_p, cheap_p = chain_price[dear_ch], chain_price[cheap_ch]
    if cheap_p <= 0:
        continue
    gap = round((dear_p / cheap_p - 1) * 100)

    items.append({
        "code": code, "cpi_item": item_label, "category": category,
        "unit": unit_label,
        "unitByChain": chain_price,
        "dearChain": dear_ch, "dearUnitPrice": dear_p,
        "cheapChain": cheap_ch, "cheapUnitPrice": cheap_p,
        "gapPct": gap,
        "nChains": len(chain_price),
        "matchSource": match_source,
        "weight": ITEM_WEIGHTS.get(code),
        "nProductsByChain": {ch: len(rows_) for ch, rows_ in chain_rows.items()},
    })

if skipped_items:
    log_warn(f"{len(skipped_items)} cpi_code(s) never produced a usable item-level gap:")
    for code, label, reason in skipped_items[:15]:
        log_warn(f"    {code} '{label}': {reason}")
    if len(skipped_items) > 15:
        log_warn(f"    ...and {len(skipped_items) - 15} more")

log(f"matching source: {catalog_matched_codes} cpi_codes matched via the curated catalog, "
    f"{fallback_matched_codes} via name-similarity clustering fallback")
log(f"{len(items)} item-level gaps computed; {len(products)} individual product prices recorded (display only)")

items.sort(key=lambda x: x["code"])
products.sort(key=lambda x: (x["code"], x["productName"]))
# Credible band — same 10-150% window as before, now applied to the plain
# dear/cheap ratio (no geometric mean involved in the gap itself -- see the
# module docstring's 2026-08 section). Outside it, treat as a different-
# grade/format product, not a real markup.
flagged = [it for it in items if it["gapPct"] is not None and CREDIBLE_GAP_LO <= it["gapPct"] <= CREDIBLE_GAP_HI]
log(f"{len(items)} items with a valid gap; {len(flagged)} inside the credible "
    f"{CREDIBLE_GAP_LO}-{CREDIBLE_GAP_HI}% band")

# Chain rollups — mean premium & dearest-item count, computed ONLY over
# flagged items (so a chain with zero comparable/credible items shows no
# premium rather than a fabricated one). Premium per item = this chain's
# price vs. the AVERAGE of every other chain's price for that same item --
# a plain ratio, not geometric-mean-anchored (with exactly 2 active chains,
# "average of every other chain" is just the one other chain's price; this
# form is written to generalize cleanly once a 3rd+ chain is active, without
# reintroducing geometric mean into the premium calculation).
cAgg = {}
for it in flagged:
    prices = it["unitByChain"]
    chs = list(prices)
    for ch in chs:
        others = [prices[o] for o in chs if o != ch]
        if not others:
            continue
        other_avg = sum(others) / len(others)
        if other_avg <= 0:
            continue
        a = cAgg.setdefault(ch, {"items": 0, "dearest": 0, "premSum": 0.0})
        a["items"] += 1
        a["premSum"] += (prices[ch] / other_avg - 1)
    cAgg[it["dearChain"]]["dearest"] += 1

# Product-level participation per chain -- `products` is now a flat list of
# individual (item, chain, product) price records (see the main loop above),
# not cross-chain comparison pairs, so this just counts how many such records
# exist per chain and how each item they belong to was matched.
pAgg = {}
for p in products:
    a = pAgg.setdefault(p["chain"], {"products": 0, "catalog": 0, "clustering": 0})
    a["products"] += 1
    a[p["matchSource"]] += 1

for c in chain_list:
    a = cAgg.get(c["name"])
    if a and a["items"]:
        c["itemsCompared"] = a["items"]
        c["dearestItems"] = a["dearest"]
        c["avgPremiumPct"] = round((a["premSum"] / a["items"]) * 100)
    # else: leave the zero/None defaults set above — this chain has no
    # comparable+credible items yet, which is a true statement, not a 0% gap.
    p_a = pAgg.get(c["name"])
    c["productsCompared"] = p_a["products"] if p_a else 0
    c["catalogMatched"] = p_a["catalog"] if p_a else 0
    c["clusteringMatched"] = p_a["clustering"] if p_a else 0


# ── Category-level: WEIGHTED average of item gaps (weight = curated Excel catalog) ────
cat_items = defaultdict(list)
for it in items:  # use ALL items with a valid gap, not just "flagged", so every
                   # category gets a number; the flag decides if it's "concerning"
    if it["gapPct"] is not None:
        cat_items[it["category"]].append(it)

all_category_names = sorted(set(CLASSES.values()) | set(cat_items.keys()))
category_gaps = []
dropped_empty_categories = 0
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
        })
    else:
        # Categories with zero comparable items are dropped entirely, not
        # shown with a placeholder -- per instruction, only categories with
        # real data appear on the page at all.
        dropped_empty_categories += 1
category_gaps.sort(key=lambda c: -c["gapPct"])
log(f"{len(category_gaps)} categories with real data shown; {dropped_empty_categories} dropped "
    f"(zero comparable items -- not displayed at all, per instruction)")
if USING_EQUAL_WEIGHTS:
    log_warn("category gapPct values above are an UNWEIGHTED average (equal "
              "weights) -- the item catalog weights were not available at build time.")


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
        "itemCatalogCodes": len(ITEM_CATALOG),
        "catalogMatchedCodes": catalog_matched_codes,
        "fallbackMatchedCodes": fallback_matched_codes,
        "note": ("CPI-mapped retail basket across Lebanese chains. Chains are scraped on "
                 "different days, so the current view takes each chain's most recent date "
                 "(cross-sectional, not a single-day cut). Effective price uses the "
                 "discounted price where one is shown. Gap calculations only use ACTIVE_CHAINS "
                 "(currently: " + ", ".join(ACTIVE_CHAINS) + "). Products are matched via a "
                 "curated catalog of real product names per item (verbatim-matched against "
                 "the live basket), each scaled to that item's real base unit. Geometric mean "
                 "is used only to combine multiple matched products AT ONE CHAIN into a single "
                 "price for that chain; the item gap is a plain ratio between the two chains' "
                 "prices (dearest / cheapest - 1). Category gap = weighted average of item "
                 "gaps by CPI weight from the curated Excel catalog."),
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
        "productPrices": len(products),
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
log(f"productPrices={k['productPrices']}  comparableItems={k['comparableItems']}  flaggedItems={k['flaggedItems']}")
log(f"categories={k['categories']}  categoryGaps rows={len(category_gaps)} (needsReview={sum(c['needsReview'] for c in category_gaps)})")
log(f"basketMedian=${k['basketMedian']}  inStock={k['inStockRate']}%  discounted={k['discountedSharePct']}%")
if USING_EQUAL_WEIGHTS:
    log_warn("REMINDER: category gaps used EQUAL weights, not the real catalog weights (data/item_product_catalog.json). "
              "Set AZURE_ITEM_WEIGHTS_FUNCTION_URL/_KEY and re-run once the endpoint is live.")
