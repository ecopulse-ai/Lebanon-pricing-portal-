// Builds the searchable product catalogue from the raw standardized rows
// pulled from the Data Lake (Promarche + Al-Makhazen + Spinneys).
//
// 2026-08 rewrite — two separate phases, on purpose:
//
// PHASE 1 (per-retailer grouping): group rows into "source-products" using
// retailer + exact name + brand. Adding `retailer` to the key (it was NOT in
// the key before) means a group can NEVER silently blend rows from two
// different retailers just because their title text happened to coincide —
// that was an uncontrolled, unverified way for cross-source merging to occur.
// This phase still safely collapses the same retailer's own multi-branch
// listings (confirmed cause of the old "n=6+ listings" counts) into one row.
//
// PHASE 2 (cross-source linking): a SEPARATE, explicit, multi-signal pass
// that decides whether two DIFFERENT retailers' source-products describe the
// same physical item. A pair is only linked when ALL of the following hold —
// this is "only join when certain", not a single fuzzy-match on name text:
//   1. Same canonical category.
//   2. Both have a successfully PARSED pack size, and the sizes are equal
//      (same unit family, base quantity within 1%). No parsed size on either
//      side -> never linked. This is the hard gate that stops the original
//      bug class (comparing/merging different units as if the same product).
//   3. If both sides have brand text, the brands must match (exact, or very
//      high token similarity to tolerate spelling/case variants). If either
//      side has no brand data (a real gap for some sources), this signal is
//      skipped and the name-similarity bar is raised instead, so a missing
//      corroborating signal can't be silently substituted with a weaker one.
//   4. Name-similarity (Dice coefficient over the brand+size-stripped name)
//      clears a threshold — 0.6 when brand corroborates, 0.75 when it can't.
// Candidates are only ever compared WITHIN the same (category, unit family,
// rounded base quantity) bucket — this is both a performance necessity (avoids
// an all-pairs O(n^2) comparison across ~48k products) and an additional
// matching signal in its own right, since conditions 1-2 are already implied
// by being in the same bucket.
//
// Every criterion here is inspectable in one sentence ("same category, same
// parsed size, same/similar brand, N% of words in common") rather than a
// black-box similarity score — for a government transparency tool, being able
// to explain *why* two listings were linked matters as much as the linking
// itself.

import { canonCategory } from "./categories";
import { parseSize, coreName, tokenSimilarity } from "./sizeParse";
import { mapGroupId, productMapMeta } from "./productMap";

function round2(x) {
  return Math.round(x * 100) / 100;
}

function median(sortedAsc) {
  const n = sortedAsc.length;
  const mid = Math.floor(n / 2);
  return n % 2 ? sortedAsc[mid] : (sortedAsc[mid - 1] + sortedAsc[mid]) / 2;
}

function percentile(sortedAsc, q) {
  if (!sortedAsc.length) return 0;
  const idx = Math.round(q * (sortedAsc.length - 1));
  return sortedAsc[idx];
}

function topKey(counter) {
  let best = null;
  let bestN = -1;
  for (const [k, n] of counter) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

function log(...args) {
  console.log("[buildProducts]", ...args);
}
function logWarn(...args) {
  console.warn("[buildProducts] WARNING:", ...args);
}

const NAME_SIM_THRESHOLD_WITH_BRAND = 0.6;
const NAME_SIM_THRESHOLD_NO_BRAND = 0.75;
const QTY_TOLERANCE = 0.01; // 1% — allows for trivial float rounding, not real size differences

// ── Phase 1: retailer-scoped grouping ─────────────────────────────────────────
function buildSourceProducts(rows) {
  const groups = new Map();
  let listingCount = 0;
  let skippedNoName = 0;

  for (const row of rows) {
    const name = row.product_name;
    if (!name) {
      skippedNoName++;
      continue;
    }
    listingCount++;

    const retailer = row.retailer || "Unknown";
    const brand = row.brand || "";
    // retailer is now PART of the key — a group can never blend two retailers.
    const key = `${retailer}|${name.toLowerCase().trim().replace(/\s+/g, " ")}|${brand.toLowerCase()}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        retailer,
        names: new Map(),
        brand,
        cat: canonCategory(row.category_top),
        prices: [],
        imgs: [],
        origins: new Map(),
        units: new Map(),
        instock: 0,
        listings: 0,
      };
      groups.set(key, g);
    }
    g.listings++;
    g.names.set(name, (g.names.get(name) || 0) + 1);
    if (typeof row.price_usd === "number" && row.price_usd > 0) g.prices.push(row.price_usd);
    if (row.img) g.imgs.push(row.img);
    if (row.origin_probable) g.origins.set(row.origin_probable, (g.origins.get(row.origin_probable) || 0) + 1);
    if (row.qty_unit_raw) g.units.set(row.qty_unit_raw, (g.units.get(row.qty_unit_raw) || 0) + 1);
    if (row.in_stock) g.instock++;
  }

  if (skippedNoName) log(`skipped ${skippedNoName} row(s) with no product_name`);

  const sourceProducts = [];
  for (const g of groups.values()) {
    if (!g.prices.length) continue;
    const ps = [...g.prices].sort((a, b) => a - b);
    const name = topKey(g.names);
    const unit = topKey(g.units) || "";
    const size = parseSize(name) || parseSize(unit);
    sourceProducts.push({
      retailer: g.retailer,
      name,
      brand: g.brand,
      cat: g.cat,
      prices: ps, // real sorted listing prices — kept so cross-source merges
                   // (phase 2) can compute genuine percentiles, not an
                   // approximation from a repeated median.
      min: round2(ps[0]),
      max: round2(ps[ps.length - 1]),
      med: round2(median(ps)),
      p10: round2(percentile(ps, 0.1)),
      p90: round2(percentile(ps, 0.9)),
      n: g.listings,
      origin: topKey(g.origins) || "",
      unit,
      img: g.imgs[0] || "",
      stock: g.instock > 0,
      size, // { family, baseQty, ... } | null — used only by phase 2
      core: coreName(name, g.brand),
    });
  }
  log(`phase 1: ${listingCount} listings -> ${sourceProducts.length} per-retailer source-products`);
  return sourceProducts;
}

// ── Phase 2: cross-source linking ─────────────────────────────────────────────
function linkAcrossSources(sourceProducts) {
  const buckets = new Map();
  let noSizeCount = 0;
  for (const sp of sourceProducts) {
    if (!sp.size) {
      noSizeCount++;
      continue; // no parsed size -> can never be linked to anything (fail closed)
    }
    const roundedQty = Math.round(sp.size.baseQty * 100) / 100;
    const key = `${sp.cat}|${sp.size.family}|${roundedQty}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(sp);
  }
  logWarn(
    `${noSizeCount} of ${sourceProducts.length} source-products had no parseable size and are ` +
      `NEVER eligible for cross-source linking (shown individually, tagged to their one retailer).`
  );

  // Union-find over sourceProducts indices (by identity) so a match can chain
  // across more than 2 retailers (A links to B, B links to C -> A,B,C grouped).
  const parent = new Map(sourceProducts.map((sp) => [sp, sp]));
  function find(x) {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  }
  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  // ── PRIMARY matcher: the LLM-reviewed map ──────────────────────────────────
  // Runs first and unconditionally — a map hit bypasses the algorithmic gates
  // entirely (it's already been judged by a human/LLM review, not text
  // similarity). Crucially, this covers source-products with NO parseable
  // size too — the map is exactly what closes that gap, since the algorithm
  // below can never link an unparseable-size item to anything.
  const byMapGroup = new Map();
  for (const sp of sourceProducts) {
    const gid = mapGroupId(sp.retailer, sp.name);
    if (!gid) continue;
    if (!byMapGroup.has(gid)) byMapGroup.set(gid, []);
    byMapGroup.get(gid).push(sp);
  }
  let mapLinkedProducts = 0;
  let mapLinkedGroups = 0;
  for (const members of byMapGroup.values()) {
    if (members.length < 2) continue; // map entry exists but only one side present in today's pull
    mapLinkedGroups++;
    mapLinkedProducts += members.length;
    for (let i = 1; i < members.length; i++) union(members[0], members[i]);
  }
  log(
    `map match (primary): ${mapLinkedGroups} group(s) linked covering ${mapLinkedProducts} ` +
      `source-products, out of ${productMapMeta().acceptedGroups} groups in data/productMap.json. ` +
      `Everything else falls through to the algorithmic matcher below.`
  );

  let linkedPairs = 0;
  let bucketsChecked = 0;
  let bucketsSkippedTooLarge = 0;
  let comparisonsMade = 0;
  // A bucket this large is almost always a very common pack size (500g, 1kg,
  // 250ml...) shared by thousands of unrelated products within one broad
  // category — not a set of real candidate matches. Comparing all pairs in
  // it is O(n^2) and, at Data Lake scale, can turn into tens of millions of
  // comparisons in a single bucket, which is what was making this request
  // effectively hang. Skipping it is a SAFE degradation: those products
  // simply stay unlinked (shown individually, tagged to their one retailer)
  // rather than risking a request that never completes.
  const MAX_BUCKET_SIZE = 400;
  for (const [bucketKey, bucket] of buckets) {
    if (bucket.length < 2) continue;
    if (bucket.length > MAX_BUCKET_SIZE) {
      bucketsSkippedTooLarge++;
      logWarn(
        `bucket '${bucketKey}' has ${bucket.length} source-products — over the ` +
          `${MAX_BUCKET_SIZE} cap, skipped for cross-source linking (all ${bucket.length} ` +
          `stay as individual, single-retailer entries rather than risk an O(n^2) stall).`
      );
      continue;
    }
    bucketsChecked++;
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i], b = bucket[j];
        if (a.retailer === b.retailer) continue; // linking is cross-source only
        comparisonsMade++;

        // Size already guaranteed equal by the bucket key (condition 2 met).
        const bothHaveBrand = a.brand && b.brand;
        let brandOk = true;
        if (bothHaveBrand) {
          brandOk = a.brand.toLowerCase() === b.brand.toLowerCase() ||
            tokenSimilarity(a.brand.toLowerCase(), b.brand.toLowerCase()) >= 0.8;
        }
        if (!brandOk) continue;

        const threshold = bothHaveBrand ? NAME_SIM_THRESHOLD_WITH_BRAND : NAME_SIM_THRESHOLD_NO_BRAND;
        const sim = tokenSimilarity(a.core, b.core);
        if (sim < threshold) continue;

        union(a, b);
        linkedPairs++;
      }
    }
  }
  log(
    `phase 2: checked ${bucketsChecked} same-category/size buckets (${comparisonsMade} cross-retailer ` +
      `comparisons) -> ${linkedPairs} pair(s) linked. ${bucketsSkippedTooLarge} bucket(s) skipped for being over ${MAX_BUCKET_SIZE}.`
  );

  const clusters = new Map();
  for (const sp of sourceProducts) {
    const root = find(sp);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(sp);
  }
  return [...clusters.values()];
}

export function buildProducts(rows) {
  const sourceProducts = buildSourceProducts(rows);
  const clusters = linkAcrossSources(sourceProducts);

  const products = [];
  let linkedProductCount = 0;
  for (const cluster of clusters) {
    const retailers = [...new Set(cluster.map((sp) => sp.retailer))];
    const isLinked = retailers.length > 1;
    if (isLinked) linkedProductCount++;

    // Pick the source-product with the most listings as the "representative"
    // for display fields (name/brand/img/etc.) — arbitrary but stable choice.
    const rep = [...cluster].sort((a, b) => b.n - a.n)[0];
    const allPrices = cluster.flatMap((sp) => sp.prices).sort((a, b) => a - b);

    products.push({
      id: null, // assigned after sort
      name: rep.name,
      brand: rep.brand,
      cat: rep.cat,
      min: round2(Math.min(...cluster.map((sp) => sp.min))),
      max: round2(Math.max(...cluster.map((sp) => sp.max))),
      med: round2(median(allPrices)),
      p10: round2(percentile(allPrices, 0.1)),
      p90: round2(percentile(allPrices, 0.9)),
      n: cluster.reduce((s, sp) => s + sp.n, 0),
      origin: rep.origin,
      unit: rep.unit,
      img: cluster.find((sp) => sp.img)?.img || "",
      stock: cluster.some((sp) => sp.stock),
      retailers,
      linked: isLinked,
      bySource: isLinked
        ? Object.fromEntries(
            cluster.map((sp) => [sp.retailer, { name: sp.name, price: sp.med, min: sp.min, max: sp.max, n: sp.n, stock: sp.stock, img: sp.img }])
          )
        : undefined,
    });
  }

  // Most-listed products first, then assign stable ids.
  products.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  products.forEach((p, i) => (p.id = i));

  const categories = [...new Set(products.map((p) => p.cat))].sort();
  const retailersSeen = [...new Set(sourceProducts.map((sp) => sp.retailer))].sort();

  log(
    `${products.length} final products (${linkedProductCount} linked across >=2 retailers, ` +
      `${products.length - linkedProductCount} single-retailer) from ${sourceProducts.length} source-products.`
  );

  return {
    meta: {
      source: "live: Promarche + Al-Makhazen + Spinneys (Azure Data Lake, daily)",
      listings: sourceProducts.reduce((s, sp) => s + sp.n, 0),
      products: products.length,
      linkedProducts: linkedProductCount,
      productMap: productMapMeta(),
      categories,
      retailers: retailersSeen,
      currency: "USD",
    },
    products,
  };
}
